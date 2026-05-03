use crate::app::errors::AppError;
use crate::app::state::AppState;
use crate::application::session_service;
use crate::dto::sessions::SessionResponse;
use tauri::State;

#[tauri::command]
pub fn list_sessions(state: State<'_, AppState>) -> Result<Vec<SessionResponse>, AppError> {
    session_service::list_sessions(state)
}
