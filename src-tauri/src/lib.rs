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
            vec!["add", r"HKCU\Software\Classes\KovaPDF.Document", "/ve", "/d", "Documento PDF (Kova PDF)", "/f"],
            vec!["add", r"HKCU\Software\Classes\KovaPDF.Document", "/v", "FriendlyTypeName", "/d", "Documento PDF (Kova PDF)", "/f"],
            vec!["add", r"HKCU\Software\Classes\KovaPDF.Document\DefaultIcon", "/ve", "/d", &doc_icon_str, "/f"],
            vec!["add", r"HKCU\Software\Classes\KovaPDF.Document\shell\open", "/ve", "/d", "Abrir con Kova PDF", "/f"],
            vec!["add", r"HKCU\Software\Classes\KovaPDF.Document\shell\open", "/v", "Icon", "/d", &open_icon, "/f"],
            vec!["add", r"HKCU\Software\Classes\KovaPDF.Document\shell\open\command", "/ve", "/d", &open_cmd, "/f"],
            vec!["add", r"HKCU\Software\Classes\.pdf\OpenWithProgids", "/v", "KovaPDF.Document", "/t", "REG_NONE", "/f"],
            vec!["add", r"HKCU\Software\KovaPDF\Capabilities", "/v", "ApplicationName", "/d", "Kova PDF", "/f"],
            vec!["add", r"HKCU\Software\KovaPDF\Capabilities", "/v", "ApplicationDescription", "/d", "Estudio PDF Nativo 100% Local para Windows", "/f"],
            vec!["add", r"HKCU\Software\KovaPDF\Capabilities\FileAssociations", "/v", ".pdf", "/d", "KovaPDF.Document", "/f"],
            vec!["add", r"HKCU\Software\RegisteredApplications", "/v", "Kova PDF", "/d", r"Software\KovaPDF\Capabilities", "/f"],
        ];

        for args in reg_commands {
            let _ = Command::new("reg").args(&args).output();
        }

        // Refresh Windows Explorer icon cache immediately
        let _ = Command::new("ie4uinit.exe").arg("-show").spawn();

        // Open Windows 10/11 Default Apps panel directly so user confirms Kova PDF in 1 click
        let _ = Command::new("cmd")
            .args(["/C", "start", "", "ms-settings:defaultapps"])
            .spawn();

        return Ok("Icono oficial Kova PDF registrado. Selecciona Kova PDF para archivos .pdf en la ventana de Windows.".to_string());
    }

    #[cfg(not(target_os = "windows"))]
    {
        Ok("En Windows 10/11, este botón registra el icono oficial de documento Kova PDF y abre Aplicaciones Predeterminadas.".to_string())
    }
}

#[tauri::command]
async fn download_and_install_update(
    app: tauri::AppHandle,
    download_url: String,
) -> Result<String, String> {
    let allowed_github = "https://github.com/Lycar-Desarrollos/PDF-LEF/releases/download/";
    let allowed_pages = "https://lycar-desarrollos.github.io/PDF-LEF/";
    let trimmed = download_url.trim().to_string();

    if !(trimmed.starts_with(allowed_github) || trimmed.starts_with(allowed_pages))
        || !trimmed.to_lowercase().ends_with(".exe")
    {
        return Err("Origen de actualización no verificado.".to_string());
    }

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        use std::process::Command;

        const CREATE_NO_WINDOW: u32 = 0x08000000;

        let installer_path = std::env::temp_dir().join("KovaPDF_Update_Setup.exe");
        let _ = fs::remove_file(&installer_path);
        let installer_str = installer_path.to_string_lossy().to_string();

        let status = Command::new("curl.exe")
            .args([
                "-fL",
                "--retry",
                "2",
                "--connect-timeout",
                "15",
                "-o",
                &installer_str,
                &trimmed,
            ])
            .creation_flags(CREATE_NO_WINDOW)
            .status()
            .map_err(|e| format!("No se pudo descargar el instalador: {}", e))?;

        if !status.success() {
            return Err("Error al descargar el paquete de actualización desde internet.".to_string());
        }

        let meta = fs::metadata(&installer_path)
            .map_err(|_| "El archivo de actualización descargado no se encontró.".to_string())?;
        if meta.len() < 200_000 {
            return Err("El archivo descargado está incompleto.".to_string());
        }

        let exe_path = std::env::current_exe()
            .map_err(|e| format!("No se pudo ubicar el ejecutable actual: {}", e))?;
        let exe_raw = exe_path.to_string_lossy();
        let exe_str = exe_raw.trim_start_matches(r"\\?\").to_string();

        let ps_script = format!(
            "Start-Sleep -Milliseconds 1400; Start-Process -FilePath '{}' -ArgumentList '/S' -Wait; Start-Process -FilePath '{}'",
            installer_str.replace('\'', "''"),
            exe_str.replace('\'', "''")
        );

        Command::new("powershell.exe")
            .args([
                "-NoProfile",
                "-NonInteractive",
                "-WindowStyle",
                "Hidden",
                "-Command",
                &ps_script,
            ])
            .creation_flags(CREATE_NO_WINDOW)
            .spawn()
            .map_err(|e| format!("No se pudo iniciar la instalación automática: {}", e))?;

        let app_handle = app.clone();
        std::thread::spawn(move || {
            std::thread::sleep(std::time::Duration::from_millis(450));
            app_handle.exit(0);
        });

        return Ok("Actualización descargada. Instalando y reiniciando Kova PDF...".to_string());
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = app;
        Ok(format!(
            "En Windows 10/11 descarga e instala silenciosamente desde: {}",
            trimmed
        ))
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
            register_default_pdf_app,
            download_and_install_update
        ])
        .run(tauri::generate_context!())
        .expect("Error al iniciar Kova PDF");
}
