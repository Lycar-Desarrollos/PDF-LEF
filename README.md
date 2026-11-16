# Kova PDF — Estudio PDF Nativo para Windows

<p align="center">
  <img src="public/brand/icon-512.png" alt="Kova PDF Logo" width="112" />
</p>

**Kova PDF** (`v2.0.0`) desarrollado por **Kova Studio** es una suite documental de precisión arquitectónica **100% local y nativa para Windows 10 y Windows 11**, construida sobre **Tauri v2 (Rust)** + **TypeScript/React** con licencias abiertas permisivas (**MIT / Apache 2.0**).

---

## Capacidades Principales

1. **Edición Tipográfica Directa y Movimiento de Textos del PDF:**
   - Escáner cromático de fondo perimetral y color de tinta real de los glifos para editar encabezados sobre banners oscuros, títulos de color y párrafos justificados sin efecto fantasma ni superposición.
   - Guías magnéticas de centrado, selección de tipografía, peso, tamaño y color de texto o cobertura, sin subrayados ortográficos distractores.
2. **Suite Integral de Herramientas PDF (100% Offline):**
   - **Organización y Estructura:** Eliminar páginas seleccionadas, Mesa de Luz para reordenar/rotar en lote, Unir múltiples PDFs, Dividir por rangos o extraer páginas individuales en `.zip`, Recortar márgenes (`CropBox` / `TrimBox`) y Comprimir/Optimizar peso.
   - **Conversión Bidireccional:** PDF a **Word editable (`.docx` OOXML con detección de tablas)**, PDF a **Excel (`.csv`)**, PDF a **Imágenes (`PNG` / `JPG` en alta resolución)** e **Imágenes a PDF**.
   - **Seguridad y Legal:** Bóveda local de **Firmas transparentes** (trazo, caligrafía o imagen con eliminación de fondo blanco), **Sellos ejecutivos**, **Censura permanente**, **Marcas de agua**, **Numeración legal Bates** (`KOVA-00001`), **OCR local** y **Limpieza de metadatos privados**.
3. **Interfaz Adaptativa High-DPI:**
   - Diseño calibrado para laptops Windows 11 con escalado 125%–150% y monitores 4K, con inspector lateral colapsable, modo Claro Alabastro / Oscuro Obsidiana y paleta rápida `Ctrl+K`.
4. **Actualizaciones Inteligentes Integradas:**
   - Verificador automático de versiones integrado en la aplicación que detecta nuevas compilaciones oficiales `.exe` / `.msi` y descarga la actualización con un clic conservando tus preferencias.

---

## Estructura del Proyecto

- `src/` — Aplicación de escritorio **Kova PDF** (interfaz nativa Windows 11, motor de edición cromática, conversión `.docx`/`.csv`/`.zip` y exportación PDF).
- `src-tauri/` — Backend nativo en **Rust (Tauri v2)** para Windows (ventana sin bordes nativa, asociación de archivos `KovaPDF.Document` e iconos `.ico`).
- `pruebas/` — 6 documentos PDF corporativos reales para auditoría de edición, tablas, firmas y portafolios de diseño.
- `website/` — Portal web internacional bilingüe (**ES / EN**) con descarga directa en 1 clic para Windows.
- `tests/` — Suite automatizada de pruebas integrales de motor PDF, conversión y auditoría hermética de marca.

---

## Desarrollo y Compilación

```bash
npm install
npm test
npm run lint
npm run build
```

Para generar el instalador nativo `.exe` y `.msi` en Windows:
```bash
npm run tauri:build
```
