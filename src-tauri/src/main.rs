mod app;
mod application;
mod commands;
mod domain;
mod dto;
mod events;
mod infrastructure;
mod utils;

use tauri::{Manager, Theme};

#[cfg(target_os = "macos")]
use window_vibrancy::{apply_vibrancy, NSVisualEffectMaterial};

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            commands::settings::ping,
            commands::hosts::list_hosts,
            commands::hosts::create_host,
            commands::hosts::update_host,
            commands::hosts::delete_host,
            commands::hosts::test_host_connection,
            commands::sessions::list_sessions,
            commands::terminal::open_terminal,
            commands::terminal::write_terminal,
            commands::terminal::resize_terminal,
            commands::terminal::close_terminal,
            commands::terminal::get_server_commands,
            commands::sftp::list_local_entries,
            commands::sftp::list_entries,
            commands::sftp::download_file,
            commands::sftp::upload_file,
            commands::sftp::create_local_directory,
            commands::sftp::rename_local_entry,
            commands::sftp::delete_local_entry,
            commands::sftp::create_remote_directory,
            commands::sftp::rename_remote_entry,
            commands::sftp::delete_remote_entry,
            commands::hosts::update_host_os,
            commands::hosts::get_remote_metrics,
            commands::hosts::get_remote_shell_history,
            commands::terminal::get_shell_history,
            commands::github::test_github_token,
            commands::github::sync_to_github,
            commands::github::sync_from_github,
            commands::github::login_to_github,
            commands::github::logout_from_github,
            commands::github::get_github_auth_status,
            commands::hosts::change_master_password,
            commands::settings::get_secret_storage_mode,
            commands::settings::set_secret_storage_mode,
            commands::snippets::get_snippets,
            commands::snippets::save_snippets,
        ])
        .setup(|app| {
            app::state::initialize(app.handle().clone())?;

            #[cfg(target_os = "macos")]
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_theme(Some(Theme::Dark));
                apply_vibrancy(&window, NSVisualEffectMaterial::Sidebar, None, Some(18.0))
                    .expect("window-vibrancy: failed to apply vibrancy");
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("failed to run tauri application")
}
