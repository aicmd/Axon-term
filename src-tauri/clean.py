import os
import re

replacements = {
    "src/app/errors.rs": [(r"pub enum AppError \{[\s\S]*?\}", "")],
    "src/app/events.rs": [
        (r"pub const TERMINAL_OUTPUT.*?\n", ""),
        (r"pub const SESSION_STATE_CHANGED.*?\n", ""),
        (r"pub const TRANSFER_PROGRESS.*?\n", "")
    ],
    "src/app/state.rs": [(r"    pub initialized: bool,\n", "")],
    "src/domain/transfer.rs": [(r"pub struct TransferTask \{[\s\S]*?\}", "")],
    "src/dto/hosts.rs": [(r"pub struct HostDto \{[\s\S]*?\}", "")],
    "src/dto/sessions.rs": [(r"pub struct SessionDto \{[\s\S]*?\}", "")],
    "src/dto/sftp.rs": [(r"pub struct SftpEntryDto \{[\s\S]*?\}", "")],
    "src/dto/terminal.rs": [(r"pub struct TerminalChunkDto \{[\s\S]*?\}", "")],
    "src/events/transfer.rs": [(r"pub const PROGRESS.*?\n", "")],
    "src/infrastructure/logging/tracing.rs": [(r"pub fn subscriber_name\(\).*?\{\n.*?\n\}", "")],
    "src/infrastructure/pty/local.rs": [(r"pub fn backend_name\(\).*?\{\n.*?\n\}", "")],
    "src/infrastructure/pty/resize.rs": [(r"pub fn clamp.*?\{\n.*?\n\}", "")],
    "src/infrastructure/secure_store/keyring.rs": [(r"pub fn provider_name\(\).*?\{\n.*?\n\}", "")],
    "src/infrastructure/ssh/auth.rs": [(r"pub fn supported_auth_methods\(\).*?\{\n.*?\n\}", "")],
    "src/infrastructure/ssh/sftp.rs": [(r"pub fn supported_sftp_operations\(\).*?\{\n.*?\n\}", "")],
    "src/infrastructure/storage/repository.rs": [(r"pub trait Repository \{\n.*?\n\}", "")],
    "src/infrastructure/storage/sqlite.rs": [(r"pub fn connection_string\(\).*?\{\n.*?\n\}", "")],
    "src/utils/paths.rs": [(r"pub fn app_root\(\).*?\{\n.*?\n\}", ""), (r"use std::path::PathBuf;\n\n", "")],
    "src/utils/time.rs": [(r"pub fn unix_timestamp\(\).*?\{\n.*?\n\}", ""), (r"use std::time::.*?\n\n", "")],
    "src/utils/validation.rs": [(r"pub fn ensure_not_blank.*?\{\n.*?\n\}", "")]
}

for file, patterns in replacements.items():
    if not os.path.exists(file): continue
    with open(file, "r") as f:
        content = f.read()
    
    for pat, repl in patterns:
        content = re.sub(pat, repl, content)
    
    with open(file, "w") as f:
        f.write(content)
