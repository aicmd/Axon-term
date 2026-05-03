use std::path::PathBuf;
use tauri::{AppHandle, Manager};
use crate::app::errors::AppError;
use std::fs;

pub fn get_app_data_dir(app: &AppHandle) -> Result<PathBuf, AppError> {
    let path = app.path().app_data_dir()
        .map_err(|e| AppError::Io(format!("Could not resolve app data directory: {}", e)))?;
    
    if !path.exists() {
        fs::create_dir_all(&path).map_err(|e| AppError::Io(format!("Could not create app data directory: {}", e)))?;
    }
    
    Ok(path)
}

pub fn get_hosts_path(app: &AppHandle) -> Result<PathBuf, AppError> {
    Ok(get_app_data_dir(app)?.join("hosts.json"))
}

pub fn get_secure_config_path(app: &AppHandle) -> Result<PathBuf, AppError> {
    Ok(get_app_data_dir(app)?.join("secure_config.json"))
}

/// Expands the tilde (~) character at the beginning of a path string to the user's home directory.
pub fn expand_tilde(path: &str) -> PathBuf {
    if path == "~" {
        return std::env::var("HOME")
            .map(PathBuf::from)
            .unwrap_or_else(|_| PathBuf::from(path));
    }

    if let Some(rest) = path.strip_prefix("~/") {
        if let Ok(home) = std::env::var("HOME") {
            return PathBuf::from(home).join(rest);
        }
    }

    PathBuf::from(path)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;

    #[test]
    fn test_expand_tilde() {
        // Mock HOME for the test if possible, or just check relative behaviors
        let home = env::var("HOME").unwrap_or_else(|_| "/home/user".to_string());
        
        // Exact match
        assert_eq!(expand_tilde("~"), PathBuf::from(&home));
        
        // Prefix match
        assert_eq!(expand_tilde("~/documents"), PathBuf::from(&home).join("documents"));
        
        // No match
        assert_eq!(expand_tilde("/etc/hosts"), PathBuf::from("/etc/hosts"));
        assert_eq!(expand_tilde("relative/path"), PathBuf::from("relative/path"));
    }
}
