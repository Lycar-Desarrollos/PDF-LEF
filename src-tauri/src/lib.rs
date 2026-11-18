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
fn write_export_bytes(path: String, bytes: Vec<u8>) -> Result<(), String> {
    let lower = path.trim().to_lowercase();
    let allowed = [
        ".pdf", ".docx", ".csv", ".zip", ".png", ".jpg", ".jpeg", ".txt", ".json",
    ];
    if !allowed.iter().any(|ext| lower.ends_with(ext)) {
        return Err("Extensión de exportación no permitida por seguridad.".to_string());
    }
    fs::write(&path, bytes)
        .map_err(|e| format!("No se pudo guardar el archivo exportado ({}): {}", path, e))
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
        use std::os::windows::process::CommandExt;
        use std::process::Command;

        const CREATE_NO_WINDOW: u32 = 0x08000000;

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
            let _ = Command::new("reg")
                .args(&args)
                .creation_flags(CREATE_NO_WINDOW)
                .output();
        }

        // Refresh Windows Explorer icon cache silently without console window
        let _ = Command::new("ie4uinit.exe")
            .arg("-show")
            .creation_flags(CREATE_NO_WINDOW)
            .spawn();

        // Open Windows 10/11 Default Apps panel directly via Explorer URI without spawning cmd/terminal
        let _ = Command::new("explorer.exe")
            .arg("ms-settings:defaultapps")
            .creation_flags(CREATE_NO_WINDOW)
            .spawn();

        return Ok("Icono oficial Kova PDF registrado silenciosamente. Selecciona Kova PDF para archivos .pdf en Configuración de Windows.".to_string());
    }

    #[cfg(not(target_os = "windows"))]
    {
        Ok("En Windows 10/11, este botón registra el icono oficial de documento Kova PDF y abre Aplicaciones Predeterminadas.".to_string())
    }
}

#[tauri::command]
fn open_external_url(url: String) -> Result<(), String> {
    let trimmed = url.trim().to_string();
    if !trimmed.starts_with("https://") {
        return Err("Solo se permiten enlaces seguros HTTPS.".to_string());
    }

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        use std::process::Command;

        const CREATE_NO_WINDOW: u32 = 0x08000000;

        Command::new("rundll32.exe")
            .args(["url.dll,FileProtocolHandler", &trimmed])
            .creation_flags(CREATE_NO_WINDOW)
            .spawn()
            .map_err(|e| format!("No se pudo abrir el navegador predeterminado: {}", e))?;
        return Ok(());
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = trimmed;
        Ok(())
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
        use std::io::Read;
        use std::os::windows::process::CommandExt;
        use std::path::PathBuf;
        use std::process::Command;

        const CREATE_NO_WINDOW: u32 = 0x08000000;

        let url_for_worker = trimmed.clone();
        let installer_path = tauri::async_runtime::spawn_blocking(move || -> Result<PathBuf, String> {
            let dest = std::env::temp_dir().join("KovaPDF_Update_Setup.exe");
            let _ = fs::remove_file(&dest);
            let dest_str = dest.to_string_lossy().to_string();

            // 1. Primary fast native download via Windows curl.exe (--ssl-no-revoke avoids corporate Schannel CRL blocks)
            let curl_ok = Command::new("curl.exe")
                .args([
                    "-fL",
                    "--ssl-no-revoke",
                    "--retry",
                    "2",
                    "--connect-timeout",
                    "15",
                    "-o",
                    &dest_str,
                    &url_for_worker,
                ])
                .creation_flags(CREATE_NO_WINDOW)
                .status()
                .map(|s| s.success())
                .unwrap_or(false);

            // 2. Fallback download via PowerShell TLS 1.2 if curl.exe is unavailable or blocked
            if !curl_ok || !dest.exists() {
                let ps_dl = format!(
                    "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -UseBasicParsing -Uri '{}' -OutFile '{}'",
                    url_for_worker.replace('\'', "''"),
                    dest_str.replace('\'', "''")
                );
                let ps_ok = Command::new("powershell.exe")
                    .args([
                        "-NoProfile",
                        "-NonInteractive",
                        "-WindowStyle",
                        "Hidden",
                        "-Command",
                        &ps_dl,
                    ])
                    .creation_flags(CREATE_NO_WINDOW)
                    .status()
                    .map(|s| s.success())
                    .unwrap_or(false);

                if !ps_ok {
                    return Err("Error al descargar el instalador desde el servidor global.".to_string());
                }
            }

            // 3. Validate downloaded binary size & Windows PE ('MZ') signature
            let meta = fs::metadata(&dest)
                .map_err(|_| "El archivo de actualización descargado no se encontró.".to_string())?;
            if meta.len() < 500_000 {
                let _ = fs::remove_file(&dest);
                return Err("La descarga del instalador quedó incompleta.".to_string());
            }

            let mut header = [0u8; 2];
            let mut file = fs::File::open(&dest)
                .map_err(|_| "No se pudo verificar el instalador descargado.".to_string())?;
            file.read_exact(&mut header)
                .map_err(|_| "Encabezado de instalador inválido.".to_string())?;
            if &header != b"MZ" {
                let _ = fs::remove_file(&dest);
                return Err("El archivo descargado no es un ejecutable válido de Windows.".to_string());
            }

            Ok(dest)
        })
        .await
        .map_err(|e| format!("Fallo interno en tarea de descarga: {}", e))??;

        // 4. Launch Tauri NSIS installer directly with official Passive + Relaunch + Update flags (/P /R /UPDATE).
        // If a legacy station installed Kova PDF into C:\Program Files (requiring UAC elevation, Win32 error 740),
        // seamlessly fall back to elevated ShellExecute via Start-Process -Verb RunAs.
        let direct_spawn = Command::new(&installer_path)
            .args(["/P", "/R", "/UPDATE"])
            .spawn();

        if let Err(spawn_err) = direct_spawn {
            let installer_escaped = installer_path
                .to_string_lossy()
                .replace('\'', "''");
            let ps_elevate = format!(
                "Start-Process -FilePath '{}' -ArgumentList '/P','/R','/UPDATE' -Verb RunAs",
                installer_escaped
            );
            let elevated_ok = Command::new("powershell.exe")
                .args([
                    "-NoProfile",
                    "-NonInteractive",
                    "-WindowStyle",
                    "Hidden",
                    "-Command",
                    &ps_elevate,
                ])
                .creation_flags(CREATE_NO_WINDOW)
                .status()
                .map(|s| s.success())
                .unwrap_or(false);

            if !elevated_ok {
                return Err(format!(
                    "No se pudo iniciar la actualización automática: {}",
                    spawn_err
                ));
            }
        }

        let app_handle = app.clone();
        std::thread::spawn(move || {
            std::thread::sleep(std::time::Duration::from_millis(350));
            app_handle.exit(0);
        });

        return Ok("Actualización verificada. Aplicando nueva versión y reiniciando Kova PDF...".to_string());
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = app;
        Ok(format!(
            "En Windows 10/11 descarga e instala automáticamente (/P /R /UPDATE) desde: {}",
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
            write_export_bytes,
            get_startup_pdf_path,
            register_default_pdf_app,
            open_external_url,
            download_and_install_update
        ])
        .run(tauri::generate_context!())
        .expect("Error al iniciar Kova PDF");
}
