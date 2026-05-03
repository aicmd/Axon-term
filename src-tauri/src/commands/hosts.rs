use crate::app::errors::AppError;
use crate::application::host_service;
use crate::dto::hosts::{CreateHostRequest, HostMetricsResponse, HostResponse};
use tauri::{AppHandle, Emitter};

#[tauri::command]
pub fn list_hosts(app: AppHandle) -> Result<Vec<HostResponse>, AppError> {
    host_service::list_hosts(app).map(|hosts| hosts.into_iter().map(HostResponse::from).collect())
}

#[tauri::command]
pub fn create_host(app: AppHandle, input: CreateHostRequest) -> Result<HostResponse, AppError> {
    host_service::create_host(app, input).map(HostResponse::from)
}

#[tauri::command]
pub fn update_host(app: AppHandle, id: String, input: CreateHostRequest) -> Result<HostResponse, AppError> {
    host_service::update_host(app, &id, input).map(HostResponse::from)
}

#[tauri::command]
pub fn delete_host(app: AppHandle, id: String) -> Result<(), AppError> {
    host_service::delete_host(app, &id)
}

#[tauri::command]
pub fn test_host_connection(app: AppHandle, id: String) -> Result<String, AppError> {
    host_service::test_connection(app, &id)
}

#[tauri::command]
pub fn update_host_os(app: AppHandle, id: String, os: String) -> Result<(), AppError> {
    host_service::update_os(app, &id, os)
}

#[tauri::command]
pub fn get_remote_metrics(app: AppHandle, id: String) -> Result<HostMetricsResponse, AppError> {
    host_service::get_remote_metrics(app, &id)
}

#[tauri::command]
pub fn get_remote_shell_history(app: AppHandle, id: String) -> Result<Vec<crate::utils::history::ParsedHistoryItem>, AppError> {
    host_service::get_remote_shell_history(app, &id)
}

#[tauri::command]
pub fn change_master_password(app: AppHandle, new_password: String) -> Result<(), AppError> {
    host_service::change_master_password(app.clone(), &new_password)?;
    let _ = app.emit("hosts-changed", ());
    Ok(())
}
