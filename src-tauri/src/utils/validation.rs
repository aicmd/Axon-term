pub fn detect_os_by_username(username: &str) -> Option<String> {
    let u = username.to_lowercase();
    if u == "root" || u == "ubuntu" || u == "debian" || u == "centos" || u == "fedora" || u == "ec2-user" || u == "pi" || u == "vagrant" || u == "linux" {
        return Some("linux".into());
    }
    if u == "administrator" || u == "admin" || u == "windows" {
        return Some("windows".into());
    }
    if u == "mac" || u == "apple" || u == "darwin" {
        return Some("macos".into());
    }
    None
}

pub fn normalize_optional(value: Option<String>) -> Option<String> {
    value.and_then(|item| {
        let trimmed = item.trim().to_string();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed)
        }
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_detect_os_by_username() {
        assert_eq!(detect_os_by_username("root"), Some("linux".into()));
        assert_eq!(detect_os_by_username("ubuntu"), Some("linux".into()));
        assert_eq!(detect_os_by_username("Administrator"), Some("windows".into()));
        assert_eq!(detect_os_by_username("mac"), Some("macos".into()));
        assert_eq!(detect_os_by_username("unknown"), None);
    }

    #[test]
    fn test_normalize_optional() {
        assert_eq!(normalize_optional(Some("  hello  ".into())), Some("hello".into()));
        assert_eq!(normalize_optional(Some("   ".into())), None);
        assert_eq!(normalize_optional(None), None);
    }
}
