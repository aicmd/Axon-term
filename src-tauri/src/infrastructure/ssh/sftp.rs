use crate::domain::sftp::SftpEntry;
use ssh2::{FileStat, Session, Sftp};
use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};

const FILE_TYPE_MASK: u32 = 0o170000;
const DIRECTORY_MODE: u32 = 0o040000;
const SYMLINK_MODE: u32 = 0o120000;

fn is_directory(stat: &FileStat) -> bool {
    matches!(stat.perm.map(|mode| mode & FILE_TYPE_MASK), Some(DIRECTORY_MODE))
}

fn is_symlink(stat: &FileStat) -> bool {
    matches!(stat.perm.map(|mode| mode & FILE_TYPE_MASK), Some(SYMLINK_MODE))
}

fn to_entry(current_path: &str, path: PathBuf, stat: FileStat) -> Option<SftpEntry> {
    let name = path.file_name()?.to_string_lossy().to_string();
    if name == "." || name == ".." {
        return None;
    }

    let kind = match stat.perm.map(|mode| mode & FILE_TYPE_MASK) {
        Some(DIRECTORY_MODE) => "directory",
        Some(SYMLINK_MODE) => "symlink",
        _ => "file",
    };

    Some(SftpEntry {
        path: if current_path == "/" {
            format!("/{name}")
        } else {
            format!("{current_path}/{name}")
        },
        name,
        kind: kind.into(),
        size: stat.size.unwrap_or_default(),
    })
}

pub fn open(session: &Session) -> Result<Sftp, String> {
    session.sftp().map_err(|err| format!("failed to start sftp subsystem: {}", err))
}

pub fn canonicalize(sftp: &Sftp, path: &Path) -> Result<PathBuf, String> {
    sftp.realpath(path)
        .map_err(|err| format!("failed to resolve remote path {}: {}", path.display(), err))
}

pub fn list_entries(sftp: &Sftp, path: &Path) -> Result<(String, Vec<SftpEntry>), String> {
    let canonical = canonicalize(sftp, path)?;
    let current_path = canonical.to_string_lossy().to_string();
    let mut entries = sftp
        .readdir(&canonical)
        .map_err(|err| format!("failed to read remote directory {}: {}", current_path, err))?
        .into_iter()
        .filter_map(|(entry_path, stat)| to_entry(&current_path, entry_path, stat))
        .collect::<Vec<_>>();

    entries.sort_by(|left, right| left.kind.cmp(&right.kind).then(left.name.cmp(&right.name)));
    Ok((current_path, entries))
}

pub fn download_file<F>(sftp: &Sftp, remote_path: &Path, local_destination: &Path, mut on_progress: F) -> Result<(), String>
where
    F: FnMut(u64, u64),
{
    if let Some(parent) = local_destination.parent() {
        fs::create_dir_all(parent).map_err(|err| err.to_string())?;
    }

    let mut remote = sftp
        .open(remote_path)
        .map_err(|err| format!("failed to open remote file {}: {}", remote_path.display(), err))?;
    
    let stat = remote.stat().map_err(|err| format!("failed to stat remote file {}: {}", remote_path.display(), err))?;
    let total_size = stat.size.unwrap_or(0);

    let mut local = File::create(local_destination)
        .map_err(|err| format!("failed to create local file {}: {}", local_destination.display(), err))?;

    let mut buffer = [0u8; 65536]; // 64KB chunks
    let mut transferred = 0u64;

    loop {
        let n = remote.read(&mut buffer).map_err(|err| format!("failed to read remote file: {}", err))?;
        if n == 0 {
            break;
        }
        local.write_all(&buffer[..n]).map_err(|err| format!("failed to write local file: {}", err))?;
        transferred += n as u64;
        on_progress(transferred, total_size);
    }

    Ok(())
}

pub fn upload_file<F>(sftp: &Sftp, local_source: &Path, remote_destination: &Path, mut on_progress: F) -> Result<(), String>
where
    F: FnMut(u64, u64),
{
    let mut local = File::open(local_source)
        .map_err(|err| format!("failed to open local file {}: {}", local_source.display(), err))?;
    
    let metadata = local.metadata().map_err(|err| format!("failed to read metadata for {}: {}", local_source.display(), err))?;
    let total_size = metadata.len();

    let mut remote = sftp
        .create(remote_destination)
        .map_err(|err| format!("failed to create remote file {}: {}", remote_destination.display(), err))?;

    let mut buffer = [0u8; 65536]; // 64KB chunks
    let mut transferred = 0u64;

    loop {
        let n = local.read(&mut buffer).map_err(|err| format!("failed to read local file: {}", err))?;
        if n == 0 {
            break;
        }
        remote.write_all(&buffer[..n]).map_err(|err| format!("failed to write remote file: {}", err))?;
        transferred += n as u64;
        on_progress(transferred, total_size);
    }

    Ok(())
}

pub fn create_directory(sftp: &Sftp, remote_path: &Path) -> Result<(), String> {
    sftp.mkdir(remote_path, 0o755)
        .map_err(|err| format!("failed to create remote directory {}: {}", remote_path.display(), err))
}

pub fn rename_entry(sftp: &Sftp, source_path: &Path, target_path: &Path) -> Result<(), String> {
    sftp.rename(source_path, target_path, None).map_err(|err| {
        format!(
            "failed to rename remote entry {} to {}: {}",
            source_path.display(),
            target_path.display(),
            err
        )
    })
}

pub fn delete_entry(sftp: &Sftp, remote_path: &Path) -> Result<(), String> {
    let stat = sftp
        .lstat(remote_path)
        .map_err(|err| format!("failed to inspect remote path {}: {}", remote_path.display(), err))?;

    if is_symlink(&stat) {
        return sftp
            .unlink(remote_path)
            .map_err(|err| format!("failed to delete remote link {}: {}", remote_path.display(), err));
    }

    if is_directory(&stat) {
        let canonical = canonicalize(sftp, remote_path)?;
        for (entry_path, entry_stat) in sftp
            .readdir(&canonical)
            .map_err(|err| format!("failed to read remote directory {}: {}", canonical.display(), err))?
        {
            let Some(name) = entry_path.file_name().and_then(|value| value.to_str()) else {
                continue;
            };

            if name == "." || name == ".." {
                continue;
            }

            let child_path = canonical.join(name);
            if is_directory(&entry_stat) && !is_symlink(&entry_stat) {
                delete_entry(sftp, &child_path)?;
            } else {
                sftp.unlink(&child_path).map_err(|err| {
                    format!("failed to delete remote file {}: {}", child_path.display(), err)
                })?;
            }
        }

        return sftp
            .rmdir(&canonical)
            .map_err(|err| format!("failed to remove remote directory {}: {}", canonical.display(), err));
    }

    sftp
        .unlink(remote_path)
        .map_err(|err| format!("failed to delete remote file {}: {}", remote_path.display(), err))
}
