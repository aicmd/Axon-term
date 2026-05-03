use crate::domain::sftp::SftpEntry;
use serde::Serialize;

/// Output DTO for SFTP directory listing.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListEntriesResponse {
    pub current_path: String,
    pub entries: Vec<SftpEntry>,
}

/// Event payload emitted during file transfer progress.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TransferProgressPayload {
    pub filename: String,
    pub transferred: u64,
    pub total: u64,
}
