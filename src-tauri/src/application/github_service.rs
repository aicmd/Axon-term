use crate::app::errors::AppError;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tauri::{AppHandle, Emitter};
use std::fs;
use crate::application::host_service::hosts_file_path;
use crate::infrastructure::secure_store::keyring::KeyringManager;

#[derive(Debug, Serialize, Deserialize)]
pub struct GistFile {
    pub content: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GistRequest {
    pub description: String,
    pub public: bool,
    pub files: HashMap<String, GistFile>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GistResponse {
    pub id: String,
    pub html_url: String,
    pub files: HashMap<String, GistFile>,
}

#[derive(Debug, Deserialize)]
struct OAuthResponse {
    access_token: Option<String>,
    error: Option<String>,
    error_description: Option<String>,
}

#[derive(Debug, Deserialize)]
struct DeviceCodeResponse {
    device_code: String,
    user_code: String,
    verification_uri: String,
    interval: Option<u64>,
    expires_in: u64,
}

/// Payload emitted to the frontend so it can display the device code to the user.
#[derive(Debug, Clone, Serialize)]
pub struct DeviceCodePayload {
    pub user_code: String,
    pub verification_uri: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GithubUser {
    pub login: String,
    pub avatar_url: Option<String>,
}

pub struct GithubService;

impl GithubService {
    const GITHUB_API_URL: &'static str = "https://api.github.com";
    const USER_AGENT: &'static str = "Axon";
    const FILENAME: &'static str = "axon-term-hosts.encrypted";
    
    const CLIENT_ID: &'static str = "Ov23lieUXCk2Nm4bdvuO";

    /// Login using GitHub Device Flow — no client_secret required.
    /// 1. Requests a device code from GitHub
    /// 2. Emits `github-device-code` event so the frontend can show the user_code
    /// 3. Opens the verification URL in the browser
    /// 4. Polls GitHub until the user authorizes or the code expires
    pub async fn login_with_oauth(app: AppHandle) -> Result<(), AppError> {
        let client = reqwest::Client::builder().user_agent(Self::USER_AGENT).build()
            .map_err(|e| AppError::Internal(e.to_string()))?;

        // Step 1: Request device code
        let response = client
            .post("https://github.com/login/device/code")
            .header("Accept", "application/json")
            .form(&[("client_id", Self::CLIENT_ID), ("scope", "gist user")])
            .send().await
            .map_err(|e| AppError::Internal(format!("Device code request failed: {}", e)))?;

        let body = response.text().await.map_err(|e| AppError::Internal(e.to_string()))?;
        let device: DeviceCodeResponse = serde_json::from_str(&body)
            .map_err(|e| AppError::Internal(format!("Failed to parse device code response: {} — body: {}", e, body)))?;

        // Step 2: Emit device code to frontend and open browser
        let _ = app.emit("github-device-code", DeviceCodePayload {
            user_code: device.user_code.clone(),
            verification_uri: device.verification_uri.clone(),
        });
        let _ = opener::open(&device.verification_uri);

        // Step 3: Poll for token
        let interval = std::time::Duration::from_secs(device.interval.unwrap_or(5).max(5));
        let deadline = std::time::Instant::now() + std::time::Duration::from_secs(device.expires_in);

        loop {
            tokio::time::sleep(interval).await;

            if std::time::Instant::now() > deadline {
                return Err(AppError::GitHubAuth("Device code expired. Please try again.".into()));
            }

            let poll_response = client
                .post("https://github.com/login/oauth/access_token")
                .header("Accept", "application/json")
                .form(&[
                    ("client_id", Self::CLIENT_ID),
                    ("device_code", device.device_code.as_str()),
                    ("grant_type", "urn:ietf:params:oauth:grant-type:device_code"),
                ])
                .send().await
                .map_err(|e| AppError::Internal(e.to_string()))?;

            let poll_body = poll_response.text().await.map_err(|e| AppError::Internal(e.to_string()))?;
            let oauth_res: OAuthResponse = serde_json::from_str(&poll_body)
                .map_err(|e| AppError::Internal(format!("Failed to parse poll response: {}", e)))?;

            if let Some(token) = oauth_res.access_token {
                // Success — save token and setup gist
                KeyringManager::save_gh_token(&app, &token)?;

                let gist_id = Self::auto_setup_gist(&token).await?;
                KeyringManager::save_gh_gist_id(&app, &gist_id)?;

                let user = Self::get_user_info(&token).await?;
                app.emit("github-auth-status", Some(user))
                    .map_err(|e: tauri::Error| AppError::Internal(e.to_string()))?;
                return Ok(());
            }

            if let Some(error) = &oauth_res.error {
                match error.as_str() {
                    "authorization_pending" => continue,
                    "slow_down" => {
                        tokio::time::sleep(std::time::Duration::from_secs(5)).await;
                        continue;
                    }
                    "expired_token" => return Err(AppError::GitHubAuth("Device code expired. Please try again.".into())),
                    "access_denied" => return Err(AppError::GitHubAuth("User denied access.".into())),
                    _ => {
                        let msg = oauth_res.error_description.clone().unwrap_or_else(|| error.clone());
                        return Err(AppError::GitHubAuth(msg));
                    }
                }
            }
        }
    }

    pub async fn get_user_info(token: &str) -> Result<GithubUser, AppError> {
        let client = reqwest::Client::builder().user_agent(Self::USER_AGENT).build()
            .map_err(|e| AppError::Internal(e.to_string()))?;

        let response = client.get(format!("{}/user", Self::GITHUB_API_URL))
            .header("Authorization", format!("token {}", token))
            .header("X-GitHub-Api-Version", "2022-11-28")
            .send().await
            .map_err(|e| AppError::GitHub(e.to_string()))?;

        let status = response.status();
        let body = response.text().await.map_err(|e| AppError::Internal(e.to_string()))?;
        if status.is_success() {
            serde_json::from_str(&body).map_err(|e| AppError::GitHub(format!("Failed to parse user info: {}", e)))
        } else {
            Err(AppError::GitHub(format!("GitHub API error {}: {}", status, body)))
        }
    }

    async fn auto_setup_gist(token: &str) -> Result<String, AppError> {
        let client = reqwest::Client::builder().user_agent(Self::USER_AGENT).build()
            .map_err(|e| AppError::Internal(e.to_string()))?;

        // 1. Search for existing gist
        let response = client.get(format!("{}/gists", Self::GITHUB_API_URL))
            .header("Authorization", format!("token {}", token))
            .header("X-GitHub-Api-Version", "2022-11-28")
            .send().await.map_err(|e| AppError::Internal(e.to_string()))?;

        let status = response.status();
        let body = response.text().await.map_err(|e| AppError::Internal(e.to_string()))?;
        if status.is_success() {
            let gists: Vec<GistResponse> = serde_json::from_str(&body).unwrap_or_default();
            for gist in gists {
                if gist.files.contains_key(Self::FILENAME) {
                    return Ok(gist.id);
                }
            }
        }

        // 2. Create new gist
        let mut files = HashMap::new();
        files.insert(Self::FILENAME.to_string(), GistFile { content: Some("initial sync".into()) });
        let gist_request = GistRequest { description: "Axon Term Encrypted Hosts Sync".into(), public: false, files };

        let response = client.post(format!("{}/gists", Self::GITHUB_API_URL))
            .header("Authorization", format!("token {}", token))
            .header("X-GitHub-Api-Version", "2022-11-28")
            .json(&gist_request).send().await.map_err(|e| AppError::Internal(e.to_string()))?;

        let status = response.status();
        let body = response.text().await.map_err(|e| AppError::Internal(e.to_string()))?;
        if status.is_success() {
            let res: GistResponse = serde_json::from_str(&body).map_err(|e| AppError::Internal(e.to_string()))?;
            Ok(res.id)
        } else {
            Err(AppError::Internal(format!("Failed to create gist: {}", body)))
        }
    }

    pub async fn test_token(token: &str) -> Result<(), AppError> {
        match Self::get_user_info(token).await {
            Ok(_) => Ok(()),
            Err(e) => Err(e),
        }
    }

    pub async fn sync_to_gist(app: AppHandle, token: &str, gist_id: Option<String>) -> Result<String, AppError> {
        let path = hosts_file_path(&app)?;
        let content = fs::read_to_string(path).map_err(|e| AppError::Io(format!("Read error: {}", e)))?;

        let client = reqwest::Client::builder().user_agent(Self::USER_AGENT).build()
            .map_err(|e| AppError::Internal(e.to_string()))?;

        let mut files = HashMap::new();
        files.insert(Self::FILENAME.to_string(), GistFile { content: Some(content) });
        let gist_request = GistRequest { description: "Axon Term Encrypted Hosts Sync".into(), public: false, files };

        let url = match &gist_id {
            Some(id) => format!("{}/gists/{}", Self::GITHUB_API_URL, id),
            None => format!("{}/gists", Self::GITHUB_API_URL),
        };

        let req = if gist_id.is_some() { client.patch(&url) } else { client.post(&url) };
        let response = req.header("Authorization", format!("token {}", token))
            .header("X-GitHub-Api-Version", "2022-11-28")
            .json(&gist_request).send().await.map_err(|e| AppError::Internal(e.to_string()))?;

        if response.status().is_success() {
            let res: GistResponse = response.json().await.map_err(|e| AppError::Internal(e.to_string()))?;
            Ok(res.id)
        } else {
            Err(AppError::GitHubSync(format!("Sync failed with status: {}", response.status())))
        }
    }

    pub async fn sync_from_gist(app: AppHandle, token: &str, gist_id: &str) -> Result<(), AppError> {
        let client = reqwest::Client::builder().user_agent(Self::USER_AGENT).build()
            .map_err(|e| AppError::Internal(e.to_string()))?;

        let response = client.get(format!("{}/gists/{}", Self::GITHUB_API_URL, gist_id))
            .header("Authorization", format!("token {}", token))
            .header("X-GitHub-Api-Version", "2022-11-28")
            .send().await.map_err(|e| AppError::Internal(e.to_string()))?;

        if response.status().is_success() {
            let res: GistResponse = response.json().await.map_err(|e| AppError::Internal(e.to_string()))?;
            if let Some(file) = res.files.get(Self::FILENAME) {
                if let Some(content) = &file.content {
                    fs::write(hosts_file_path(&app)?, content).map_err(|e| AppError::Io(e.to_string()))?;
                    return Ok(());
                }
            }
            Err(AppError::Internal("Sync file not found in Gist".into()))
        } else {
            Err(AppError::GitHubSync(format!("Pull failed with status: {}", response.status())))
        }
    }
}
