import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PRUEBAS_DIR = resolve(__dirname, '../pruebas');
mkdirSync(PRUEBAS_DIR, { recursive: true });

// -----------------------------------------------------------------------------
// 1. COTIZACIÓN COMERCIAL ABASTEO (Directly reproduces the user's document!)
// -----------------------------------------------------------------------------
async function createCotizacionAbasteo() {
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]); // Standard US Letter
  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontOblique = await doc.embedFont(StandardFonts.HelveticaOblique);

  const primaryBlue = rgb(0.12, 0.44, 0.85); // abasteo blue
  const darkSlate = rgb(0.08, 0.11, 0.15);
  const grayMuted = rgb(0.42, 0.46, 0.52);
  const tableBorder = rgb(0.85, 0.88, 0.92);

  // Top header: Brand "abasteo"
  page.drawText('abasteo', {
    x: 48,
    y: 742,
    size: 26,
    font: fontBold,
    color: primaryBlue,
  });
  page.drawText('.mx', {
    x: 148,
    y: 742,
    size: 16,
    font: fontBold,
    color: grayMuted,
  });

  // Title: "Cotizacion"
  page.drawText('Cotizacion', {
    x: 48,
    y: 704,
    size: 20,
    font: fontBold,
    color: darkSlate,
  });

  // Client info
  page.drawText('LEBARFF SERVICIO DE MANTENIMIENTO GENERAL', {
    x: 48,
    y: 678,
    size: 10,
    font: fontBold,
    color: darkSlate,
  });
  page.drawText('Edgar Ydalmir', {
    x: 48,
    y: 664,
    size: 9.5,
    font: fontRegular,
    color: darkSlate,
  });
  page.drawText('LSM150727IP0', {
    x: 48,
    y: 651,
    size: 9,
    font: fontRegular,
    color: grayMuted,
  });
  page.drawText('Fecha cotizacion fue elaborada el 13.11.2026', {
    x: 48,
    y: 636,
    size: 9,
    font: fontRegular,
    color: darkSlate,
  });

  // Callout box
  page.drawRectangle({
    x: 48,
    y: 598,
    width: 516,
    height: 26,
    color: rgb(0.96, 0.98, 1.0),
    borderColor: rgb(0.78, 0.86, 0.98),
    borderWidth: 1,
  });
  page.drawText(
    'Si tiene cualquier duda referente a esta cotizacion puede contactarnos via correo electronico (kosto@abasteo.mx) o en el telefono (33) 4780 0901 Ext.',
    {
      x: 56,
      y: 608,
      size: 8,
      font: fontRegular,
      color: darkSlate,
    }
  );

  // Folio
  page.drawText('No. de cotizacion: QT9865402-2', {
    x: 48,
    y: 576,
    size: 11,
    font: fontBold,
    color: primaryBlue,
  });

  // Table Header
  const tableY = 554;
  page.drawLine({
    start: { x: 48, y: tableY },
    end: { x: 564, y: tableY },
    thickness: 1,
    color: darkSlate,
  });

  page.drawText('# No. articulo', { x: 52, y: tableY - 12, size: 8, font: fontBold, color: darkSlate });
  page.drawText('Nombre del producto', { x: 140, y: tableY - 12, size: 8, font: fontBold, color: darkSlate });
  page.drawText('Cantidad', { x: 370, y: tableY - 12, size: 8, font: fontBold, color: darkSlate });
  page.drawText('Precio unitario (excl. IVA)', { x: 420, y: tableY - 12, size: 7.5, font: fontBold, color: darkSlate });
  page.drawText('Subtotal (excl. IVA)', { x: 500, y: tableY - 12, size: 7.5, font: fontBold, color: darkSlate });

  page.drawLine({
    start: { x: 48, y: tableY - 18 },
    end: { x: 564, y: tableY - 18 },
    thickness: 0.75,
    color: tableBorder,
  });

  // Row 1
  page.drawText('1.1  BT4E456LA', { x: 52, y: tableY - 34, size: 8.5, font: fontRegular, color: darkSlate });
  page.drawText('Laptop Gamer HP Victus 15-fb2019la, 15.6 Full HD, AMD Ryzen 7 7445H,', {
    x: 140,
    y: tableY - 34,
    size: 8,
    font: fontRegular,
    color: darkSlate,
  });
  page.drawText('NVIDIA GeForce RTX 3050 6GB, 512GB SSD, FreeDOS, Espanol - Bodega 938', {
    x: 140,
    y: tableY - 46,
    size: 8,
    font: fontRegular,
    color: darkSlate,
  });
  page.drawText('Tiempo de entrega de 1 a 4 dias habiles (18 al 23 de Noviembre)', {
    x: 140,
    y: tableY - 58,
    size: 7.5,
    font: fontOblique,
    color: grayMuted,
  });

  page.drawText('3', { x: 382, y: tableY - 34, size: 9, font: fontRegular, color: darkSlate });
  page.drawText('$15,173.28', { x: 432, y: tableY - 34, size: 9, font: fontRegular, color: darkSlate });
  page.drawText('$45,519.88', { x: 508, y: tableY - 34, size: 9, font: fontBold, color: darkSlate });

  page.drawLine({
    start: { x: 48, y: tableY - 68 },
    end: { x: 564, y: tableY - 68 },
    thickness: 0.5,
    color: tableBorder,
  });

  // Totals Section (Right Aligned block)
  let totY = tableY - 88;
  const totals = [
    ['Total de productos (excl. IVA)', '$45,519.88'],
    ['Costo de envio (excl. IVA)', '$262.88'],
    ['Subtotal (excl. IVA)', '$45,782.76'],
    ['+ 16% IVA', '$7,325.24'],
    ['Subtotal (incl. IVA)', '$53,108.00'],
    ['Saldo disponible', '-$200.00'],
    ['Precio Total (incl. IVA)', '$52,908.00'],
  ];

  for (const [lbl, val] of totals) {
    const isMain = lbl.includes('Precio Total');
    const f = isMain ? fontBold : fontRegular;
    const c = isMain ? primaryBlue : darkSlate;
    page.drawText(lbl, { x: 370, y: totY, size: isMain ? 9.5 : 8.5, font: f, color: c });
    page.drawText(val, { x: 508, y: totY, size: isMain ? 9.5 : 8.5, font: f, color: c });
    totY -= 14;
  }

  // Conditions
  let condY = totY - 18;
  page.drawText('Condiciones', { x: 48, y: condY, size: 10, font: fontBold, color: darkSlate });
  condY -= 16;

  const conditions = [
    'Despues de realizar su pago, necesitamos 24 horas para procesar su pedido y enviarlo.',
    'La forma de envio es Estafeta Terrestre. Los tiempos de entrega mostrados estan calculados basados en que el pago total se realice hoy.',
    'La vigencia de esta cotizacion es hasta el 17.11.2026 o hasta agotar existencias.',
    'Precios en pesos mexicanos sujetos a cambios sin previo aviso.',
    'Pago anticipado, de contado, excepto cuando se especifique lo contrario.',
  ];

  for (const cond of conditions) {
    page.drawText(`*  ${cond}`, { x: 54, y: condY, size: 7.5, font: fontRegular, color: darkSlate });
    condY -= 12;
  }

  // Sign-off
  condY -= 12;
  page.drawText('Atentamente,', { x: 48, y: condY, size: 8.5, font: fontRegular, color: darkSlate });
  page.drawText('Kosto Ratkovich', { x: 48, y: condY - 12, size: 8.5, font: fontBold, color: darkSlate });
  page.drawText('kosto@abasteo.mx', { x: 48, y: condY - 24, size: 8, font: fontRegular, color: primaryBlue });
  page.drawText('(33) 4780 0901 Ext. 429', { x: 48, y: condY - 36, size: 8, font: fontRegular, color: darkSlate });
  page.drawText('www.abasteo.mx', { x: 48, y: condY - 48, size: 8, font: fontRegular, color: primaryBlue });

  // Footer Corporate
  page.drawRectangle({
    x: 48,
    y: 40,
    width: 516,
    height: 48,
    color: rgb(0.98, 0.98, 0.99),
    borderColor: tableBorder,
    borderWidth: 0.5,
  });
  page.drawText('CYBERPUERTA - RFC: CYB080602JSA', { x: 56, y: 72, size: 8, font: fontBold, color: darkSlate });
  page.drawText('Parque Industrial Alamo Business Park, Av. Patria S/N, Guadalajara, Jalisco CP 44490', {
    x: 56,
    y: 60,
    size: 7.5,
    font: fontRegular,
    color: grayMuted,
  });
  page.drawText('Para adquirir los productos cotizados, ingrese a su portal con su cuenta corporativa verificada.', {
    x: 56,
    y: 48,
    size: 7.5,
    font: fontRegular,
    color: grayMuted,
  });

  const bytes = await doc.save();
  writeFileSync(resolve(PRUEBAS_DIR, '01_Cotizacion_Comercial_Abasteo.pdf'), bytes);
  console.log('✓ Creado: 01_Cotizacion_Comercial_Abasteo.pdf');
}

// -----------------------------------------------------------------------------
// 2. FACTURA FISCAL CFDI 4.0
// -----------------------------------------------------------------------------
async function createFacturaFiscal() {
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]);
  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontMono = await doc.embedFont(StandardFonts.Courier);

  const brandGreen = rgb(0.08, 0.52, 0.36);
  const darkSlate = rgb(0.1, 0.12, 0.15);
  const grayBorder = rgb(0.82, 0.85, 0.9);

  // Top header banner
  page.drawRectangle({
    x: 36,
    y: 724,
    width: 540,
    height: 44,
    color: rgb(0.94, 0.98, 0.95),
    borderColor: brandGreen,
    borderWidth: 1,
  });
  page.drawText('COMPROBANTE FISCAL DIGITAL POR INTERNET (CFDI 4.0)', {
    x: 48,
    y: 746,
    size: 12,
    font: fontBold,
    color: brandGreen,
  });
  page.drawText('FACTURA ELECTRONICA INGRESO - SERIE A - FOLIO 4820', {
    x: 48,
    y: 732,
    size: 8.5,
    font: fontBold,
    color: darkSlate,
  });

  // Emisor & Receptor boxes
  page.drawRectangle({ x: 36, y: 624, width: 260, height: 90, color: rgb(1, 1, 1), borderColor: grayBorder, borderWidth: 1 });
  page.drawText('DATOS DEL EMISOR', { x: 44, y: 698, size: 8, font: fontBold, color: brandGreen });
  page.drawText('SOLUCIONES TECNOLOGICAS DE MEXICO S.A. DE C.V.', { x: 44, y: 684, size: 7.5, font: fontBold, color: darkSlate });
  page.drawText('RFC: STM1804229X1', { x: 44, y: 672, size: 8, font: fontMono, color: darkSlate });
  page.drawText('Regimen Fiscal: 601 General de Ley Personas Morales', { x: 44, y: 660, size: 7.5, font: fontRegular, color: darkSlate });
  page.drawText('Lugar de Expedicion: CP 06600, Ciudad de Mexico', { x: 44, y: 648, size: 7.5, font: fontRegular, color: darkSlate });
  page.drawText('Fecha de Emision: 2026-11-14T11:20:00', { x: 44, y: 636, size: 7.5, font: fontRegular, color: darkSlate });

  page.drawRectangle({ x: 306, y: 624, width: 270, height: 90, color: rgb(1, 1, 1), borderColor: grayBorder, borderWidth: 1 });
  page.drawText('DATOS DEL RECEPTOR', { x: 314, y: 698, size: 8, font: fontBold, color: brandGreen });
  page.drawText('INVERSIONES GLOBALES DEL PACIFICO S.C.', { x: 314, y: 684, size: 7.5, font: fontBold, color: darkSlate });
  page.drawText('RFC: IGP120914KL5', { x: 314, y: 672, size: 8, font: fontMono, color: darkSlate });
  page.drawText('Domicilio Fiscal Receptor: CP 44100', { x: 314, y: 660, size: 7.5, font: fontRegular, color: darkSlate });
  page.drawText('Uso CFDI: G03 Gastos en general', { x: 314, y: 648, size: 7.5, font: fontRegular, color: darkSlate });
  page.drawText('Metodo de Pago: PUE Pago en una sola exhibicion', { x: 314, y: 636, size: 7.5, font: fontRegular, color: darkSlate });

  // Concepts Table
  const tableY = 600;
  page.drawRectangle({ x: 36, y: tableY - 18, width: 540, height: 18, color: rgb(0.92, 0.94, 0.96) });
  page.drawText('Clave Prod', { x: 42, y: tableY - 13, size: 7.5, font: fontBold, color: darkSlate });
  page.drawText('Cantidad', { x: 106, y: tableY - 13, size: 7.5, font: fontBold, color: darkSlate });
  page.drawText('Descripcion del Servicio o Bien', { x: 160, y: tableY - 13, size: 7.5, font: fontBold, color: darkSlate });
  page.drawText('Valor Unitario', { x: 420, y: tableY - 13, size: 7.5, font: fontBold, color: darkSlate });
  page.drawText('Importe', { x: 510, y: tableY - 13, size: 7.5, font: fontBold, color: darkSlate });

  const rows = [
    ['43231500', '1', 'Licencia Anual Plataforma de Analisis PDF-LEF Enterprise v2.0', '$68,500.00', '$68,500.00'],
    ['81111811', '1', 'Poliza de Mantenimiento Preventivo y Soporte Tecnico 24/7', '$25,000.00', '$25,000.00'],
    ['80101504', '1', 'Consultoria de Implementacion e Integracion de Boveda Segura', '$25,000.00', '$25,000.00'],
  ];

  let rY = tableY - 36;
  for (const r of rows) {
    page.drawText(r[0], { x: 42, y: rY, size: 7.5, font: fontMono, color: darkSlate });
    page.drawText(r[1], { x: 120, y: rY, size: 8, font: fontRegular, color: darkSlate });
    page.drawText(r[2], { x: 160, y: rY, size: 8, font: fontRegular, color: darkSlate });
    page.drawText(r[3], { x: 430, y: rY, size: 8, font: fontRegular, color: darkSlate });
    page.drawText(r[4], { x: 518, y: rY, size: 8, font: fontBold, color: darkSlate });
    page.drawLine({ start: { x: 36, y: rY - 6 }, end: { x: 576, y: rY - 6 }, thickness: 0.5, color: grayBorder });
    rY -= 22;
  }

  // Totals Box
  page.drawRectangle({ x: 380, y: rY - 70, width: 196, height: 64, color: rgb(0.97, 0.98, 0.99), borderColor: grayBorder, borderWidth: 1 });
  page.drawText('Subtotal:', { x: 392, y: rY - 24, size: 8.5, font: fontRegular, color: darkSlate });
  page.drawText('$118,500.00 MXN', { x: 480, y: rY - 24, size: 8.5, font: fontRegular, color: darkSlate });
  page.drawText('Impuestos Trasladados (IVA 16%):', { x: 392, y: rY - 40, size: 7.5, font: fontRegular, color: darkSlate });
  page.drawText('$18,960.00 MXN', { x: 480, y: rY - 40, size: 7.5, font: fontRegular, color: darkSlate });
  page.drawText('TOTAL A PAGAR:', { x: 392, y: rY - 58, size: 9, font: fontBold, color: brandGreen });
  page.drawText('$137,460.00 MXN', { x: 480, y: rY - 58, size: 9, font: fontBold, color: brandGreen });

  // Fiscal Stamping metadata
  const stampY = rY - 95;
  page.drawRectangle({ x: 36, y: 50, width: 540, height: stampY - 50, color: rgb(1, 1, 1), borderColor: grayBorder, borderWidth: 1 });
  page.drawText('TIMBRE FISCAL DIGITAL DEL SAT', { x: 46, y: stampY - 14, size: 8, font: fontBold, color: brandGreen });
  page.drawText('Folio Fiscal (UUID): 8F4A1B2C-3D4E-4F5A-9B8C-1A2B3C4D5E6F', { x: 46, y: stampY - 28, size: 8, font: fontMono, color: darkSlate });
  page.drawText('No. de Serie del Certificado del Emisor: 00001000000508924112', { x: 46, y: stampY - 40, size: 7.5, font: fontMono, color: darkSlate });
  page.drawText('No. de Serie del Certificado del SAT: 00001000000504465028', { x: 46, y: stampY - 52, size: 7.5, font: fontMono, color: darkSlate });
  page.drawText('Fecha y Hora de Certificacion: 2026-11-14T11:21:45', { x: 46, y: stampY - 64, size: 7.5, font: fontMono, color: darkSlate });

  // Sello SAT block
  page.drawText('Sello Digital del CFDI:', { x: 46, y: stampY - 80, size: 7, font: fontBold, color: darkSlate });
  page.drawText('d8K2jL91mN0pQ7vR4tY6uI3wO5zP1aB7cD9eF2gH8iJ0kL2mN4oP6qR8sT0uV2wX4yZ6aB8cD0eF2gH4iJ6kL8mN0==', {
    x: 46,
    y: stampY - 90,
    size: 6,
    font: fontMono,
    color: darkSlate,
  });

  page.drawText('Cadena Original del Complemento de Certificacion Digital del SAT:', { x: 46, y: stampY - 104, size: 7, font: fontBold, color: darkSlate });
  page.drawText('||1.1|8F4A1B2C-3D4E-4F5A-9B8C-1A2B3C4D5E6F|2026-11-14T11:21:45|SAT970701NN3|d8K2jL91mN0pQ7vR4tY6==|00001000000504465028||', {
    x: 46,
    y: stampY - 114,
    size: 6,
    font: fontMono,
    color: darkSlate,
  });

  const bytes = await doc.save();
  writeFileSync(resolve(PRUEBAS_DIR, '02_Factura_Fiscal_CFDI.pdf'), bytes);
  console.log('✓ Creado: 02_Factura_Fiscal_CFDI.pdf');
}

// -----------------------------------------------------------------------------
// 3. CONTRATO DE PRESTACIÓN DE SERVICIOS (2 Páginas Legales)
// -----------------------------------------------------------------------------
async function createContratoServicios() {
  const doc = await PDFDocument.create();
  const fontRegular = await doc.embedFont(StandardFonts.TimesRoman);
  const fontBold = await doc.embedFont(StandardFonts.TimesRomanBold);
  const fontItalic = await doc.embedFont(StandardFonts.TimesRomanItalic);

  const darkSlate = rgb(0.12, 0.12, 0.12);

  // PAGE 1
  const page1 = doc.addPage([612, 792]);
  page1.drawText('CONTRATO PRIVADO DE PRESTACION DE SERVICIOS PROFESIONALES', {
    x: 72,
    y: 720,
    size: 11,
    font: fontBold,
    color: darkSlate,
  });
  page1.drawText('REUNIDOS', { x: 72, y: 690, size: 10, font: fontBold, color: darkSlate });

  const p1Text = [
    'De una parte, como EL PROVEEDOR, NEXUS TECNOLOGIAS AVANZADAS S.A., con CIF B-88492019,',
    'con domicilio en Paseo de la Reforma No. 404, Ciudad de Mexico, representada por D. Carlos',
    'Mendoza Alarcon con facultades bastantes segun escritura notarial de apoderamiento.',
    '',
    'De otra parte, como EL CLIENTE, CORPORATIVO DEL NORTE S.A.P.I. DE C.V., con RFC CNO1902118A4,',
    'con domicilio en Av. Lazaro Cardenas No. 1200, Monterrey, N.L., representada en este acto',
    'por D. Fernando Ortiz Morales.',
    '',
    'Ambas partes se reconocen mutuamente capacidad juridica legal suficiente para obligarse y suscribir el',
    'presente contrato bajo las siguientes:',
    '',
    'CLAUSULAS',
    '',
    'PRIMERA. - OBJETO DEL CONTRATO.',
    'EL PROVEEDOR se compromete a prestar a favor de EL CLIENTE los servicios especializados de auditoria,',
    'desarrollo e implementacion de la suite de gestion documental local y confidencial PDF-LEF Enterprise.',
    'Los servicios seran ejecutados respetando los estandares de maxima seguridad y cifrado en reposo.',
    '',
    'SEGUNDA. - HONORARIOS Y CONDICIONES DE PAGO.',
    'Como contraprestacion economica por los servicios contratados, EL CLIENTE abonara la cantidad de',
    '$350,000.00 MXN (Trescientos cincuenta mil pesos 00/100 M.N.) mas el Impuesto al Valor Agregado (IVA).',
    'El pago se distribuira en un 50% al inicio del proyecto y el 50% restante a la aceptacion formal del entregable.',
    '',
    'TERCERA. - CONFIDENCIALIDAD Y PROTECCION DE DATOS.',
    'Toda informacion intercambiada entre las partes tendra caracter estrictamente confidencial. EL PROVEEDOR',
    'garantiza que ningun documento procesado por la suite saldra de la red interna de EL CLIENTE, operando',
    'bajo la arquitectura 100% Offline y sin comunicacion con servidores de terceros en la nube.',
  ];

  let p1Y = 670;
  for (const line of p1Text) {
    if (line === '') {
      p1Y -= 8;
      continue;
    }
    const isHeader = line === 'REUNIDOS' || line === 'CLAUSULAS' || line.startsWith('PRIMERA') || line.startsWith('SEGUNDA') || line.startsWith('TERCERA');
    page1.drawText(line, {
      x: 72,
      y: p1Y,
      size: isHeader ? 9.5 : 8.5,
      font: isHeader ? fontBold : fontRegular,
      color: darkSlate,
    });
    p1Y -= 13;
  }

  page1.drawText('Pagina 1 de 2  -  Contrato Marco No. MSA-2026-991', {
    x: 210,
    y: 40,
    size: 8,
    font: fontItalic,
    color: rgb(0.5, 0.5, 0.5),
  });

  // PAGE 2
  const page2 = doc.addPage([612, 792]);
  const p2Text = [
    'CUARTA. - PLAZO DE EJECUCION Y VIGENCIA.',
    'El presente contrato entrara en vigor a partir del 15 de Noviembre de 2026 y tendra una vigencia inicial',
    'de doce (12) meses improrrogables salvo acuerdo expreso por escrito de ambas partes contratantes.',
    '',
    'QUINTA. - PROPIEDAD INTELECTUAL.',
    'Todos los derechos de propiedad intelectual resultantes de las configuraciones y desarrollos a medida',
    'perteneceran exclusivamente a EL CLIENTE una vez liquidado el importe total pactado en la Clausula Segunda.',
    '',
    'SEXTA. - JURISDICCION Y LEY APLICABLE.',
    'Para la resolucion de cualquier conflicto derivado de la interpretacion o ejecucion del presente contrato,',
    'las partes se someten expresamente a la jurisdiccion y competencia de los Tribunales de la Ciudad de Mexico,',
    'renunciando a cualquier otro fuero que pudiera corresponderles por razon de sus domicilios presentes o futuros.',
    '',
    'Leido que fue el presente instrumento y enteradas las partes de su fuerza legal, lo firman por duplicado en',
    'la fecha y lugar expresados en el encabezamiento.',
  ];

  let p2Y = 720;
  for (const line of p2Text) {
    if (line === '') {
      p2Y -= 8;
      continue;
    }
    const isHeader = line.startsWith('CUARTA') || line.startsWith('QUINTA') || line.startsWith('SEXTA');
    page2.drawText(line, {
      x: 72,
      y: p2Y,
      size: isHeader ? 9.5 : 8.5,
      font: isHeader ? fontBold : fontRegular,
      color: darkSlate,
    });
    p2Y -= 13;
  }

  // Signature Blocks
  p2Y -= 40;
  page2.drawText('POR EL PROVEEDOR:', { x: 90, y: p2Y, size: 9, font: fontBold, color: darkSlate });
  page2.drawText('POR EL CLIENTE:', { x: 360, y: p2Y, size: 9, font: fontBold, color: darkSlate });

  p2Y -= 60;
  page2.drawLine({ start: { x: 80, y: p2Y }, end: { x: 260, y: p2Y }, thickness: 1, color: darkSlate });
  page2.drawLine({ start: { x: 350, y: p2Y }, end: { x: 530, y: p2Y }, thickness: 1, color: darkSlate });

  page2.drawText('D. Carlos Mendoza Alarcon', { x: 96, y: p2Y - 14, size: 8.5, font: fontRegular, color: darkSlate });
  page2.drawText('Director General - NEXUS TECH', { x: 88, y: p2Y - 26, size: 7.5, font: fontItalic, color: darkSlate });

  page2.drawText('D. Fernando Ortiz Morales', { x: 370, y: p2Y - 14, size: 8.5, font: fontRegular, color: darkSlate });
  page2.drawText('Director de Operaciones - CORP DEL NORTE', { x: 350, y: p2Y - 26, size: 7.5, font: fontItalic, color: darkSlate });

  page2.drawText('Pagina 2 de 2  -  Contrato Marco No. MSA-2026-991', {
    x: 210,
    y: 40,
    size: 8,
    font: fontItalic,
    color: rgb(0.5, 0.5, 0.5),
  });

  const bytes = await doc.save();
  writeFileSync(resolve(PRUEBAS_DIR, '03_Contrato_Prestacion_Servicios.pdf'), bytes);
  console.log('✓ Creado: 03_Contrato_Prestacion_Servicios.pdf');
}

// -----------------------------------------------------------------------------
// 4. REPORTE FINANCIERO EJECUTIVO Q3/Q4 2026
// -----------------------------------------------------------------------------
async function createReporteFinanciero() {
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]);
  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const brandNavy = rgb(0.09, 0.18, 0.36);
  const accentGold = rgb(0.85, 0.55, 0.1);
  const darkSlate = rgb(0.12, 0.14, 0.18);
  const grayBorder = rgb(0.84, 0.87, 0.92);

  // Executive Top Banner
  page.drawRectangle({ x: 36, y: 710, width: 540, height: 50, color: brandNavy });
  page.drawText('INFORME EJECUTIVO DE DESEMPENO FINANCIERO - Q3/Q4 2026', {
    x: 50,
    y: 736,
    size: 13,
    font: fontBold,
    color: rgb(1, 1, 1),
  });
  page.drawText('GRUPO INDUSTRIAL PANAMERICANO S.A.B. DE C.V.  *  DIVISION TECNOLOGIA', {
    x: 50,
    y: 722,
    size: 8,
    font: fontBold,
    color: accentGold,
  });

  // 3 KPI Metric Cards
  const cards = [
    { title: 'INGRESOS CONSOLIDADOS', value: '$24.8M USD', sub: '+18.4% vs periodo anterior' },
    { title: 'MARGEN OPERATIVO EBITDA', value: '32.6%', sub: '+240 bps expansion de margen' },
    { title: 'FLUJO LIBRE DE CAJA', value: '$6.2M USD', sub: 'Conversion de caja al 92%' },
  ];

  let cX = 36;
  for (const c of cards) {
    page.drawRectangle({ x: cX, y: 624, width: 172, height: 72, color: rgb(0.97, 0.98, 1), borderColor: grayBorder, borderWidth: 1 });
    page.drawText(c.title, { x: cX + 10, y: 678, size: 7.5, font: fontBold, color: brandNavy });
    page.drawText(c.value, { x: cX + 10, y: 654, size: 16, font: fontBold, color: darkSlate });
    page.drawText(c.sub, { x: cX + 10, y: 636, size: 7, font: fontRegular, color: rgb(0.2, 0.6, 0.3) });
    cX += 184;
  }

  // Summary Paragraph
  page.drawText('RESUMEN ESTRATEGICO Y PERSPECTIVAS', { x: 36, y: 602, size: 10, font: fontBold, color: brandNavy });
  const summaryLines = [
    'Durante el segundo semestre de 2026, la compania acelero la transicion hacia soluciones de software',
    'nativas y seguras para reducir costos recurrentes de licenciamiento en la nube. La implementacion de',
    'PDF-LEF en toda la plantilla genero un ahorro estimado directo de $180,000 USD anuales en suscripciones,',
    'eliminando vulnerabilidades de fuga de datos en documentos confidenciales y mejorando la productividad.',
  ];
  let sY = 586;
  for (const sl of summaryLines) {
    page.drawText(sl, { x: 36, y: sY, size: 8.5, font: fontRegular, color: darkSlate });
    sY -= 13;
  }

  // Financial Breakdown Table
  const tY = sY - 16;
  page.drawText('DESGLOSE DE RESULTADOS POR REGION OPERATIVA (CIFRAS EN MILES DE USD)', {
    x: 36,
    y: tY,
    size: 8.5,
    font: fontBold,
    color: brandNavy,
  });

  page.drawRectangle({ x: 36, y: tY - 20, width: 540, height: 18, color: brandNavy });
  page.drawText('Region Comercial', { x: 44, y: tY - 14, size: 7.5, font: fontBold, color: rgb(1, 1, 1) });
  page.drawText('Q3 2025', { x: 220, y: tY - 14, size: 7.5, font: fontBold, color: rgb(1, 1, 1) });
  page.drawText('Q3 2026', { x: 300, y: tY - 14, size: 7.5, font: fontBold, color: rgb(1, 1, 1) });
  page.drawText('Crecimiento (%)', { x: 390, y: tY - 14, size: 7.5, font: fontBold, color: rgb(1, 1, 1) });
  page.drawText('Margen Bruto', { x: 490, y: tY - 14, size: 7.5, font: fontBold, color: rgb(1, 1, 1) });

  const fRows = [
    ['Norteamerica (Mexico / EE.UU.)', '$11,400', '$13,850', '+21.5%', '44.2%'],
    ['Cono Sur (Brasil / Chile / Arg.)', '$5,820', '$6,910', '+18.7%', '38.6%'],
    ['Region Andina y Centroamerica', '$3,710', '$4,040', '+8.9%', '36.1%'],
    ['TOTAL CONSOLIDADO', '$20,930', '$24,800', '+18.4%', '41.3%'],
  ];

  let rY = tY - 36;
  for (const fr of fRows) {
    const isTotal = fr[0].startsWith('TOTAL');
    const f = isTotal ? fontBold : fontRegular;
    page.drawText(fr[0], { x: 44, y: rY, size: 8, font: f, color: darkSlate });
    page.drawText(fr[1], { x: 224, y: rY, size: 8, font: f, color: darkSlate });
    page.drawText(fr[2], { x: 304, y: rY, size: 8, font: f, color: darkSlate });
    page.drawText(fr[3], { x: 400, y: rY, size: 8, font: f, color: darkSlate });
    page.drawText(fr[4], { x: 504, y: rY, size: 8, font: f, color: darkSlate });
    page.drawLine({ start: { x: 36, y: rY - 6 }, end: { x: 576, y: rY - 6 }, thickness: isTotal ? 1 : 0.5, color: grayBorder });
    rY -= 20;
  }

  // Footnote and Sign-off
  rY -= 20;
  page.drawText('DICTAMEN DE AUDITORIA INTERNA', { x: 36, y: rY, size: 9, font: fontBold, color: brandNavy });
  page.drawText('Los estados financieros consolidados han sido preparados con estricta sujecion a las Normas Internacionales de', {
    x: 36,
    y: rY - 14,
    size: 7.5,
    font: fontRegular,
    color: darkSlate,
  });
  page.drawText('Informacion Financiera (NIIF/IFRS). Auditor responsable: Lic. Mariana Garza Valenzuela, CP 49102-MX.', {
    x: 36,
    y: rY - 26,
    size: 7.5,
    font: fontRegular,
    color: darkSlate,
  });

  const bytes = await doc.save();
  writeFileSync(resolve(PRUEBAS_DIR, '04_Reporte_Financiero_Ejecutivo.pdf'), bytes);
  console.log('✓ Creado: 04_Reporte_Financiero_Ejecutivo.pdf');
}

// -----------------------------------------------------------------------------
// 5. CONSTANCIA LABORAL Y RECIBO DE NÓMINA
// -----------------------------------------------------------------------------
async function createConstanciaNomina() {
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]);
  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontMono = await doc.embedFont(StandardFonts.Courier);

  const brandPurple = rgb(0.32, 0.16, 0.56);
  const darkSlate = rgb(0.1, 0.12, 0.16);
  const grayBorder = rgb(0.84, 0.86, 0.9);

  // Header
  page.drawRectangle({ x: 36, y: 720, width: 540, height: 44, color: rgb(0.96, 0.94, 0.99), borderColor: brandPurple, borderWidth: 1 });
  page.drawText('CONSTANCIA LABORAL Y RECIBO DE PERCEPCIONES', { x: 48, y: 742, size: 12, font: fontBold, color: brandPurple });
  page.drawText('DEPARTAMENTO DE RECURSOS HUMANOS Y COMPENSACIONES  *  PERIODO: NOVIEMBRE 2026', {
    x: 48,
    y: 728,
    size: 8,
    font: fontBold,
    color: darkSlate,
  });

  // Employee Profile Card
  page.drawRectangle({ x: 36, y: 636, width: 540, height: 72, color: rgb(1, 1, 1), borderColor: grayBorder, borderWidth: 1 });
  page.drawText('Nombre del Colaborador:', { x: 48, y: 690, size: 8, font: fontBold, color: darkSlate });
  page.drawText('Ing. Laura Morales Sanchez', { x: 160, y: 690, size: 8.5, font: fontBold, color: brandPurple });
  page.drawText('No. de Empleado:', { x: 360, y: 690, size: 8, font: fontBold, color: darkSlate });
  page.drawText('EMP-2021-0842', { x: 450, y: 690, size: 8, font: fontMono, color: darkSlate });

  page.drawText('Puesto Desempenado:', { x: 48, y: 672, size: 8, font: fontBold, color: darkSlate });
  page.drawText('Directora de Arquitectura de Software', { x: 160, y: 672, size: 8, font: fontRegular, color: darkSlate });
  page.drawText('Fecha de Ingreso:', { x: 360, y: 672, size: 8, font: fontBold, color: darkSlate });
  page.drawText('15 de Marzo de 2021 (5 anos de antiguedad)', { x: 450, y: 672, size: 8, font: fontRegular, color: darkSlate });

  page.drawText('Departamento / Area:', { x: 48, y: 654, size: 8, font: fontBold, color: darkSlate });
  page.drawText('Ingenieria de Sistemas y Boveda Local', { x: 160, y: 654, size: 8, font: fontRegular, color: darkSlate });
  page.drawText('Tipo de Contrato:', { x: 360, y: 654, size: 8, font: fontBold, color: darkSlate });
  page.drawText('Tiempo Indeterminado (Planta)', { x: 450, y: 654, size: 8, font: fontRegular, color: darkSlate });

  // Breakdown Columns (Percepciones vs Deducciones)
  const colY = 604;
  page.drawRectangle({ x: 36, y: colY - 18, width: 260, height: 18, color: rgb(0.94, 0.97, 0.95) });
  page.drawText('PERCEPCIONES (INGRESOS BRUTOS)', { x: 44, y: colY - 13, size: 8, font: fontBold, color: rgb(0.1, 0.5, 0.2) });

  page.drawRectangle({ x: 316, y: colY - 18, width: 260, height: 18, color: rgb(0.99, 0.94, 0.94) });
  page.drawText('DEDUCCIONES Y RETENCIONES', { x: 324, y: colY - 13, size: 8, font: fontBold, color: rgb(0.7, 0.15, 0.15) });

  const percepciones = [
    ['001 Sueldo Base Mensual', '$65,000.00'],
    ['002 Bono de Responsabilidad Tecnica', '$12,000.00'],
    ['003 Vales de Despensa Electranicos', '$4,200.00'],
    ['004 Fondo de Ahorro Patronal (13%)', '$8,450.00'],
  ];

  const deducciones = [
    ['101 Retencion ISR Mensual', '$16,420.00'],
    ['102 Cuota Obrera IMSS / Seguridad Social', '$2,850.00'],
    ['103 Fondo de Ahorro Trabajador (13%)', '$8,450.00'],
    ['104 Seguro de Gastos Medicos Mayores', '$1,200.00'],
  ];

  let pY = colY - 36;
  for (let i = 0; i < percepciones.length; i++) {
    page.drawText(percepciones[i][0], { x: 44, y: pY, size: 7.5, font: fontRegular, color: darkSlate });
    page.drawText(percepciones[i][1], { x: 236, y: pY, size: 7.5, font: fontBold, color: darkSlate });

    page.drawText(deducciones[i][0], { x: 324, y: pY, size: 7.5, font: fontRegular, color: darkSlate });
    page.drawText(deducciones[i][1], { x: 516, y: pY, size: 7.5, font: fontBold, color: darkSlate });

    page.drawLine({ start: { x: 36, y: pY - 5 }, end: { x: 296, y: pY - 5 }, thickness: 0.5, color: grayBorder });
    page.drawLine({ start: { x: 316, y: pY - 5 }, end: { x: 576, y: pY - 5 }, thickness: 0.5, color: grayBorder });
    pY -= 18;
  }

  // Net Pay Box
  page.drawRectangle({ x: 36, y: pY - 36, width: 540, height: 32, color: rgb(0.96, 0.94, 0.99), borderColor: brandPurple, borderWidth: 1 });
  page.drawText('Total Percepciones: $89,650.00 MXN', { x: 48, y: pY - 24, size: 8.5, font: fontBold, color: darkSlate });
  page.drawText('Total Deducciones: $28,920.00 MXN', { x: 230, y: pY - 24, size: 8.5, font: fontBold, color: darkSlate });
  page.drawText('NETO A RECIBIR: $60,730.00 MXN', { x: 400, y: pY - 24, size: 9, font: fontBold, color: brandPurple });

  // Formal Certification Statement
  pY -= 60;
  page.drawText('CERTIFICACION DE RECURSOS HUMANOS', { x: 36, y: pY, size: 9.5, font: fontBold, color: brandPurple });
  const certLines = [
    'A peticion de la parte interesada y para los fines legales, crediticios o personales que a la misma convengan,',
    'se expide la presente constancia laboral en la Ciudad de Mexico, a los 14 dias del mes de Noviembre de 2026.',
    'Se hace constar que la trabajadora ha demostrado en todo momento alta responsabilidad, probidad y cumplimiento.',
  ];
  let cY = pY - 16;
  for (const cl of certLines) {
    page.drawText(cl, { x: 36, y: cY, size: 8, font: fontRegular, color: darkSlate });
    cY -= 13;
  }

  // Official Signature & Stamp line
  cY -= 45;
  page.drawLine({ start: { x: 200, y: cY }, end: { x: 412, y: cY }, thickness: 1, color: darkSlate });
  page.drawText('Lic. Veronica Dominguez Robles', { x: 236, y: cY - 14, size: 8.5, font: fontBold, color: darkSlate });
  page.drawText('Directora General de Capital Humano', { x: 234, y: cY - 26, size: 7.5, font: fontRegular, color: darkSlate });
  page.drawText('Sello Digital de Validacion: LEF-NOM-2026-9041284', { x: 218, y: cY - 38, size: 7, font: fontMono, color: brandPurple });

  const bytes = await doc.save();
  writeFileSync(resolve(PRUEBAS_DIR, '05_Certificado_Laboral_Nomina.pdf'), bytes);
  console.log('✓ Creado: 05_Certificado_Laboral_Nomina.pdf');
}

async function main() {
  console.log('Generando los 5 documentos reales de prueba en /pruebas ...');
  await createCotizacionAbasteo();
  await createFacturaFiscal();
  await createContratoServicios();
  await createReporteFinanciero();
  await createConstanciaNomina();
  console.log('¡Todos los 5 documentos de prueba han sido generados exitosamente!');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
