// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod models;
mod db;

use models::{MasterItem, ReferenceRegistration, InitialStateResponse, DeletePayload, FullBackupPayload};
use std::path::PathBuf;

#[tauri::command]
fn db_get_initial_state() -> Result<InitialStateResponse, String> {
    db::load_initial_state().map_err(|e| e.to_string())
}

#[tauri::command]
fn get_data_directory() -> String {
    db::get_app_data_dir().to_string_lossy().to_string()
}

#[tauri::command]
fn open_data_folder(path: Option<String>) -> Result<String, String> {
    let target = if let Some(p) = path {
        PathBuf::from(p)
    } else {
        db::get_app_data_dir()
    };

    #[cfg(target_os = "windows")]
    {
        let _ = std::process::Command::new("explorer")
            .arg(&target)
            .spawn();
    }

    #[cfg(target_os = "macos")]
    {
        let _ = std::process::Command::new("open")
            .arg(&target)
            .spawn();
    }

    #[cfg(target_os = "linux")]
    {
        let _ = std::process::Command::new("xdg-open")
            .arg(&target)
            .spawn();
    }

    Ok(target.to_string_lossy().to_string())
}

#[tauri::command]
fn create_master_item(payload: MasterItem) -> Result<(), String> {
    db::upsert_master_item(&payload).map_err(|e| e.to_string())
}

#[tauri::command]
fn update_master_item(payload: MasterItem) -> Result<(), String> {
    db::upsert_master_item(&payload).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_master_item(payload: DeletePayload) -> Result<(), String> {
    db::delete_master_item(&payload.id).map_err(|e| e.to_string())
}

#[tauri::command]
fn bulk_save_master_items(payload: Vec<MasterItem>) -> Result<(), String> {
    db::bulk_upsert_master_items(&payload).map_err(|e| e.to_string())
}

#[tauri::command]
fn create_registration(payload: ReferenceRegistration) -> Result<(), String> {
    db::upsert_registration(&payload).map_err(|e| e.to_string())
}

#[tauri::command]
fn update_registration(payload: ReferenceRegistration) -> Result<(), String> {
    db::upsert_registration(&payload).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_registration(payload: DeletePayload) -> Result<(), String> {
    db::delete_registration(&payload.id).map_err(|e| e.to_string())
}

#[tauri::command]
fn save_app_config(payload: serde_json::Value) -> Result<(), String> {
    db::save_config(&payload).map_err(|e| e.to_string())
}

#[tauri::command]
fn restore_full_backup(payload: FullBackupPayload) -> Result<(), String> {
    db::restore_backup(&payload).map_err(|e| e.to_string())
}

fn show_native_error_dialog(title: &str, message: &str) {
    #[cfg(target_os = "windows")]
    {
        let escaped_msg = message.replace('"', "'").replace('`', "'");
        let escaped_title = title.replace('"', "'");
        let script = format!(
            "Add-Type -AssemblyName PresentationFramework; [System.Windows.MessageBox]::Show(\"{}\", \"{}\", 'OK', 'Error')",
            escaped_msg, escaped_title
        );
        let _ = std::process::Command::new("powershell")
            .args(["-NoProfile", "-WindowStyle", "Hidden", "-Command", &script])
            .spawn();
    }
    #[cfg(not(target_os = "windows"))]
    {
        eprintln!("[ERROR] {}: {}", title, message);
    }
}

fn write_error_log(filename: &str, content: &str) {
    let app_dir = db::get_app_data_dir();
    let log_path = app_dir.join(filename);
    let _ = std::fs::write(&log_path, content);

    // Also attempt writing directly beside executable for portable convenience
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            let direct_path = exe_dir.join(filename);
            let _ = std::fs::write(&direct_path, content);
        }
    }
}

fn main() {
    // Set up crash / panic hook so errors on Windows are never silently swallowed
    std::panic::set_hook(Box::new(|info| {
        let panic_msg = format!(
            "ReferenceTracker encountered an unexpected fatal error:\n\n{}\n\nLocation: {:?}",
            info,
            info.location()
        );
        write_error_log("ReferenceTracker_crash.log", &panic_msg);
        show_native_error_dialog("ReferenceTracker - Fatal Error", &panic_msg);
    }));

    let app = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            db_get_initial_state,
            get_data_directory,
            open_data_folder,
            create_master_item,
            update_master_item,
            delete_master_item,
            bulk_save_master_items,
            create_registration,
            update_registration,
            delete_registration,
            save_app_config,
            restore_full_backup,
        ])
        .build(tauri::generate_context!());

    match app {
        Ok(app) => {
            app.run(|_app_handle, _event| {});
        }
        Err(err) => {
            let err_msg = format!(
                "Failed to initialize ReferenceTracker desktop application:\n\n{}\n\nTroubleshooting tips:\n1. Ensure Microsoft Edge WebView2 Runtime is installed.\n2. Extract all contents of the ZIP before running.\n3. Check ReferenceTracker_startup_error.log for details.",
                err
            );
            write_error_log("ReferenceTracker_startup_error.log", &err_msg);
            show_native_error_dialog("ReferenceTracker - Startup Failure", &err_msg);
            eprintln!("{}", err_msg);
        }
    }
}
