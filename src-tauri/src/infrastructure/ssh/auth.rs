use crate::domain::host::Host;
use ssh2::Session;
use std::path::PathBuf;

fn default_private_key_candidates() -> Vec<PathBuf> {
    let mut candidates = vec![];
    if let Ok(home) = std::env::var("HOME") {
        let base = PathBuf::from(home).join(".ssh");
        candidates.push(base.join("id_ed25519"));
        candidates.push(base.join("id_rsa"));
        candidates.push(base.join("id_ecdsa"));
        candidates.push(base.join("id_dsa"));
    }
    candidates
}

fn auth_method_hint(_host: &Host, available: Option<&str>) -> String {
    let mut hint = String::new();
    if let Some(methods) = available {
        hint.push_str(&format!("Server accepts: {}. ", methods));
    }
    hint
}

use crate::app::errors::AppError;

pub fn authenticate(session: &mut Session, host: &Host) -> Result<(), AppError> {
    let auth_methods = session.auth_methods(&host.username).ok();
    let mut attempts = vec![];

    if host.auth_type == "password" {
        if let Some(password) = &host.password {
            match session.userauth_password(&host.username, password) {
                Ok(()) if session.authenticated() => return Ok(()),
                Ok(()) => attempts.push("password auth returned no authenticated session".into()),
                Err(err) => attempts.push(format!("password auth error: {}", err)),
            }
        }
    } else if host.auth_type == "key" {
        if let Some(key_path_str) = &host.private_key_path {
            let expanded_path = crate::utils::paths::expand_tilde(key_path_str);
            let key_path = expanded_path.as_path();
            match session.userauth_pubkey_file(
                &host.username,
                None,
                key_path,
                host.passphrase.as_deref(),
            ) {
                Ok(()) if session.authenticated() => return Ok(()),
                Ok(()) => attempts.push(format!("configured private key {} returned no authenticated session", key_path.display())),
                Err(err) => attempts.push(format!("configured private key {} {}", key_path.display(), err)),
            }
        }
    }

    if let Ok(mut agent) = session.agent() {
        if agent.connect().is_ok() && agent.list_identities().is_ok() {
            match agent.identities() {
                Ok(identities) => {
                    for identity in identities {
                        match agent.userauth(&host.username, &identity) {
                            Ok(()) if session.authenticated() => return Ok(()),
                            Ok(()) => attempts.push("ssh-agent returned no authenticated session".into()),
                            Err(err) => attempts.push(format!("ssh-agent {}", err)),
                        }
                    }
                }
                Err(err) => attempts.push(format!("ssh-agent identities {}", err)),
            }
        }
    }

    for key_path in default_private_key_candidates() {
        if !key_path.exists() {
            continue;
        }

        match session.userauth_pubkey_file(&host.username, None, &key_path, host.passphrase.as_deref()) {
            Ok(()) if session.authenticated() => return Ok(()),
            Ok(()) => attempts.push(format!("public key {} returned no authenticated session", key_path.display())),
            Err(err) => attempts.push(format!("public key {} {}", key_path.display(), err)),
        }
    }

    let auth_hint = if host.auth_type == "password" {
        " Check the stored password or provide a usable key or agent fallback."
    } else {
        " Ensure the configured private key is valid, ssh-agent is loaded, or a usable private key exists in ~/.ssh."
    };
    let method_hint = auth_method_hint(host, auth_methods.as_deref());
    let combined_hint = if method_hint.is_empty() {
        auth_hint.to_string()
    } else {
        format!("{} {}", auth_hint.trim(), method_hint)
    };

    let error_msg = if attempts.is_empty() {
        format!("SSH authentication failed for {}. {}", host.username, combined_hint)
    } else {
        format!(
            "SSH authentication failed for {}. {} Attempts: {}",
            host.username,
            combined_hint,
            attempts.join("; ")
        )
    };

    Err(AppError::AuthFailed(error_msg))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_dummy_host() -> Host {
        Host {
            id: "1".into(),
            name: "test".into(),
            address: "127.0.0.1".into(),
            port: 22,
            username: "root".into(),
            auth_type: "password".into(),
            password: None,
            private_key_path: None,
            passphrase: None,
            group: None,
            os: None,
            port_forwards: None,
        }
    }

    #[test]
    fn test_auth_method_hint() {
        let host = create_dummy_host();
        let hint = auth_method_hint(&host, Some("publickey,password"));
        assert_eq!(hint, "Server accepts: publickey,password. ");

        let empty_hint = auth_method_hint(&host, None);
        assert_eq!(empty_hint, "");
    }

    #[test]
    fn test_default_private_key_candidates() {
        // Just verify it runs without panicking. The exact length depends on the HOME env var.
        let candidates = default_private_key_candidates();
        if std::env::var("HOME").is_ok() {
            assert_eq!(candidates.len(), 4);
            assert!(candidates[0].ends_with("id_ed25519"));
            assert!(candidates[1].ends_with("id_rsa"));
            assert!(candidates[2].ends_with("id_ecdsa"));
            assert!(candidates[3].ends_with("id_dsa"));
        } else {
            assert_eq!(candidates.len(), 0);
        }
    }
}
