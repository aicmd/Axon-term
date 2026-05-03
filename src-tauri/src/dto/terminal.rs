use serde::{Deserialize, Serialize};

/// Input DTO for opening a terminal session.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenTerminalRequest {
    pub session_id: String,
    pub cols: u16,
    pub rows: u16,
    pub host_id: Option<String>,
    pub term_type: Option<String>,
}

/// Output DTO returned after a terminal session is opened.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenTerminalResponse {
    pub session_id: String,
    pub status: String,
    pub kind: String,
}

/// Event payload emitted when terminal output is received.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalOutputPayload {
    pub session_id: String,
    pub data: String,
}

/// Event payload emitted when session state changes.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionStatePayload {
    pub session_id: String,
    pub status: String,
    pub message: Option<String>,
}
