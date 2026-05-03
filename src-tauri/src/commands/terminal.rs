use crate::app::errors::AppError;
use crate::app::state::AppState;
use crate::application::terminal_service;
use crate::dto::terminal::{OpenTerminalRequest, OpenTerminalResponse};
use tauri::{AppHandle, State};

#[tauri::command]
pub async fn open_terminal(
    app: AppHandle,
    state: State<'_, AppState>,
    session_id: String,
    cols: u16,
    rows: u16,
    host_id: Option<String>,
    term_type: Option<String>,
) -> Result<OpenTerminalResponse, AppError> {
    terminal_service::open(
        app,
        state,
        OpenTerminalRequest {
            session_id,
            cols,
            rows,
            host_id,
            term_type,
        },
    )
}

#[tauri::command]
pub async fn write_terminal(
    state: State<'_, AppState>,
    session_id: String,
    input: String,
) -> Result<(), AppError> {
    terminal_service::write_input(state, &session_id, &input)
}

#[tauri::command]
pub async fn resize_terminal(
    state: State<'_, AppState>,
    session_id: String,
    cols: u16,
    rows: u16,
) -> Result<(), AppError> {
    terminal_service::resize(state, &session_id, cols, rows)
}

#[tauri::command]
pub async fn close_terminal(state: State<'_, AppState>, session_id: String) -> Result<(), AppError> {
    terminal_service::close(state, &session_id)
}

#[tauri::command]
pub async fn get_server_commands(
    app: AppHandle,
    _session_id: String,
    host_id: Option<String>,
) -> Result<Vec<String>, AppError> {
    terminal_service::get_server_commands(app, host_id.as_deref()).await
}

#[tauri::command]
pub fn get_shell_history() -> Result<Vec<crate::utils::history::ParsedHistoryItem>, AppError> {
    terminal_service::get_shell_history()
}
