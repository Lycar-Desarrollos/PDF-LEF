use std::fs;
use std::path::Path;

#[tauri::command]
fn read_pdf_bytes(path: String) -> Result<Vec<u8>, String> {
    fs::read(&path).map_err(|e| format!("No se pudo leer el archivo PDF ({}): {}", path, e))
}

#[tauri::command]
fn write_pdf_bytes(path: String, bytes: Vec<u8>) -> Result<(), String> {
    fs::write(&path, bytes)
        .map_err(|e| format!("No se pudo guardar el archivo PDF ({}): {}", path, e))
}

#[tauri::command]
fn get_startup_pdf_path() -> Option<String> {
    for arg in std::env::args().skip(1) {
        if arg.to_lowercase().ends_with(".pdf") && Path::new(&arg).exists() {
            return Some(arg);
        }
    }
    None
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            read_pdf_bytes,
            write_pdf_bytes,
            get_startup_pdf_path
        ])
        .run(tauri::generate_context!())
        .expect("Error al iniciar PDF-LEF Studio Pro");
}
