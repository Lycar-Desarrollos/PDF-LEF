# PDF-LEF Studio Pro — Suite PDF Nativa para Windows

<p align="center">
  <img src="public/brand/icon-512.png" alt="PDF-LEF Logo" width="112" />
</p>

**PDF-LEF Studio Pro** es una suite comercial minimalista **100% local y nativa para Windows 10 / 11**, construida sobre **Tauri v2 (Rust)** + **TypeScript/React** y motores con licencias **100% permisivas para venta comercial (MIT / Apache 2.0, cero AGPL)**.

---

## Características Principales

1. **Edición Directa y Movimiento de Textos Existentes del PDF:**
   - Detecta automáticamente los bloques de texto reales dentro de cualquier PDF (`PDF.js`).
   - Haz clic sobre cualquier palabra o línea existente para corregirla, cambiar fuente/tamaño/color o **arrastrarla a otra posición de la página** cubriendo automáticamente el fondo original al guardar.
2. **Inserción y Manipulación Total de Imágenes y Objetos:**
   - Inserta logotipos, fotografías (`PNG`, `JPG`, `WebP`, `SVG`), cuadros de texto enriquecidos, flechas, formas, notas, resaltados, tinta suavizada y **censura permanente**.
   - Redimensionamiento desde **8 tiradores de esquina/borde**, guías magnéticas de centrado, control de opacidad, orden de capas (`Al frente` / `Al fondo`) y ajuste fino (*nudge*).
3. **Bóveda Local de Firmas Transparentes y Sellos Ejecutivos:**
   - Dibuja tu firma, genérala con caligrafía o sube una foto de tu firma sobre papel (**eliminación automática del fondo blanco**).
   - Sellos comerciales listos (*APROBADO*, *PAGADO*, *CONFIDENCIAL*, *URGENTE*, *BORRADOR*, *COPIA CONTROLADA*) con fecha automática.
4. **Mesa de Luz de Páginas y Herramientas Pro:**
   - Reordena páginas arrastrando, rota en lote, duplica, inserta hojas en blanco, anexa otros PDFs, divide por rangos (`1-3, 5, 8-12`), convierte `Imágenes ↔ PDF`, aplica marcas de agua, numeración legal **Bates**, **OCR local** y limpieza de metadatos privados.
5. **Centro de Configuración Pro + Paleta `Ctrl+K`:**
   - Modo **Claro Editorial** y **Oscuro Grafito**, 4 acentos de marca (*Rubí LEF*, *Cobalto*, *Esmeralda*, *Monocromo*), 3 densidades de interfaz, escala tipográfica, renderizado 4K HiDPI y exportación/importación de perfil `.json`.
6. **Página Web Comercial de Descarga (`/website`):**
   - Landing page oficial lista para producción conectada automáticamente al último instalador `.exe` publicado en GitHub Releases.

---

## Estructura del Proyecto

- `src/` — Aplicación de escritorio PDF-LEF Studio Pro (UI minimalista Windows 11, motor de edición y exportación PDF).
- `src-tauri/` — Backend nativo en **Rust (Tauri v2)** para Windows (ventana sin bordes nativa, asociación de archivos `.pdf` al doble clic, lectura/escritura directa e iconos `.ico`).
- `website/` — Página web comercial oficial para descargar `PDF-LEF-Setup.exe`.
- `.github/workflows/release-windows.yml` — Compilación automática en la nube del instalador `.exe` y `.msi` para Windows x64.

---

## Desarrollo y Compilación en Windows

### 1. Probar en desarrollo
```bash
npm install
npm run dev
# O con ventana nativa Tauri v2 en Windows:
npm run tauri:dev
```

### 2. Generar el instalador `.exe` localmente en Windows
Requisitos en Windows: Node.js LTS + Rust (`rustup`) + Build Tools de Visual Studio C++.
```bash
npm run tauri:build
```
El instalador quedará listo en:
`src-tauri/target/release/bundle/nsis/PDF-LEF_1.0.0_x64-setup.exe`

### 3. Generar el `.exe` automáticamente desde GitHub (Sin instalar compiladores)
Al subir una versión con etiqueta (`git tag v1.0.0 && git push origin v1.0.0`) o ejecutar el workflow **Build & Release Windows (.exe)** en la pestaña *Actions* de GitHub, GitHub compila automáticamente el `.exe` oficial y lo publica en **Releases** listo para descargar desde la web.
