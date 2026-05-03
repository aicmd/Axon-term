use std::collections::HashSet;
use serde::Serialize;

#[derive(Serialize, Clone, Debug)]
pub struct ParsedHistoryItem {
    pub command: String,
    pub timestamp: Option<i64>,
}

pub fn parse_shell_history(content: &str, _is_zsh: bool, limit: usize) -> Vec<ParsedHistoryItem> {
    let mut history: Vec<ParsedHistoryItem> = Vec::new();
    let mut seen = HashSet::new();
    let mut last_timestamp: Option<i64> = None;

    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }

        // 1. Detect Bash history timestamps (#1777037651)
        if trimmed.starts_with('#') {
            if let Ok(ts) = trimmed[1..].parse::<i64>() {
                last_timestamp = Some(ts);
                continue; // Skip timestamp line
            }
        }

        let (cmd, timestamp) = if trimmed.starts_with(':') && trimmed.contains(';') {
            // 2. Detect Zsh history format (: 1713950000:0;ls -la)
            if let Some(semicolon_pos) = trimmed.find(';') {
                let prefix = &trimmed[1..semicolon_pos];
                // Parts are like ":", "1713950000", "0"
                let parts: Vec<&str> = prefix.split(':').collect();
                let extracted_ts = if parts.len() >= 2 {
                    parts[0].trim().parse::<i64>().ok()
                } else {
                    None
                };
                let command = trimmed[semicolon_pos + 1..].trim();
                (command.to_string(), extracted_ts)
            } else {
                (trimmed.to_string(), None)
            }
        } else {
            // 3. Regular command line (might be Bash)
            let ts = last_timestamp.take();
            (trimmed.to_string(), ts)
        };

        if !cmd.is_empty() && !seen.contains(&cmd) {
            history.push(ParsedHistoryItem {
                command: cmd.clone(),
                timestamp,
            });
            seen.insert(cmd);
            
            if history.len() > limit * 2 {
                history.remove(0);
            }
        }
    }

    history.reverse();
    history.truncate(limit);
    history
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_bash_history_with_timestamps() {
        let content = "#1713950000\nls -la\n#1713950010\necho 'hello'";
        let history = parse_shell_history(content, false, 10);
        
        assert_eq!(history.len(), 2);
        // Because of history.reverse(), the last command comes first
        assert_eq!(history[0].command, "echo 'hello'");
        assert_eq!(history[0].timestamp, Some(1713950010));
        assert_eq!(history[1].command, "ls -la");
        assert_eq!(history[1].timestamp, Some(1713950000));
    }

    #[test]
    fn test_parse_zsh_history() {
        let content = ": 1713950000:0;ls -la\n: 1713950010:0;cd /tmp";
        let history = parse_shell_history(content, true, 10);
        
        assert_eq!(history.len(), 2);
        assert_eq!(history[0].command, "cd /tmp");
        assert_eq!(history[0].timestamp, Some(1713950010));
        assert_eq!(history[1].command, "ls -la");
        assert_eq!(history[1].timestamp, Some(1713950000));
    }

    #[test]
    fn test_deduplication_and_limit() {
        let content = "ls\ncd\nls\necho 1\necho 2";
        // limit is 3, but there's a dedup logic and it removes duplicates
        let history = parse_shell_history(content, false, 3);
        
        // Before limit: "ls", "cd", "echo 1", "echo 2"
        // After reverse: "echo 2", "echo 1", "cd", "ls"
        // After truncate(3): "echo 2", "echo 1", "cd"
        assert_eq!(history.len(), 3);
        assert_eq!(history[0].command, "echo 2");
        assert_eq!(history[1].command, "echo 1");
        assert_eq!(history[2].command, "cd");
    }
}
