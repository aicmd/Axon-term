use crate::domain::host::Host;
use crate::domain::session::Session as DomainSession;
use portable_pty::{Child, MasterPty};
use ssh2::Session;
use std::collections::HashMap;
use std::io::Write;
use std::sync::{Arc, Mutex, RwLock};
use tauri::{AppHandle, Manager};

pub struct TerminalSession {
    pub writer: Mutex<Box<dyn Write + Send>>,
    pub master: Mutex<Box<dyn MasterPty + Send>>,
    pub child: Mutex<Box<dyn Child + Send>>,
    pub password: Mutex<Option<String>>,
}

#[derive(Default)]
pub struct AppState {
    pub sessions: Arc<RwLock<HashMap<String, Arc<TerminalSession>>>>,
    pub ssh_sessions: RwLock<HashMap<String, Arc<Mutex<Session>>>>,
    pub session_meta: Arc<RwLock<HashMap<String, DomainSession>>>,
    /// In-memory cache of decrypted hosts. `None` = not yet loaded from disk.
    pub hosts_cache: RwLock<Option<Vec<Host>>>,
}

pub fn initialize(app: AppHandle) -> tauri::Result<()> {
    // Initialize keyring manager with file path and default mode
    // The frontend will call set_secret_storage_mode to override if needed
    use crate::infrastructure::secure_store::keyring::KeyringManager;
    KeyringManager::init(&app, "file");
    KeyringManager::migrate_from_legacy(&app);

    app.manage(AppState {
        sessions: Arc::new(RwLock::new(HashMap::new())),
        ssh_sessions: RwLock::new(HashMap::new()),
        session_meta: Arc::new(RwLock::new(HashMap::new())),
        hosts_cache: RwLock::new(None),
    });
    Ok(())
}
