use crate::app::errors::AppError;
use crate::application::sftp_service;
use crate::dto::sftp::ListEntriesResponse;
use tauri::AppHandle;

#[tauri::command]
pub async fn list_local_entries(path: Option<String>) -> Result<ListEntriesResponse, AppError> {
    sftp_service::list_local_entries(path)
}

#[tauri::command]
pub async fn list_entries(
    app: AppHandle,
    host_id: String,
    path: Option<String>,
) -> Result<ListEntriesResponse, AppError> {
    sftp_service::list_entries(app, &host_id, path)
}

#[tauri::command]
pub async fn download_file(
    app: AppHandle,
    host_id: String,
    remote_path: String,
    local_target: String,
) -> Result<String, AppError> {
    sftp_service::download_file(app, &host_id, &remote_path, &local_target)
}

#[tauri::command]
pub async fn upload_file(
    app: AppHandle,
    host_id: String,
    local_source: String,
    remote_directory: String,
) -> Result<String, AppError> {
    sftp_service::upload_file(app, &host_id, &local_source, &remote_directory)
}

#[tauri::command]
pub async fn create_local_directory(parent_path: String, name: String) -> Result<String, AppError> {
    sftp_service::create_local_directory(&parent_path, &name)
}

#[tauri::command]
pub async fn rename_local_entry(path: String, name: String) -> Result<String, AppError> {
    sftp_service::rename_local_entry(&path, &name)
}

#[tauri::command]
pub async fn delete_local_entry(path: String) -> Result<String, AppError> {
    sftp_service::delete_local_entry(&path)
}

#[tauri::command]
pub async fn create_remote_directory(
    app: AppHandle,
    host_id: String,
    parent_path: String,
    name: String,
) -> Result<String, AppError> {
    sftp_service::create_remote_directory(app, &host_id, &parent_path, &name)
}

#[tauri::command]
pub async fn rename_remote_entry(app: AppHandle, host_id: String, path: String, name: String) -> Result<String, AppError> {
    sftp_service::rename_remote_entry(app, &host_id, &path, &name)
}

#[tauri::command]
pub async fn delete_remote_entry(app: AppHandle, host_id: String, path: String) -> Result<String, AppError> {
    sftp_service::delete_remote_entry(app, &host_id, &path)
}
