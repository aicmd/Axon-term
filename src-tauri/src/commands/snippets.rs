use crate::app::errors::AppError;
use crate::utils::paths::get_app_data_dir;
use serde::{Deserialize, Serialize};
use std::fs;
use tauri::AppHandle;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Snippet {
    pub id: String,
    pub name: String,
    pub command: String,
    pub category: Option<String>,
    pub description: Option<String>,
}

#[tauri::command]
pub fn get_snippets(app: AppHandle) -> Result<Vec<Snippet>, AppError> {
    let path = get_app_data_dir(&app)?.join("snippets.json");
    if !path.exists() {
        return Ok(Vec::new());
    }
    
    let content = fs::read_to_string(&path)
        .map_err(|e| AppError::Io(format!("Failed to read snippets: {}", e)))?;
        
    let snippets: Vec<Snippet> = serde_json::from_str(&content)
        .map_err(|e| AppError::Io(format!("Failed to parse snippets: {}", e)))?;
        
    Ok(snippets)
}

#[tauri::command]
pub fn save_snippets(app: AppHandle, snippets: Vec<Snippet>) -> Result<(), AppError> {
    let path = get_app_data_dir(&app)?.join("snippets.json");
    
    let content = serde_json::to_string_pretty(&snippets)
        .map_err(|e| AppError::Io(format!("Failed to serialize snippets: {}", e)))?;
        
    fs::write(&path, content)
        .map_err(|e| AppError::Io(format!("Failed to write snippets: {}", e)))?;
        
    Ok(())
}
