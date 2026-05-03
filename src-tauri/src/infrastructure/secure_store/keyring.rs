use crate::app::errors::AppError;
use tauri::AppHandle;
use serde_json::{json, Value};
use std::sync::Mutex;
use std::path::PathBuf;

/// Storage backend mode.
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum StorageMode {
    /// Store secrets in a local JSON file (simple, no OS prompts)
    File,
    /// Store secrets in the OS keychain (macOS Keychain / Windows Credential Manager)
    Keychain,
}

const SERVICE: &str = "com.axon.term";
const ACCOUNT: &str = "secrets";

/// In-memory cache — shared by both backends.
/// `None` = cold start, needs to be loaded from the active backend.
static CACHE: Mutex<Option<Value>> = Mutex::new(None);

/// The resolved file path for the file-based backend.
static FILE_PATH: Mutex<Option<PathBuf>> = Mutex::new(None);

/// Current storage mode. Defaults to File.
static MODE: Mutex<StorageMode> = Mutex::new(StorageMode::File);

pub struct KeyringManager;

impl KeyringManager {
    // ── Initialization ───────────────────────────────────────

    /// Called once at startup. Sets up the file path and loads mode from settings.
    pub fn init(app: &AppHandle, mode_str: &str) {
        // Set file path
        if let Ok(path) = crate::utils::paths::get_secure_config_path(app) {
            if let Ok(mut fp) = FILE_PATH.lock() {
                *fp = Some(path);
            }
        }

        // Set mode
        let mode = match mode_str {
            "keychain" => StorageMode::Keychain,
            _ => StorageMode::File,
        };
        if let Ok(mut m) = MODE.lock() {
            *m = mode;
        }

        // Clear cache to force fresh load from the active backend
        if let Ok(mut c) = CACHE.lock() {
            *c = None;
        }
    }

    /// Ensures the file path is initialized. Safe to call multiple times.
    /// Does NOT change mode or clear cache.
    pub fn ensure_file_path(app: &AppHandle) {
        if let Ok(path) = crate::utils::paths::get_secure_config_path(app) {
            if let Ok(mut fp) = FILE_PATH.lock() {
                if fp.is_none() {
                    *fp = Some(path);
                }
            }
        }
    }

    fn current_mode() -> StorageMode {
        MODE.lock().map(|m| *m).unwrap_or(StorageMode::File)
    }

    fn keychain_entry() -> Result<keyring::Entry, AppError> {
        keyring::Entry::new(SERVICE, ACCOUNT)
            .map_err(|e| AppError::SecureStore(format!("Keychain access error: {}", e)))
    }

    fn file_path() -> Result<PathBuf, AppError> {
        FILE_PATH.lock()
            .map_err(|e| AppError::Internal(format!("Lock error: {}", e)))?
            .clone()
            .ok_or_else(|| AppError::Internal("File path not initialized".into()))
    }

    // ── Backend-specific read/write ──────────────────────────

    fn read_from_file() -> Result<Value, AppError> {
        let path = Self::file_path()?;
        if !path.exists() {
            return Ok(json!({}));
        }
        let content = std::fs::read_to_string(&path).unwrap_or_else(|_| "{}".to_string());
        Ok(serde_json::from_str(&content).unwrap_or_else(|_| json!({})))
    }

    fn write_to_file(data: &Value) -> Result<(), AppError> {
        let path = Self::file_path()?;
        if let Some(parent) = path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        let content = serde_json::to_string_pretty(data)
            .map_err(|e| AppError::Internal(e.to_string()))?;
        std::fs::write(&path, &content).map_err(|e| AppError::Io(e.to_string()))
    }

    fn read_from_keychain() -> Result<Value, AppError> {
        match Self::keychain_entry()?.get_password() {
            Ok(json_str) => serde_json::from_str(&json_str)
                .map_err(|e| AppError::SecureStore(format!("Keychain data corrupt: {}", e))),
            Err(keyring::Error::NoEntry) => Ok(json!({})),
            Err(e) => Err(AppError::SecureStore(format!("Keychain read error: {}", e))),
        }
    }

    fn write_to_keychain(data: &Value) -> Result<(), AppError> {
        let json_str = serde_json::to_string(data)
            .map_err(|e| AppError::Internal(e.to_string()))?;
        Self::keychain_entry()?
            .set_password(&json_str)
            .map_err(|e| AppError::SecureStore(format!("Keychain save error: {}", e)))
    }

    // ── Cached read/write (routes to active backend) ─────────

    fn read_store() -> Result<Value, AppError> {
        let mut cache = CACHE.lock().map_err(|e| AppError::Internal(format!("Cache lock: {}", e)))?;

        if let Some(data) = cache.as_ref() {
            return Ok(data.clone());
        }

        let data = match Self::current_mode() {
            StorageMode::File => Self::read_from_file()?,
            StorageMode::Keychain => Self::read_from_keychain()?,
        };

        *cache = Some(data.clone());
        Ok(data)
    }

    fn write_store(data: &Value) -> Result<(), AppError> {
        match Self::current_mode() {
            StorageMode::File => Self::write_to_file(data)?,
            StorageMode::Keychain => Self::write_to_keychain(data)?,
        }

        if let Ok(mut cache) = CACHE.lock() {
            *cache = Some(data.clone());
        }
        Ok(())
    }

    // ── Core operations ──────────────────────────────────────

    pub fn save_secret(_app: &AppHandle, account: &str, value: &str) -> Result<(), AppError> {
        let mut data = Self::read_store()?;
        if let Some(obj) = data.as_object_mut() {
            obj.insert(account.to_string(), json!(value));
        }
        Self::write_store(&data)
    }

    pub fn get_secret(_app: &AppHandle, account: &str) -> Result<Option<String>, AppError> {
        let data = Self::read_store()?;
        Ok(data[account].as_str().map(|s| s.to_string()))
    }

    pub fn delete_secret(_app: &AppHandle, account: &str) -> Result<(), AppError> {
        let mut data = Self::read_store()?;
        if let Some(obj) = data.as_object_mut() {
            obj.remove(account);
        }
        Self::write_store(&data)
    }

    // ── Mode switching with data migration ───────────────────

    /// Switches storage mode, migrating all secrets to the new backend.
    pub fn switch_mode(mode_str: &str) -> Result<(), AppError> {
        let new_mode = match mode_str {
            "keychain" => StorageMode::Keychain,
            _ => StorageMode::File,
        };

        if Self::current_mode() == new_mode {
            return Ok(());
        }

        // Read current data from the active backend
        let data = Self::read_store()?;

        // Switch mode
        if let Ok(mut m) = MODE.lock() {
            *m = new_mode;
        }

        // Write data to the new backend
        Self::write_store(&data)?;

        Ok(())
    }

    pub fn get_mode_str() -> &'static str {
        match Self::current_mode() {
            StorageMode::File => "file",
            StorageMode::Keychain => "keychain",
        }
    }

    // ── High-level accessors (unchanged interface) ───────────

    pub fn save_password(app: &AppHandle, password: &str) -> Result<(), AppError> { Self::save_secret(app, "master-password", password) }
    pub fn get_password(app: &AppHandle) -> Result<Option<String>, AppError> { Self::get_secret(app, "master-password") }

    pub fn save_gh_token(app: &AppHandle, token: &str) -> Result<(), AppError> { Self::save_secret(app, "github-token", token) }
    pub fn get_gh_token(app: &AppHandle) -> Result<Option<String>, AppError> { Self::get_secret(app, "github-token") }
    pub fn delete_gh_token(app: &AppHandle) -> Result<(), AppError> { Self::delete_secret(app, "github-token") }

    pub fn save_gh_gist_id(app: &AppHandle, id: &str) -> Result<(), AppError> { Self::save_secret(app, "github-gist-id", id) }
    pub fn get_gh_gist_id(app: &AppHandle) -> Result<Option<String>, AppError> { Self::get_secret(app, "github-gist-id") }
    pub fn delete_gh_gist_id(app: &AppHandle) -> Result<(), AppError> { Self::delete_secret(app, "github-gist-id") }

    // ── Legacy migration ─────────────────────────────────────

    /// Migrates secrets from the old `~/.nexus-term/secure_config.json` (legacy path)
    /// into the currently active backend.
    pub fn migrate_from_legacy(_app: &AppHandle) {
        // Check the old legacy path
        let legacy_path = if let Ok(home) = std::env::var("HOME") {
            let p = std::path::PathBuf::from(home).join(".nexus-term").join("secure_config.json");
            if p.exists() { Some(p) } else { None }
        } else {
            None
        };

        if let Some(path) = legacy_path {
            if let Ok(content) = std::fs::read_to_string(&path) {
                if let Ok(file_data) = serde_json::from_str::<Value>(&content) {
                    if let Some(file_obj) = file_data.as_object() {
                        let mut store = Self::read_store().unwrap_or_else(|_| json!({}));
                        if let Some(store_obj) = store.as_object_mut() {
                            for (key, value) in file_obj {
                                if !store_obj.contains_key(key) {
                                    store_obj.insert(key.clone(), value.clone());
                                }
                            }
                            let _ = Self::write_store(&store);
                        }
                    }
                }
                let _ = std::fs::remove_file(&path);
            }
        }
    }
}
