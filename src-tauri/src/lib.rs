use std::fs;
use std::path::Path;
#[cfg(target_os = "windows")]
use tauri::Manager;

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
        let cleaned = arg.trim_matches('"').trim_start_matches(r"\\?\").to_string();
        if cleaned.to_lowercase().ends_with(".pdf") && Path::new(&cleaned).exists() {
            return Some(cleaned);
        }
    }
    None
}

#[tauri::command]
fn register_default_pdf_app(_app: tauri::AppHandle) -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;

        let exe_path = std::env::current_exe()
            .map_err(|e| format!("No se pudo obtener la ruta del ejecutable: {}", e))?;
        let exe_raw = exe_path.to_string_lossy();
        let exe_str = exe_raw.trim_start_matches(r"\\?\").to_string();

        let doc_icon_str = _app
            .path()
            .resource_dir()
            .ok()
            .map(|dir| dir.join("icons").join("pdf-document.ico"))
            .filter(|p| p.exists())
            .map(|p| {
                let raw = p.to_string_lossy();
                format!("{},0", raw.trim_start_matches(r"\\?\"))
            })
            .unwrap_or_else(|| format!("{},0", exe_str));

        let open_cmd = format!("\"{}\" \"%1\"", exe_str);
        let open_icon = format!("{},0", exe_str);

        let reg_commands: Vec<Vec<&str>> = vec![
            vec!["add", r"HKCU\Software\Classes\PDFLEF.Document", "/ve", "/d", "Documento PDF (PDF-LEF)", "/f"],
            vec!["add", r"HKCU\Software\Classes\PDFLEF.Document", "/v", "FriendlyTypeName", "/d", "Documento PDF (PDF-LEF)", "/f"],
            vec!["add", r"HKCU\Software\Classes\PDFLEF.Document\DefaultIcon", "/ve", "/d", &doc_icon_str, "/f"],
            vec!["add", r"HKCU\Software\Classes\PDFLEF.Document\shell\open", "/ve", "/d", "Abrir con PDF-LEF", "/f"],
            vec!["add", r"HKCU\Software\Classes\PDFLEF.Document\shell\open", "/v", "Icon", "/d", &open_icon, "/f"],
            vec!["add", r"HKCU\Software\Classes\PDFLEF.Document\shell\open\command", "/ve", "/d", &open_cmd, "/f"],
            vec!["add", r"HKCU\Software\Classes\.pdf\OpenWithProgids", "/v", "PDFLEF.Document", "/t", "REG_NONE", "/f"],
            vec!["add", r"HKCU\Software\PDF-LEF\Capabilities", "/v", "ApplicationName", "/d", "PDF-LEF", "/f"],
            vec!["add", r"HKCU\Software\PDF-LEF\Capabilities", "/v", "ApplicationDescription", "/d", "Suite PDF Nativa 100% Local para Windows", "/f"],
            vec!["add", r"HKCU\Software\PDF-LEF\Capabilities\FileAssociations", "/v", ".pdf", "/d", "PDFLEF.Document", "/f"],
            vec!["add", r"HKCU\Software\RegisteredApplications", "/v", "PDF-LEF", "/d", r"Software\PDF-LEF\Capabilities", "/f"],
        ];

        for args in reg_commands {
            let _ = Command::new("reg").args(&args).output();
        }

        // Refresh Windows Explorer icon cache immediately
        let _ = Command::new("ie4uinit.exe").arg("-show").spawn();

        // Open Windows 10/11 Default Apps panel directly so user confirms PDF-LEF in 1 click
        let _ = Command::new("cmd")
            .args(["/C", "start", "", "ms-settings:defaultapps"])
            .spawn();

        return Ok("Icono oficial PDF-LEF registrado. Selecciona PDF-LEF para archivos .pdf en la ventana de Windows.".to_string());
    }

    #[cfg(not(target_os = "windows"))]
    {
        Ok("En Windows 10/11, este botón registra el icono oficial de documento PDF-LEF y abre Aplicaciones Predeterminadas.".to_string())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            read_pdf_bytes,
            write_pdf_bytes,
            get_startup_pdf_path,
            register_default_pdf_app
        ])
        .run(tauri::generate_context!())
        .expect("Error al iniciar PDF-LEF");
}
