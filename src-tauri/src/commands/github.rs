use crate::application::github_service::{GithubService, GithubUser};
use crate::app::errors::AppError;
use crate::infrastructure::secure_store::keyring::KeyringManager;
use tauri::{AppHandle, Emitter};

#[tauri::command]
pub async fn login_to_github(app: AppHandle) -> Result<(), AppError> {
    GithubService::login_with_oauth(app).await
}

#[tauri::command]
pub async fn logout_from_github(app: AppHandle) -> Result<(), AppError> {
    KeyringManager::delete_gh_token(&app)?;
    KeyringManager::delete_gh_gist_id(&app)?;
    Ok(())
}

#[tauri::command]
pub async fn get_github_auth_status(app: AppHandle) -> Result<Option<GithubUser>, AppError> {
    if let Some(token) = KeyringManager::get_gh_token(&app)? {
        match GithubService::get_user_info(&token).await {
            Ok(user) => Ok(Some(user)),
            Err(e) => {
                eprintln!("Failed to get user info for existing token: {}", e);
                Ok(None)
            }
        }
    } else {
        Ok(None)
    }
}

#[tauri::command]
pub async fn sync_to_github(app: AppHandle) -> Result<String, AppError> {
    // Check if Master Password exists
    if KeyringManager::get_password(&app)?.is_none() {
        return Err(AppError::Internal("Master Password not set. Please set it in settings before syncing.".into()));
    }

    let token = KeyringManager::get_gh_token(&app)?.ok_or_else(|| AppError::Internal("Not logged in to GitHub".into()))?;
    let gist_id = KeyringManager::get_gh_gist_id(&app)?;
    GithubService::sync_to_gist(app, &token, gist_id).await
}

#[tauri::command]
pub async fn sync_from_github(app: AppHandle) -> Result<(), AppError> {
    // Check if Master Password exists
    if KeyringManager::get_password(&app)?.is_none() {
        return Err(AppError::Internal("Master Password not set. Please set it in settings before syncing.".into()));
    }

    let token = KeyringManager::get_gh_token(&app)?.ok_or_else(|| AppError::Internal("Not logged in to GitHub".into()))?;
    let gist_id = KeyringManager::get_gh_gist_id(&app)?.ok_or_else(|| AppError::Internal("No Gist ID found".into()))?;
    
    // 1. Pull data from Gist
    GithubService::sync_from_gist(app.clone(), &token, &gist_id).await?;

    // 1.5. Invalidate hosts cache since the file on disk was replaced
    crate::application::host_service::invalidate_cache(&app);

    // 2. Immediately try to decrypt to verify Master Password
    if let Err(e) = crate::application::host_service::list_hosts(app.clone()) {
        if let AppError::SecureStore(_) = e {
            return Err(AppError::Internal("Pulled successfully, but Master Password is incorrect for this data. Please update your Encryption Key to match the cloud data.".into()));
        }
        return Err(e);
    }

    // 3. Notify frontend to refresh host lists
    let _ = app.emit("hosts-changed", ());

    Ok(())
}

#[tauri::command]
pub async fn test_github_token(token: String) -> Result<(), AppError> {
    GithubService::test_token(&token).await
}
