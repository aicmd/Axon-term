use crate::app::errors::AppError;
use crate::app::state::AppState;
use crate::dto::sessions::SessionResponse;
use tauri::State;

pub fn list_sessions(state: State<'_, AppState>) -> Result<Vec<SessionResponse>, AppError> {
    let meta = state.session_meta.read().map_err(|err| AppError::Terminal(err.to_string()))?;
    let mut sessions: Vec<SessionResponse> = meta.values().cloned().map(SessionResponse::from).collect();
    sessions.sort_by(|a, b| a.id.cmp(&b.id));
    Ok(sessions)
}
