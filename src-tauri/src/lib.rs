mod backup;

use backup::{create_backup as run_create_backup, get_backup_stats as run_get_backup_stats, BackupStats};

#[tauri::command]
fn get_app_dir() -> Result<String, String> {
    std::env::current_exe()
        .map_err(|e| e.to_string())?
        .parent()
        .map(|p| p.to_string_lossy().into_owned())
        .ok_or_else(|| "无法获取程序目录".to_string())
}

#[tauri::command]
fn get_backup_stats(backup_dir: String) -> Result<BackupStats, String> {
    run_get_backup_stats(&backup_dir)
}

#[tauri::command]
fn create_backup(
    backup_dir: String,
    storage_path: Option<String>,
    config_path: String,
) -> Result<String, String> {
    run_create_backup(
        &backup_dir,
        storage_path.as_deref(),
        &config_path,
    )
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![get_app_dir, get_backup_stats, create_backup])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
