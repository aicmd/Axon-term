use crate::app::commands::PING_RESPONSE;
use crate::app::errors::AppError;
use crate::infrastructure::secure_store::keyring::KeyringManager;
use tauri::AppHandle;

#[tauri::command]
pub fn ping() -> &'static str {
    PING_RESPONSE
}

#[tauri::command]
pub fn get_secret_storage_mode() -> String {
    KeyringManager::get_mode_str().to_string()
}

#[tauri::command]
pub fn set_secret_storage_mode(app: AppHandle, mode: String) -> Result<(), AppError> {
    // Ensure file path is set (init may not have been called with this app handle)
    KeyringManager::ensure_file_path(&app);
    // switch_mode reads current data from cache, changes mode, and writes to the new backend
    KeyringManager::switch_mode(&mode)
}
