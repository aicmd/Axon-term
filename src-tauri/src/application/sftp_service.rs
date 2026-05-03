use crate::app::errors::AppError;
use crate::application::host_service;
use crate::app::ssh_pool;
use crate::dto::sftp::{ListEntriesResponse, TransferProgressPayload};
use crate::infrastructure::ssh::sftp as ssh_sftp;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Emitter};


fn sort_entries(entries: &mut [crate::domain::sftp::SftpEntry]) {
    entries.sort_by(|left, right| left.kind.cmp(&right.kind).then(left.name.cmp(&right.name)));
}

fn ensure_entry_name(name: &str) -> Result<&str, AppError> {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return Err(AppError::InvalidPath("name cannot be empty".into()));
    }

    if trimmed.contains('/') || trimmed == "." || trimmed == ".." {
        return Err(AppError::InvalidPath("name contains invalid path segments".into()));
    }

    Ok(trimmed)
}

pub fn list_local_entries(path: Option<String>) -> Result<ListEntriesResponse, AppError> {
    let requested = path
        .as_deref()
        .map(crate::utils::paths::expand_tilde)
        .or_else(|| std::env::var("HOME").ok().map(PathBuf::from))
        .unwrap_or_else(|| PathBuf::from("."));

    let canonical = requested
        .canonicalize()
        .map_err(|err| AppError::InvalidPath(format!("failed to resolve local path {}: {}", requested.display(), err)))?;

    if !canonical.is_dir() {
        return Err(AppError::InvalidPath(format!("local path is not a directory: {}", canonical.display())));
    }

    let current_path = canonical.to_string_lossy().to_string();
    let mut entries = fs::read_dir(&canonical)
        .map_err(|err| AppError::Io(format!("failed to read local directory {}: {}", canonical.display(), err)))?
        .filter_map(|entry| {
            let entry = entry.ok()?;
            let path = entry.path();
            let metadata = entry.metadata().ok()?;
            let name = entry.file_name().to_string_lossy().to_string();
            let kind = if metadata.is_dir() {
                "directory"
            } else if metadata.is_file() {
                "file"
            } else {
                "symlink"
            };

            Some(crate::domain::sftp::SftpEntry {
                path: path.to_string_lossy().to_string(),
                name,
                kind: kind.into(),
                size: metadata.len(),
            })
        })
        .collect::<Vec<_>>();

    sort_entries(&mut entries);

    Ok(ListEntriesResponse { current_path, entries })
}

pub fn create_local_directory(parent_path: &str, name: &str) -> Result<String, AppError> {
    let directory_name = ensure_entry_name(name)?;
    let parent = crate::utils::paths::expand_tilde(parent_path);
    let target = parent.join(directory_name);

    fs::create_dir(&target)
        .map_err(|err| AppError::Io(format!("failed to create local directory {}: {}", target.display(), err)))?;

    Ok(format!("Created local directory {}", target.display()))
}

pub fn rename_local_entry(path: &str, name: &str) -> Result<String, AppError> {
    let entry_name = ensure_entry_name(name)?;
    let source = crate::utils::paths::expand_tilde(path);
    let parent = source
        .parent()
        .ok_or_else(|| AppError::InvalidPath(format!("cannot rename root path: {}", source.display())))?;
    let target = parent.join(entry_name);

    fs::rename(&source, &target).map_err(|err| {
        AppError::Io(format!(
            "failed to rename local entry {} to {}: {}",
            source.display(),
            target.display(),
            err
        ))
    })?;

    Ok(format!("Renamed to {}", target.display()))
}

pub fn delete_local_entry(path: &str) -> Result<String, AppError> {
    let target = crate::utils::paths::expand_tilde(path);
    let metadata = fs::symlink_metadata(&target)
        .map_err(|err| AppError::Io(format!("failed to inspect local path {}: {}", target.display(), err)))?;

    if metadata.is_dir() {
        fs::remove_dir_all(&target)
            .map_err(|err| AppError::Io(format!("failed to delete local directory {}: {}", target.display(), err)))?;
    } else {
        fs::remove_file(&target)
            .map_err(|err| AppError::Io(format!("failed to delete local file {}: {}", target.display(), err)))?;
    }

    Ok(format!("Deleted {}", target.display()))
}


pub fn list_entries(
    app: AppHandle,
    host_id: &str,
    path: Option<String>,
) -> Result<ListEntriesResponse, AppError> {
    let host = host_service::get_host(app.clone(), host_id)?;
    ssh_pool::with_sftp(&app, &host, |sftp| {
        let (current_path, entries) = ssh_sftp::list_entries(sftp, Path::new(path.as_deref().unwrap_or("."))).map_err(AppError::Sftp)?;
        Ok(ListEntriesResponse { current_path, entries })
    })
}

pub fn download_file(
    app: AppHandle,
    host_id: &str,
    remote_path: &str,
    local_target: &str,
) -> Result<String, AppError> {
    let host = host_service::get_host(app.clone(), host_id)?;
    ssh_pool::with_sftp(&app, &host, |sftp| {
        let requested = crate::utils::paths::expand_tilde(local_target);
        let remote_name = Path::new(remote_path)
            .file_name()
            .and_then(|value| value.to_str())
            .ok_or_else(|| AppError::InvalidPath("Invalid remote file path".into()))?;

        let destination = if local_target.ends_with('/') || requested.is_dir() {
            requested.join(remote_name)
        } else {
            requested
        };

        if let Some(parent) = destination.parent() {
            fs::create_dir_all(parent).map_err(|err| AppError::Io(format!("Failed to create local directory: {}", err)))?;
        }

        let filename = remote_name.to_string();
        let app_clone = app.clone();
        
        let emit_progress = move |transferred: u64, total: u64| {
            let _ = app_clone.emit("transfer-progress", TransferProgressPayload {
                filename: filename.clone(),
                transferred,
                total,
            });
        };

        ssh_sftp::download_file(sftp, Path::new(remote_path), &destination, emit_progress)?;

        Ok(format!("Downloaded to {}", destination.display()))
    })
}

pub fn upload_file(
    app: AppHandle,
    host_id: &str,
    local_source: &str,
    remote_directory: &str,
) -> Result<String, AppError> {
    let host = host_service::get_host(app.clone(), host_id)?;
    ssh_pool::with_sftp(&app, &host, |sftp| {
        let source = crate::utils::paths::expand_tilde(local_source);

        if !source.exists() {
            return Err(AppError::Io(format!("Local file not found: {}", source.display())));
        }

        let file_name = source
            .file_name()
            .ok_or_else(|| AppError::InvalidPath(format!("Invalid local file path: {}", source.display())))?;
        let remote_dir = ssh_sftp::canonicalize(sftp, Path::new(remote_directory)).map_err(AppError::Sftp)?;
        let remote_destination = remote_dir.join(file_name);
        let filename = file_name.to_string_lossy().to_string();
        let app_clone = app.clone();
        
        let emit_progress = move |transferred: u64, total: u64| {
            let _ = app_clone.emit("transfer-progress", TransferProgressPayload {
                filename: filename.clone(),
                transferred,
                total,
            });
        };

        ssh_sftp::upload_file(sftp, &source, &remote_destination, emit_progress).map_err(AppError::Sftp)?;

        Ok(format!("Uploaded {}", source.display()))
    })
}

pub fn create_remote_directory(
    app: AppHandle,
    host_id: &str,
    parent_path: &str,
    name: &str,
) -> Result<String, AppError> {
    let directory_name = ensure_entry_name(name)?;
    let host = host_service::get_host(app.clone(), host_id)?;
    ssh_pool::with_sftp(&app, &host, |sftp| {
        let remote_parent = ssh_sftp::canonicalize(sftp, Path::new(parent_path)).map_err(AppError::Sftp)?;
        let remote_target = remote_parent.join(directory_name);

        ssh_sftp::create_directory(sftp, &remote_target).map_err(AppError::Sftp)?;

        Ok(format!("Created remote directory {}", remote_target.display()))
    })
}

pub fn rename_remote_entry(
    app: AppHandle,
    host_id: &str,
    path: &str,
    name: &str,
) -> Result<String, AppError> {
    let entry_name = ensure_entry_name(name)?;
    let host = host_service::get_host(app.clone(), host_id)?;
    ssh_pool::with_sftp(&app, &host, |sftp| {
        let source = ssh_sftp::canonicalize(sftp, Path::new(path)).map_err(AppError::Sftp)?;
        let parent = source
            .parent()
            .ok_or_else(|| AppError::InvalidPath(format!("Cannot rename remote root path: {}", source.display())))?;
        let target = parent.join(entry_name);

        ssh_sftp::rename_entry(sftp, &source, &target).map_err(AppError::Sftp)?;

        Ok(format!("Renamed to {}", target.display()))
    })
}

pub fn delete_remote_entry(app: AppHandle, host_id: &str, path: &str) -> Result<String, AppError> {
    let host = host_service::get_host(app.clone(), host_id)?;
    ssh_pool::with_sftp(&app, &host, |sftp| {
        let target = ssh_sftp::canonicalize(sftp, Path::new(path)).map_err(AppError::Sftp)?;

        ssh_sftp::delete_entry(sftp, &target).map_err(AppError::Sftp)?;

        Ok(format!("Deleted {}", target.display()))
    })
}
