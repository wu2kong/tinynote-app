mod backup;
mod sync;
mod updater;

use backup::{create_backup as run_create_backup, get_backup_stats as run_get_backup_stats, BackupStats};
use sync::{
    get_file_diff as run_get_file_diff, get_git_status as run_get_git_status,
    git_pull as run_git_pull, git_sync_push as run_git_sync_push,
    revert_file_change as run_revert_file_change, FileDiff, GitSyncStatus,
};

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

#[tauri::command]
fn get_git_status(storage_path: String) -> Result<GitSyncStatus, String> {
    run_get_git_status(&storage_path)
}

#[tauri::command]
fn git_pull(storage_path: String) -> Result<(), String> {
    run_git_pull(&storage_path)
}

#[tauri::command]
fn git_sync_push(storage_path: String) -> Result<String, String> {
    run_git_sync_push(&storage_path)
}

#[tauri::command]
fn get_file_diff(storage_path: String, file_path: String) -> Result<FileDiff, String> {
    run_get_file_diff(&storage_path, &file_path)
}

#[tauri::command]
fn revert_file_change(storage_path: String, file_path: String) -> Result<(), String> {
    run_revert_file_change(&storage_path, &file_path)
}

#[tauri::command]
fn download_release_asset(url: String, filename: String) -> Result<String, String> {
    updater::download_release_asset(&url, &filename)
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
        .invoke_handler(tauri::generate_handler![
            get_app_dir,
            get_backup_stats,
            create_backup,
            get_git_status,
            git_pull,
            git_sync_push,
            get_file_diff,
            revert_file_change,
            download_release_asset,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
