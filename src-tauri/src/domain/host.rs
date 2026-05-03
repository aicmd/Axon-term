use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PortForward {
    pub local_port: u16,
    pub remote_address: String,
    pub remote_port: u16,
}

/// Core domain model for a remote host configuration.
/// Passwords and keys are stored here for SSH connection use.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Host {
    pub id: String,
    pub name: String,
    pub address: String,
    pub port: u16,
    pub username: String,
    pub auth_type: String,
    pub password: Option<String>,
    pub private_key_path: Option<String>,
    pub passphrase: Option<String>,
    pub group: Option<String>,
    pub os: Option<String>,
    pub port_forwards: Option<Vec<PortForward>>,
}
