// Evita abrir consola negra de comandos al ejecutar el .exe en Windows
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    kova_pdf_lib::run();
}
