use serde::Serialize;

/// Unified application error type.
///
/// All Tauri commands return `Result<T, AppError>` instead of `Result<T, String>`.
/// This allows the frontend to distinguish error categories and respond accordingly.
#[derive(Debug, thiserror::Error)]
pub enum AppError {
    // ── Host ───────────────────────────────────────────
    #[error("Host not found: {0}")]
    HostNotFound(String),

    #[error("Host validation failed: {0}")]
    HostValidation(String),

    // ── SSH / Connection ──────────────────────────────
    #[error("SSH connection failed: {0}")]
    SshConnection(String),

    #[error("Authentication failed: {0}")]
    AuthFailed(String),

    // ── Terminal ──────────────────────────────────────
    #[error("Terminal session not found: {0}")]
    SessionNotFound(String),

    #[error("Terminal operation failed: {0}")]
    Terminal(String),

    // ── SFTP / IO ────────────────────────────────────
    #[error("File operation failed: {0}")]
    Io(String),

    #[error("Invalid path: {0}")]
    InvalidPath(String),

    // ── Serialization ────────────────────────────────
    #[error("Serialization failed: {0}")]
    Serialization(String),

    // ── Security ──────────────────────────────────────
    #[error("Secure store failure: {0}")]
    SecureStore(String),

    // ── GitHub ────────────────────────────────────────
    #[error("GitHub API error: {0}")]
    GitHub(String),

    #[error("GitHub authentication failed: {0}")]
    GitHubAuth(String),

    #[error("GitHub sync failed: {0}")]
    GitHubSync(String),

    // ── SFTP ──────────────────────────────────────────
    #[error("SFTP error: {0}")]
    Sftp(String),

    // ── Generic ──────────────────────────────────────
    #[error("{0}")]
    Internal(String),
}

// ── Tauri IPC integration ────────────────────────────
// Tauri v2 requires command errors to implement `Serialize`.
impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

// ── Convenience conversions ──────────────────────────

impl From<std::io::Error> for AppError {
    fn from(err: std::io::Error) -> Self {
        AppError::Io(err.to_string())
    }
}

impl From<serde_json::Error> for AppError {
    fn from(err: serde_json::Error) -> Self {
        AppError::Serialization(err.to_string())
    }
}

impl From<ssh2::Error> for AppError {
    fn from(err: ssh2::Error) -> Self {
        AppError::SshConnection(err.to_string())
    }
}

/// Blanket conversion from String errors.
/// This bridges the gap with infrastructure functions (ssh_pool, etc.)
/// that still return `Result<_, String>`.
impl From<String> for AppError {
    fn from(err: String) -> Self {
        AppError::Internal(err)
    }
}
