# 📁 Suite Oficial de Pruebas con Documentos Reales — PDF-LEF

Esta carpeta contiene **5 documentos PDF reales, profesionales y de alta fidelidad** diseñados para auditar y demostrar la excelencia de **PDF-LEF** como alternativa general a Acrobat Pro, con especial foco en:
- **Edición in situ de texto existente** (con guías magnéticas y parche de cobertura opaco de fondo sin superposición ni efecto fantasma).
- **Extracción de tablas a CSV.**
- **Búsqueda en tiempo real.**
- **Inserción de sellos, firmas y marcas de agua.**
- **Manipulación de páginas** (rotación, división, combinación).

---

## 📑 Catálogo de Documentos de Prueba

| # | Archivo | Tipo de Documento | Escenario de Prueba Recomendado |
|---|---|---|---|
| **01** | `01_Cotizacion_Comercial_Abasteo.pdf` | **Cotización Comercial (Hardware/TI)** | Probar la edición del importe total ($52,908.00), cambio de dirección/contacto y edición de condiciones comerciales sin desbordar el margen. Idéntico al caso real del usuario. |
| **02** | `02_Factura_Fiscal_CFDI.pdf` | **Factura Fiscal (CFDI 4.0 con UUID y SAT)** | Modificar la descripción de la licencia, agregar sello de "PAGADO" o "CANCELADO" y probar la extracción de partidas a CSV. |
| **03** | `03_Contrato_Prestacion_Servicios.pdf` | **Contrato Legal Multipágina (MSA - 2 págs.)** | Mover cláusulas con guías magnéticas, agregar firmas transparentes en ambas partes en la pág. 2 y probar la división o extracción de páginas. |
| **04** | `04_Reporte_Financiero_Ejecutivo.pdf` | **Informe Ejecutivo Q3/Q4 con Tarjetas KPI** | Probar la edición de métricas financieras ($24.8M USD), modificación de tablas comparativas y exportación de datos numéricos a CSV. |
| **05** | `05_Certificado_Laboral_Nomina.pdf` | **Constancia Laboral y Recibo de Nómina** | Modificar percepciones salariales, salario neto, actualizar nombre de colaborador y aplicar sello digital corporativo. |

---

## 🛠️ Cómo Probarlos

1. **Desde la App de Escritorio o Preview Local:**
   - Abre **PDF-LEF**.
   - Haz clic en **«Abrir PDF»** y selecciona cualquiera de los archivos de esta carpeta `pruebas/` (o selecciona el menú de ejemplos rápidos).
2. **Edición Nativa de Texto (Herramienta "Editar texto"):**
   - Haz clic en la herramienta **«Editar texto»** (`T` con lápiz) en la barra de herramientas.
   - Pasa el cursor sobre cualquier texto: verás el recuadro sutil de selección.
   - Haz clic o doble clic en el texto deseado: se abrirá el editor in situ con fondo blanco sólido que **oculta al 100% el texto original subyacente**, evitando cualquier superposición de letras o efecto fantasma.
   - Edita el texto, cambia su tamaño o muévelo con la barra flotante de alineación magnética.
3. **Exportar a PDF:**
   - Haz clic en **«Exportar»** o presiona `Ctrl+S`.
   - Abre el PDF exportado: verás que el texto original ha sido limpiamente reemplazado y el nuevo texto luce con tipografía nítida y perfectamente alineada.
