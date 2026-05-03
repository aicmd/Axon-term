use crate::app::errors::AppError;
use crate::app::state::{AppState, TerminalSession};
use crate::application::host_service;

use crate::domain::session::Session as DomainSession;
use crate::dto::terminal::{
	OpenTerminalRequest, OpenTerminalResponse, SessionStatePayload, TerminalOutputPayload,
};
use crate::events::{session, terminal};
use portable_pty::{native_pty_system, CommandBuilder, PtySize};

use std::io::{Read, Write};
use std::sync::Arc;
use tauri::{AppHandle, Emitter, State};



fn emit_session_state(app: &AppHandle, payload: SessionStatePayload) {
	let _ = app.emit(session::STATE_CHANGED, payload);
}


fn build_command(app: &AppHandle, request: &OpenTerminalRequest) -> Result<(CommandBuilder, String, String, Option<String>), AppError> {
	if let Some(host_id) = &request.host_id {
		let host = host_service::get_host(app.clone(), host_id)?;
		let mut command = CommandBuilder::new("ssh");
		if let Some(private_key_path) = host.private_key_path.as_deref() {
			command.arg("-i");
			command.arg(crate::utils::paths::expand_tilde(private_key_path).to_string_lossy().to_string());
		}
		command.arg(format!("{}@{}", host.username, host.address));
		command.arg("-p");
		command.arg(host.port.to_string());
		
		let term = request.term_type.as_deref().unwrap_or("xterm-256color");
		command.env("TERM", term);

		command.arg("-o");
		command.arg("ServerAliveInterval=5");
		command.arg("-o");
		command.arg("ServerAliveCountMax=2");
		command.arg("-o");
		command.arg("ConnectTimeout=10");
		// 强制使用 TTY 以便密码提示能正确显示在 PTY
		command.arg("-t");
		command.arg("-t");
		return Ok((command, "ssh".into(), host.name.clone(), host.password.clone()));
	}

	let shell = if cfg!(target_os = "windows") {
		std::env::var("COMSPEC").unwrap_or_else(|_| "powershell.exe".into())
	} else {
		std::env::var("SHELL").unwrap_or_else(|_| "/bin/bash".into())
	};
	let mut command = CommandBuilder::new(shell);
	if !cfg!(target_os = "windows") {
		command.arg("-l");
	}

	let term = request.term_type.as_deref().unwrap_or("xterm-256color");
	command.env("TERM", term);

	Ok((command, "local".into(), "Local Shell".into(), None))
}

pub fn open(
	app: AppHandle,
	state: State<'_, AppState>,
	request: OpenTerminalRequest,
) -> Result<OpenTerminalResponse, AppError> {
	let existing = {
		let sessions = state.sessions.read().map_err(|err| AppError::Terminal(err.to_string()))?;
		sessions.get(&request.session_id).cloned()
	};

	if existing.is_some() {
		return Ok(OpenTerminalResponse {
			session_id: request.session_id,
			status: "active".into(),
			kind: if request.host_id.is_some() { "ssh".into() } else { "local".into() },
		});
	}

	let pty_system = native_pty_system();
	let pair = pty_system
		.openpty(PtySize {
			rows: request.rows.max(10),
			cols: request.cols.max(20),
			pixel_width: 0,
			pixel_height: 0,
		})
		.map_err(|err| AppError::Terminal(err.to_string()))?;

	emit_session_state(&app, SessionStatePayload {
		session_id: request.session_id.clone(),
		status: "connecting".into(),
		message: Some("Establishing tunnel...".into()),
	});

	let (command, session_kind, session_title, host_password) = match build_command(&app, &request) {
		Ok(res) => res,
		Err(err) => {
			emit_session_state(&app, SessionStatePayload {
				session_id: request.session_id.clone(),
				status: "error".into(),
				message: Some(format!("Connection failed: {}", err)),
			});
			return Err(err);
		}
	};

	if let Some(ref host_id) = request.host_id {
		let app_handle_bg = app.clone();
		let host_id_bg = host_id.clone();
		std::thread::spawn(move || {
			if let Ok(host) = crate::application::host_service::get_host(app_handle_bg.clone(), &host_id_bg) {
				if host.os.is_none() {
					let _ = crate::app::ssh_pool::get_or_connect(&app_handle_bg, &host);
				}
			}
		});
	}

	let child = pair
		.slave
		.spawn_command(command)
		.map_err(|err| AppError::Terminal(err.to_string()))?;

	let mut reader = pair.master.try_clone_reader().map_err(|err| AppError::Terminal(err.to_string()))?;
	let writer = pair.master.take_writer().map_err(|err| AppError::Terminal(err.to_string()))?;

	let session = Arc::new(TerminalSession {
		writer: std::sync::Mutex::new(writer),
		master: std::sync::Mutex::new(pair.master),
		child: std::sync::Mutex::new(child),
		password: std::sync::Mutex::new(host_password),
	});

	{
		let mut sessions = state.sessions.write().map_err(|err| AppError::Terminal(err.to_string()))?;
		sessions.insert(request.session_id.clone(), session.clone());
	}

	{
		let mut meta = state.session_meta.write().map_err(|err| AppError::Terminal(err.to_string()))?;
		meta.insert(
			request.session_id.clone(),
			DomainSession {
				id: request.session_id.clone(),
				title: session_title,
				kind: session_kind.clone(),
				status: "active".into(),
			},
		);
	}

	let app_handle = app.clone();
	let session_id = request.session_id.clone();
	let session_meta = Arc::clone(&state.session_meta);
	let sessions_map = Arc::clone(&state.sessions);
	let session_clone = Arc::clone(&session);

	std::thread::spawn(move || {
		emit_session_state(
			&app_handle,
			SessionStatePayload {
				session_id: session_id.clone(),
				status: "active".into(),
				message: None,
			},
		);

		let mut buffer = [0_u8; 8192];
		loop {
			// Check if this session is still active in the global map
			// If it's been removed or replaced, this thread should exit
			{
				if let Ok(sessions) = sessions_map.read() {
					match sessions.get(&session_id) {
						Some(current) if Arc::ptr_eq(current, &session_clone) => {
							// Still the active session, continue
						}
						_ => {
							// Session removed or replaced by a new one, exit thread
							break;
						}
					}
				}
			}

			match reader.read(&mut buffer) {
				Ok(0) => {
					let exit_msg = if let Ok(mut child) = session_clone.child.lock() {
						match child.wait() {
							Ok(status) => {
								if status.success() {
									"exited".to_string()
								} else {
									format!("exited with status: {}", status)
								}
							}
							Err(e) => format!("Wait error: {}", e),
						}
					} else {
						"terminal exited".to_string()
					};

					emit_session_state(
						&app_handle,
						SessionStatePayload {
							session_id: session_id.clone(),
							status: "closed".into(),
							message: Some(exit_msg),
						},
					);
					if let Ok(mut meta) = session_meta.write() {
						if let Some(s) = meta.get_mut(&session_id) {
							s.status = "closed".into();
						}
					}
					// 移除已死亡的 session，让重连时能重新创建 PTY
					if let Ok(mut map) = sessions_map.write() {
						map.remove(&session_id);
					}
					break;
				}
				Ok(size) => {
					let chunk = String::from_utf8_lossy(&buffer[..size]).to_string();

					// 自动处理密码提示
					let mut password_to_send = None;
					if let Ok(mut pwd_guard) = session_clone.password.lock() {
						if let Some(pwd) = pwd_guard.as_ref() {
							// 检查是否包含 password 提示词
							let lower_chunk = chunk.to_lowercase();
							if lower_chunk.contains("password:") || lower_chunk.contains("password") {
								password_to_send = Some(pwd.clone());
								*pwd_guard = None; // 只发送一次
							}
						}
					}

					if let Some(pwd) = password_to_send {
						if let Ok(mut writer) = session_clone.writer.lock() {
							let _ = writer.write_all(format!("{}\n", pwd).as_bytes());
							let _ = writer.flush();
						}
					}

					let _ = app_handle.emit(
						terminal::OUTPUT,
						TerminalOutputPayload {
							session_id: session_id.clone(),
							data: chunk,
						},
					);
				}
				Err(err) => {
					let error_msg = format!("Terminal read error: {}", err);
					emit_session_state(
						&app_handle,
						SessionStatePayload {
							session_id: session_id.clone(),
							status: "error".into(),
							message: Some(error_msg),
						},
					);
					if let Ok(mut meta) = session_meta.write() {
						if let Some(s) = meta.get_mut(&session_id) {
							s.status = "error".into();
						}
					}
					// 移除已死亡的 session，让重连时能重新创建 PTY
					if let Ok(mut map) = sessions_map.write() {
						map.remove(&session_id);
					}
					break;
				}
			}
		}
	});

	Ok(OpenTerminalResponse {
		session_id: request.session_id,
		status: "active".into(),
		kind: session_kind,
	})
}

pub fn write_input(
	state: State<'_, AppState>,
	session_id: &str,
	input: &str,
) -> Result<(), AppError> {
	let sessions = state.sessions.read().map_err(|err| AppError::Terminal(err.to_string()))?;
	let session = sessions
		.get(session_id)
		.cloned()
		.ok_or_else(|| AppError::SessionNotFound(session_id.into()))?;
	drop(sessions); // Release the read lock early

	let mut writer = session.writer.lock().map_err(|err| AppError::Terminal(err.to_string()))?;
	writer
		.write_all(input.as_bytes())
		.and_then(|_| writer.flush())
		.map_err(|err| AppError::Terminal(err.to_string()))
}

pub fn resize(
	state: State<'_, AppState>,
	session_id: &str,
	cols: u16,
	rows: u16,
) -> Result<(), AppError> {
	let sessions = state.sessions.read().map_err(|err| AppError::Terminal(err.to_string()))?;
	let session = sessions
		.get(session_id)
		.cloned()
		.ok_or_else(|| AppError::SessionNotFound(session_id.into()))?;
	drop(sessions); // Release the read lock early

	let master = session.master.lock().map_err(|err| AppError::Terminal(err.to_string()))?;
	master
		.resize(PtySize {
			rows: rows.max(10),
			cols: cols.max(20),
			pixel_width: 0,
			pixel_height: 0,
		})
		.map_err(|err| AppError::Terminal(err.to_string()))
}

pub fn close(state: State<'_, AppState>, session_id: &str) -> Result<(), AppError> {
	let session = {
		let mut sessions = state.sessions.write().map_err(|err| AppError::Terminal(err.to_string()))?;
		sessions.remove(session_id)	}
	.ok_or_else(|| AppError::SessionNotFound(session_id.into()))?;

	if let Ok(mut meta) = state.session_meta.write() {
		meta.remove(session_id);
	}

	let mut child = session.child.lock().map_err(|err| AppError::Terminal(err.to_string()))?;
	let _ = child.kill();
	Ok(())
}

pub async fn get_server_commands(_app: AppHandle, _host_id: Option<&str>) -> Result<Vec<String>, AppError> {
	// 彻底移除繁重的文件系统扫描和远端探测。
	// Common commands and local history are managed by the frontend for zero-I/O overhead completion.
	Ok(vec![])
}

pub fn get_shell_history() -> Result<Vec<crate::utils::history::ParsedHistoryItem>, AppError> {
	let home = std::env::var("HOME").map_err(|_| AppError::Io("Could not find HOME directory".into()))?;
	let shell = std::env::var("SHELL").unwrap_or_else(|_| "".to_string());

	let (history_path, is_zsh) = if shell.contains("zsh") {
		(format!("{}/.zsh_history", home), true)
	} else {
		(format!("{}/.bash_history", home), false)
	};

	let path = std::path::Path::new(&history_path);
	if !path.exists() {
		return Ok(vec![]);
	}

	let mut content = String::new();
	let mut file = std::fs::File::open(path)?;
	file.read_to_string(&mut content)?;

	Ok(crate::utils::history::parse_shell_history(&content, is_zsh, 500))
}
