use crate::app::errors::AppError;
use crate::app::state::AppState;
use crate::domain::host::Host;
use crate::infrastructure::ssh::{client as ssh_client, sftp as ssh_sftp};
use ssh2::{Session, Sftp};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Manager};

type SharedSession = Arc<Mutex<Session>>;

fn cached_session(app: &AppHandle, host_id: &str) -> Option<SharedSession> {
    let state = app.state::<AppState>();
    let sessions = state.ssh_sessions.read().ok()?;    sessions.get(host_id).cloned()
}

fn cache_session(app: &AppHandle, host_id: &str, session: SharedSession) {
    if let Some(state) = app.try_state::<AppState>() {
        if let Ok(mut sessions) = state.ssh_sessions.write() {
            sessions.insert(host_id.to_string(), session);
        }
    }
}

fn remove_session(app: &AppHandle, host_id: &str) {
    if let Some(state) = app.try_state::<AppState>() {
        if let Ok(mut sessions) = state.ssh_sessions.write() {
            sessions.remove(host_id);
        }
    }
}

fn is_session_alive(session: &SharedSession) -> bool {
    let Ok(guard) = session.lock() else {
        return false;
    };

    if !guard.authenticated() {
        return false;
    }

    guard.keepalive_send().is_ok()
}

pub fn invalidate(app: &AppHandle, host_id: &str) {
    remove_session(app, host_id);
}

pub fn get_or_connect(app: &AppHandle, host: &Host) -> Result<SharedSession, AppError> {
    if let Some(session) = cached_session(app, &host.id) {
        if is_session_alive(&session) {
            return Ok(session);
        }

        remove_session(app, &host.id);
    }
    
    let new_session = ssh_client::connect(host)?;

    let shared_session = Arc::new(Mutex::new(new_session));

    if let Some(forwards) = &host.port_forwards {
        for f in forwards {
            let session_clone = Arc::clone(&shared_session);
            let remote_host = f.remote_address.clone();
            if let Err(e) = crate::infrastructure::ssh::port_forward::start_local_forward(
                session_clone,
                f.local_port,
                remote_host,
                f.remote_port,
            ) {
                eprintln!("Warning: failed to start port forward for {}: {}", f.local_port, e);
            }
        }
    }
    if host.os.is_none() {
        if let Ok(mut session) = shared_session.lock() {
            if let Some(os) = ssh_client::detect_remote_os(&mut session) {
                let _ = crate::application::host_service::update_os(app.clone(), &host.id, os);
            }
        }
    }

    cache_session(app, &host.id, Arc::clone(&shared_session));

    Ok(shared_session)
}

pub fn with_session<T, F>(app: &AppHandle, host: &Host, operation: F) -> Result<T, AppError>
where
    F: FnOnce(&mut Session) -> Result<T, AppError>,
{
    let session = get_or_connect(app, host)?;
    let mut guard = session.lock().map_err(|err| AppError::Terminal(err.to_string()))?;
    operation(&mut guard)
}

pub fn with_sftp<T, F>(app: &AppHandle, host: &Host, operation: F) -> Result<T, AppError>
where
    F: FnOnce(&Sftp) -> Result<T, AppError>,
{
    let sftp = match get_or_connect(app, host) {
        Ok(session) => {
            let sftp_res = {
                let guard = session.lock().map_err(|err| AppError::Terminal(err.to_string()))?;
                ssh_sftp::open(&guard)
            };
            
            match sftp_res {
                Ok(s) => s,
                Err(e) => {
                    eprintln!("SFTP open failed: {}. Invalidating session and retrying...", e);
                    invalidate(app, &host.id);
                    // Retry with a fresh connection
                    let new_session = get_or_connect(app, host)?;
                    let guard = new_session.lock().map_err(|err| AppError::Terminal(err.to_string()))?;
                    ssh_sftp::open(&guard).map_err(AppError::SshConnection)?
                }
            }
        }
        Err(e) => return Err(e),
    };

    operation(&sftp)
}
