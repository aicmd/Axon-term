use serde::{Deserialize, Serialize};

/// Domain model for an SFTP file/directory entry.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SftpEntry {
    pub path: String,
    pub name: String,
    pub kind: String,
    pub size: u64,
}
