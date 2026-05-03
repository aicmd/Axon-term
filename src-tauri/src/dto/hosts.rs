use crate::domain::host::{Host, PortForward};
use serde::{Deserialize, Serialize};

/// Input DTO for creating or updating a host.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateHostRequest {
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

/// Output DTO for host information returned to the frontend.
///
/// For a desktop Tauri app the IPC channel is local, so we include
/// password / passphrase so the edit-form can be pre-filled.
/// In a server-side API these fields should be excluded.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HostResponse {
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

impl From<Host> for HostResponse {
    fn from(h: Host) -> Self {
        Self {
            id: h.id,
            name: h.name,
            address: h.address,
            port: h.port,
            username: h.username,
            auth_type: h.auth_type,
            password: h.password,
            private_key_path: h.private_key_path,
            passphrase: h.passphrase,
            group: h.group,
            os: h.os,
            port_forwards: h.port_forwards,
        }
    }
}

/// Output DTO for remote host metrics.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HostMetricsResponse {
    pub cpu: f64,
    pub ram: f64,
}
