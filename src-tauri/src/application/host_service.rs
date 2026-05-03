use crate::app::errors::AppError;
use crate::app::ssh_pool;
use crate::app::state::AppState;
use crate::domain::host::Host;
use crate::dto::hosts::{CreateHostRequest, HostMetricsResponse};
use crate::infrastructure::secure_store::crypto::CryptoManager;
use crate::infrastructure::secure_store::keyring::KeyringManager;
use rand::Rng;
use base64::{engine::general_purpose, Engine as _};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager};

use crate::utils::validation::{detect_os_by_username, normalize_optional};

#[derive(Serialize, Deserialize)]
struct EncryptedHosts {
    version: u32,
    salt: String,
    nonce: String,
    data: String, // Base64 encoded encrypted data
}

fn default_hosts() -> Vec<Host> {
    vec![Host {
        id: "local-dev".into(),
        name: "Local Development".into(),
        address: "127.0.0.1".into(),
        port: 22,
        username: "developer".into(),
        auth_type: "password".into(),
        password: None,
        private_key_path: None,
        passphrase: None,
        group: Some("Local".into()),
        os: Some("linux".into()),
        port_forwards: None,
    }]
}

pub(crate) fn hosts_file_path(app: &AppHandle) -> Result<PathBuf, AppError> {
    crate::utils::paths::get_hosts_path(app)
}

fn get_or_create_master_password(app: &AppHandle) -> Result<String, AppError> {
    // Check KeyringManager (secure_config.json)
    if let Ok(Some(pw)) = KeyringManager::get_password(app) {
        if !pw.trim().is_empty() {
            return Ok(pw.trim().to_string());
        }
    }

    // Generate New Password if none exists
    let new_pw: String = rand::thread_rng()
        .sample_iter(&rand::distributions::Alphanumeric)
        .take(32)
        .map(char::from)
        .collect();
    
    KeyringManager::save_password(app, &new_pw)?;
    Ok(new_pw)
}

pub fn change_master_password(app: AppHandle, new_password: &str) -> Result<(), AppError> {
    // 1. Try to read existing hosts with the current password
    // If we can read them, we'll re-encrypt them with the new password.
    // If we CANNOT read them (decryption failure), we just update the keyring password.
    // This allows a user to 'fix' an incorrect local password to match a pulled file.
    match list_hosts(app.clone()) {
        Ok(hosts) => {
            // Success: User is actually CHANGING a known password.
            // Update password and re-encrypt the data.
            KeyringManager::save_password(&app, new_password)?;
            write_hosts(&app, &hosts)?;
        }
        Err(AppError::SecureStore(_)) => {
            // Decryption failure: User is likely providing the CORRECT password 
            // for a file they couldn't read before (e.g. after a pull).
            // Just save the password and don't overwrite the file.
            KeyringManager::save_password(&app, new_password)?;
            // Invalidate cache so next read re-attempts decryption with new password
            invalidate_cache(&app);
        }
        Err(e) => return Err(e),
    }
    
    Ok(())
}

fn write_hosts(app: &AppHandle, hosts: &[Host]) -> Result<(), AppError> {
    let path = hosts_file_path(app)?;
    let password = get_or_create_master_password(app)?;
    let salt = CryptoManager::generate_salt();
    
    let key = CryptoManager::derive_key(&password, &salt)?;
    
    let json_bytes = serde_json::to_vec(hosts)?;
    let (ciphertext, nonce_bytes) = CryptoManager::encrypt(&json_bytes, &key)?;
    
    let encrypted_storage = EncryptedHosts {
        version: 1,
        salt,
        nonce: general_purpose::STANDARD.encode(nonce_bytes),
        data: general_purpose::STANDARD.encode(ciphertext),
    };

    let content = serde_json::to_string_pretty(&encrypted_storage)?;
    fs::write(path, content)?;

    // Update in-memory cache
    if let Some(state) = app.try_state::<AppState>() {
        if let Ok(mut cache) = state.hosts_cache.write() {
            *cache = Some(hosts.to_vec());
        }
    }

    Ok(())
}

pub fn list_hosts(app: AppHandle) -> Result<Vec<Host>, AppError> {
    // Check in-memory cache first (avoids disk I/O + Argon2 key derivation)
    if let Some(state) = app.try_state::<AppState>() {
        if let Ok(cache) = state.hosts_cache.read() {
            if let Some(hosts) = cache.as_ref() {
                return Ok(hosts.clone());
            }
        }
    }

    let path = hosts_file_path(&app)?;
    if !path.exists() {
        let hosts = default_hosts();
        write_hosts(&app, &hosts)?;
        return Ok(hosts);
    }

    let content = fs::read_to_string(&path)?;
    if content.trim().is_empty() {
        let hosts = default_hosts();
        write_hosts(&app, &hosts)?;
        return Ok(hosts);
    }

    // Try to parse as encrypted format
    if let Ok(encrypted) = serde_json::from_str::<EncryptedHosts>(&content) {
        let password = get_or_create_master_password(&app)?;
        let key = CryptoManager::derive_key(&password, &encrypted.salt)?;
        
        let nonce_result = general_purpose::STANDARD.decode(&encrypted.nonce);
        let data_result = general_purpose::STANDARD.decode(&encrypted.data);
        
        if let (Ok(nonce_bytes), Ok(ciphertext)) = (nonce_result, data_result) {
            if let Ok(plaintext) = CryptoManager::decrypt(&ciphertext, &key, &nonce_bytes) {
                if let Ok(hosts) = serde_json::from_slice::<Vec<Host>>(&plaintext) {
                    // Populate cache on successful decrypt
                    if let Some(state) = app.try_state::<AppState>() {
                        if let Ok(mut cache) = state.hosts_cache.write() {
                            *cache = Some(hosts.clone());
                        }
                    }
                    return Ok(hosts);
                }
            }
        }
        
        // Decryption failed — key mismatch or corrupted data.
        // In cloud sync scenarios, this usually means the Master Password in the UI 
        // doesn't match the one used to encrypt the synced file.
        // We return an error so the UI can inform the user, rather than wiping the file.
        return Err(AppError::SecureStore("Decryption failed. Please verify your Master Password in settings.".into()));
    }

    // Fallback: plain text migration path
    if let Ok(hosts) = serde_json::from_str::<Vec<Host>>(&content) {
        write_hosts(&app, &hosts)?;
        return Ok(hosts);
    }

    // If we reach here, it's either not a valid JSON or migration failed
    Err(AppError::Internal("The hosts file is corrupted or in an unknown format.".into()))
}

/// Clears the in-memory hosts cache, forcing the next `list_hosts` to read from disk.
/// Call this after external changes to the hosts file (e.g. GitHub sync pull).
pub fn invalidate_cache(app: &AppHandle) {
    if let Some(state) = app.try_state::<AppState>() {
        if let Ok(mut cache) = state.hosts_cache.write() {
            *cache = None;
        }
    }
}

pub fn create_host(app: AppHandle, input: CreateHostRequest) -> Result<Host, AppError> {
    let mut hosts = list_hosts(app.clone())?;
    let auth_type = input.auth_type;
    let password = normalize_optional(input.password);
    let private_key_path = normalize_optional(input.private_key_path);
    let passphrase = normalize_optional(input.passphrase);
    let group = normalize_optional(input.group);
    let os = normalize_optional(input.os).or_else(|| detect_os_by_username(&input.username));

    if auth_type == "password" && password.is_none() {
        return Err(AppError::HostValidation("password auth requires a password".into()));
    }

    if auth_type == "key" && private_key_path.is_none() {
        return Err(AppError::HostValidation("key auth requires a private key path".into()));
    }

    let host = Host {
        id: format!(
            "host-{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .map_err(|err| AppError::Internal(err.to_string()))?
                .as_millis()
        ),
        name: input.name,
        address: input.address,
        port: input.port,
        username: input.username,
        auth_type,
        password,
        private_key_path,
        passphrase,
        group,
        os,
        port_forwards: input.port_forwards,
    };

    hosts.push(host.clone());
    write_hosts(&app, &hosts)?;
    Ok(host)
}

pub fn update_host(app: AppHandle, id: &str, input: CreateHostRequest) -> Result<Host, AppError> {
    let mut hosts = list_hosts(app.clone())?;
    let auth_type = input.auth_type;
    let password = normalize_optional(input.password);
    let private_key_path = normalize_optional(input.private_key_path);
    let passphrase = normalize_optional(input.passphrase);
    let group = normalize_optional(input.group);
    let os = normalize_optional(input.os).or_else(|| detect_os_by_username(&input.username));

    if auth_type == "password" && password.is_none() {
        return Err(AppError::HostValidation("password auth requires a password".into()));
    }

    if auth_type == "key" && private_key_path.is_none() {
        return Err(AppError::HostValidation("key auth requires a private key path".into()));
    }

    let host = hosts
        .iter_mut()
        .find(|host| host.id == id)
        .ok_or_else(|| AppError::HostNotFound(id.into()))?;

    host.name = input.name;
    host.address = input.address;
    host.port = input.port;
    host.username = input.username;
    host.auth_type = auth_type;
    host.password = password;
    host.private_key_path = private_key_path;
    host.passphrase = passphrase;
    host.group = group;
    host.os = os;
    host.port_forwards = input.port_forwards;

    let updated = host.clone();
    write_hosts(&app, &hosts)?;
    ssh_pool::invalidate(&app, id);
    Ok(updated)
}

pub fn delete_host(app: AppHandle, id: &str) -> Result<(), AppError> {
    let mut hosts = list_hosts(app.clone())?;
    let original_len = hosts.len();
    hosts.retain(|host| host.id != id);

    if hosts.len() == original_len {
        return Err(AppError::HostNotFound(id.into()));
    }

    write_hosts(&app, &hosts)?;
    ssh_pool::invalidate(&app, id);
    Ok(())
}

pub fn update_os(app: AppHandle, id: &str, os: String) -> Result<(), AppError> {
    let mut hosts = list_hosts(app.clone())?;
    let host = hosts
        .iter_mut()
        .find(|host| host.id == id)
        .ok_or_else(|| AppError::HostNotFound(id.into()))?;

    host.os = Some(os);
    write_hosts(&app, &hosts)
}

pub fn get_host(app: AppHandle, id: &str) -> Result<Host, AppError> {
    list_hosts(app)?
        .into_iter()
        .find(|host| host.id == id)
        .ok_or_else(|| AppError::HostNotFound(id.into()))
}

pub fn test_connection(app: AppHandle, id: &str) -> Result<String, AppError> {
    let host = get_host(app.clone(), id)?;
    let banner = ssh_pool::with_session(&app, &host, |session| {
        Ok(session.banner().unwrap_or("ssh connection established").to_string())
    })?;
    Ok(format!("Connected to {}@{}:{} ({banner})", host.username, host.address, host.port))
}

pub fn get_remote_metrics(app: AppHandle, id: &str) -> Result<HostMetricsResponse, AppError> {
    use std::io::Read;
    let host = get_host(app.clone(), id)?;

    // Command based on OS. Uses a 1-second delay for CPU accuracy on Linux.
    let cmd = if host.os.as_deref() == Some("macos") {
        "ps -A -o %cpu | awk '{s+=$1} END {print s/100}' && vm_stat | awk '/Pages free:/ {free=$3} /Pages active:/ {active=$3} /Pages inactive:/ {inactive=$3} /Pages wired down:/ {wired=$4} END {total=free+active+inactive+wired; print ((total-free)/total)*100}'"
    } else {
        "vmstat 1 2 | tail -1 | awk '{print 100 - $15}' && free | awk '/Mem:/ {print $3/$2 * 100.0}'"
    };

    let output = ssh_pool::with_session(&app, &host, |session| {
        let mut channel = session.channel_session().map_err(|e| e.to_string())?;
        channel.exec(cmd).map_err(|e| e.to_string())?;
        let mut result = String::new();
        channel.read_to_string(&mut result).map_err(|e| e.to_string())?;
        channel.wait_close().map_err(|e| e.to_string())?;
        Ok(result)
    })?;

    let lines: Vec<&str> = output.trim().lines().collect();
    if lines.len() >= 2 {
        let cpu = lines[0].trim().parse::<f64>().unwrap_or(0.0);
        let ram = lines[1].trim().parse::<f64>().unwrap_or(0.0);
        Ok(HostMetricsResponse { cpu, ram })
    } else {
        Ok(HostMetricsResponse { cpu: 0.0, ram: 0.0 })
    }
}

pub fn get_remote_shell_history(app: AppHandle, id: &str) -> Result<Vec<crate::utils::history::ParsedHistoryItem>, AppError> {
    use std::io::Read;
    let host = get_host(app.clone(), id)?;

    let cmd = "cat ~/.bash_history ~/.zsh_history 2>/dev/null | tail -n 500";
    let output = ssh_pool::with_session(&app, &host, |session| {
        let mut channel = session.channel_session().map_err(|e| e.to_string())?;
        channel.exec(cmd).map_err(|e| e.to_string())?;
        let mut result = String::new();
        channel.read_to_string(&mut result).map_err(|e| e.to_string())?;
        channel.wait_close().map_err(|e| e.to_string())?;
        Ok(result)
    })?;

    Ok(crate::utils::history::parse_shell_history(&output, true, 300))
}
