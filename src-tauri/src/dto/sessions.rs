use crate::domain::session::Session;
use serde::Serialize;

/// Output DTO for session information.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionResponse {
    pub id: String,
    pub title: String,
    pub kind: String,
    pub status: String,
}

impl From<Session> for SessionResponse {
    fn from(s: Session) -> Self {
        Self {
            id: s.id,
            title: s.title,
            kind: s.kind,
            status: s.status,
        }
    }
}
