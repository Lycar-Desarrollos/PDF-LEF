import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type {
  AppSettings,
  DocumentMetadata,
  FontFamilyChoice,
  NativePdfTextItem,
  OutlineNode,
  PageDescriptor,
  PdfTabDocument,
  ScaleCalibration,
} from '../types/pdf';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const docProxyCache = new Map<string, Promise<pdfjsLib.PDFDocumentProxy>>();

export function getPdfJsProxy(
  sourceId: string,
  bytes: Uint8Array
): Promise<pdfjsLib.PDFDocumentProxy> {
  const cached = docProxyCache.get(sourceId);
  if (cached) return cached;

  // Give PDF.js its own copy of Uint8Array because transferring to worker detaches the buffer!
  const cloned = new Uint8Array(bytes.byteLength);
  cloned.set(bytes);

  const loadingTask = pdfjsLib.getDocument({
    data: cloned,
    useSystemFonts: true,
  });
  const promise = loadingTask.promise;
  docProxyCache.set(sourceId, promise);
  return promise;
}

export async function renderPageToCanvas(
  sourceId: string,
  sourceBytes: Uint8Array | undefined,
  pageDesc: PageDescriptor,
  canvas: HTMLCanvasElement,
  scale: number,
  hiDpi = true
): Promise<{ cssWidth: number; cssHeight: number }> {
  const dpr = hiDpi ? Math.min(window.devicePixelRatio || 1, 2.25) : 1;

  if (pageDesc.sourceId === 'blank' || !sourceBytes) {
    const rot = ((pageDesc.rotation % 360) + 360) % 360;
    const swapped = rot === 90 || rot === 270;
    const cssWidth = (swapped ? pageDesc.heightPt : pageDesc.widthPt) * scale;
    const cssHeight = (swapped ? pageDesc.widthPt : pageDesc.heightPt) * scale;
    canvas.width = Math.max(1, Math.floor(cssWidth * dpr));
    canvas.height = Math.max(1, Math.floor(cssHeight * dpr));
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    return { cssWidth, cssHeight };
  }

  const pdf = await getPdfJsProxy(sourceId, sourceBytes);
  const page = await pdf.getPage(pageDesc.sourcePageIndex + 1);
  const totalRotation = (page.rotate + pageDesc.rotation) % 360;
  const cssViewport = page.getViewport({ scale, rotation: totalRotation });
  const renderViewport = page.getViewport({ scale: scale * dpr, rotation: totalRotation });

  canvas.width = Math.max(1, Math.floor(renderViewport.width));
  canvas.height = Math.max(1, Math.floor(renderViewport.height));
  canvas.style.width = `${cssViewport.width}px`;
  canvas.style.height = `${cssViewport.height}px`;

  const ctx = canvas.getContext('2d', { alpha: false });
  if (ctx) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({
      canvasContext: ctx,
      canvas,
      viewport: renderViewport,
    }).promise;
  }

  return { cssWidth: cssViewport.width, cssHeight: cssViewport.height };
}

function guessFontChoice(fontName: string): {
  family: FontFamilyChoice;
  weight: 'normal' | 'bold';
  style: 'normal' | 'italic';
} {
  const lower = (fontName || '').toLowerCase();
  const weight: 'normal' | 'bold' =
    lower.includes('bold') || lower.includes('black') || lower.includes('demi')
      ? 'bold'
      : 'normal';
  const style: 'normal' | 'italic' =
    lower.includes('italic') || lower.includes('oblique') ? 'italic' : 'normal';
  let family: FontFamilyChoice = 'sans';
  if (lower.includes('times') || lower.includes('georgia') || lower.includes('garamond') || lower.includes('serif')) {
    family = 'serif';
  } else if (lower.includes('courier') || lower.includes('mono') || lower.includes('consolas')) {
    family = 'mono';
  }
  return { family, weight, style };
}

/**
 * Extracts real existing text runs from a PDF page and merges adjacent words on the same baseline
 * so the user can directly click, edit, move, resize, or delete ANY existing text in the PDF!
 */
export async function extractNativeEditableTexts(
  sourceId: string,
  sourceBytes: Uint8Array | undefined,
  pageDesc: PageDescriptor
): Promise<NativePdfTextItem[]> {
  if (pageDesc.sourceId === 'blank' || !sourceBytes) return [];

  const pdf = await getPdfJsProxy(sourceId, sourceBytes);
  const page = await pdf.getPage(pageDesc.sourcePageIndex + 1);
  const totalRotation = (page.rotate + pageDesc.rotation) % 360;
  const viewport = page.getViewport({ scale: 1, rotation: totalRotation });
  const textContent = await page.getTextContent();

  // Optional subtle background color sampling at 0.5x scale
  const sampleCanvas = document.createElement('canvas');
  const sampleScale = 0.5;
  const sampleVp = page.getViewport({ scale: sampleScale, rotation: totalRotation });
  sampleCanvas.width = Math.max(1, Math.floor(sampleVp.width));
  sampleCanvas.height = Math.max(1, Math.floor(sampleVp.height));
  const sCtx = sampleCanvas.getContext('2d', { willReadFrequently: true });
  if (sCtx) {
    sCtx.fillStyle = '#ffffff';
    sCtx.fillRect(0, 0, sampleCanvas.width, sampleCanvas.height);
    await page.render({ canvasContext: sCtx, canvas: sampleCanvas, viewport: sampleVp }).promise;
  }

  interface RawFragment {
    left: number;
    top: number;
    width: number;
    height: number;
    fontSize: number;
    str: string;
    fontName: string;
  }

  const fragments: RawFragment[] = [];
  for (const item of textContent.items) {
    if (!('str' in item)) continue;
    const str = item.str;
    if (!str || !str.trim()) continue;

    const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);
    const fontHeight = Math.max(7, Math.hypot(tx[2], tx[3]));
    const left = tx[4];
    const baselineY = tx[5];
    const top = baselineY - fontHeight * 0.86;
    const width = Math.max(8, item.width * viewport.scale || str.length * fontHeight * 0.52);
    const height = fontHeight * 1.18;

    fragments.push({
      left,
      top,
      width,
      height,
      fontSize: fontHeight,
      str,
      fontName: item.fontName || '',
    });
  }

  // Sort top-to-bottom, left-to-right and merge same-line adjacent runs
  fragments.sort((a, b) => (Math.abs(a.top - b.top) > 3 ? a.top - b.top : a.left - b.left));

  const merged: RawFragment[] = [];
  for (const frag of fragments) {
    const prev = merged[merged.length - 1];
    if (
      prev &&
      Math.abs(prev.top - frag.top) <= Math.max(3, prev.fontSize * 0.28) &&
      Math.abs(prev.fontSize - frag.fontSize) <= 2.2 &&
      frag.left >= prev.left - 2 &&
      frag.left - (prev.left + prev.width) <= prev.fontSize * 1.65
    ) {
      const gap = frag.left - (prev.left + prev.width);
      const needsSpace =
        gap > prev.fontSize * 0.14 && !prev.str.endsWith(' ') && !frag.str.startsWith(' ');
      prev.str = `${prev.str}${needsSpace ? ' ' : ''}${frag.str}`;
      prev.width = Math.max(prev.width, frag.left + frag.width - prev.left);
      prev.height = Math.max(prev.height, frag.height);
    } else {
      merged.push({ ...frag });
    }
  }

  const vw = Math.max(1, viewport.width);
  const vh = Math.max(1, viewport.height);

  return merged.map((m, idx) => {
    const normX = Math.max(0, Math.min(0.98, m.left / vw));
    const normY = Math.max(0, Math.min(0.98, m.top / vh));
    const normW = Math.max(0.02, Math.min(1 - normX, (m.width + 4) / vw));
    const normH = Math.max(0.014, Math.min(1 - normY, (m.height + 2) / vh));

    let bgPatchColor = '#ffffff';
    let textColor = '#14161a';
    if (sCtx) {
      // Sample corner pixel slightly outside glyph bounding box for exact paper tint
      const sx = Math.max(0, Math.min(sampleCanvas.width - 1, Math.floor((m.left - 2) * sampleScale)));
      const sy = Math.max(0, Math.min(sampleCanvas.height - 1, Math.floor((m.top - 2) * sampleScale)));
      const px = sCtx.getImageData(sx, sy, 1, 1).data;
      bgPatchColor = `#${[px[0], px[1], px[2]]
        .map((v) => v.toString(16).padStart(2, '0'))
        .join('')}`;
      const lum = 0.299 * px[0] + 0.587 * px[1] + 0.114 * px[2];
      if (lum < 95) {
        textColor = '#ffffff';
      }
    }

    const fontInfo = guessFontChoice(m.fontName);

    return {
      id: `ntxt_${pageDesc.id}_${idx}`,
      pageId: pageDesc.id,
      origX: normX,
      origY: normY,
      origWidth: normW,
      origHeight: normH,
      x: normX,
      y: normY,
      width: normW,
      height: normH,
      originalText: m.str,
      text: m.str,
      fontSizePt: Math.round(m.fontSize * 10) / 10,
      fontFamily: fontInfo.family,
      fontWeight: fontInfo.weight,
      fontStyle: fontInfo.style,
      color: textColor,
      bgPatchColor,
      deleted: false,
      modified: false,
    };
  });
}

export async function loadPdfIntoTabDocument(
  fileName: string,
  bytes: Uint8Array,
  settings: AppSettings,
  filePath?: string
): Promise<PdfTabDocument> {
  const sourceId = `src_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const pdfJsDoc = await getPdfJsProxy(sourceId, bytes);

  let metadata: DocumentMetadata = {
    title: fileName.replace(/\.pdf$/i, ''),
    author: '',
    subject: '',
    keywords: '',
    creator: 'PDF-LEF Studio Pro',
    producer: 'PDF-LEF Native Engine',
  };

  try {
    const metaRes = await pdfJsDoc.getMetadata();
    const info = (metaRes?.info || {}) as Record<string, string>;
    metadata = {
      title: info.Title || metadata.title,
      author: info.Author || '',
      subject: info.Subject || '',
      keywords: info.Keywords || '',
      creator: info.Creator || 'PDF-LEF Studio Pro',
      producer: info.Producer || 'PDF-LEF Native Engine',
    };
  } catch {
    // Ignore malformed PDF metadata
  }

  const pages: PageDescriptor[] = [];
  for (let i = 0; i < pdfJsDoc.numPages; i++) {
    const p = await pdfJsDoc.getPage(i + 1);
    const vp = p.getViewport({ scale: 1 });
    pages.push({
      id: `page_${sourceId}_${i}_${Math.random().toString(36).slice(2, 6)}`,
      sourceId,
      sourcePageIndex: i,
      rotation: 0,
      widthPt: vp.width,
      heightPt: vp.height,
    });
  }

  return {
    id: `tab_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    fileName,
    filePath,
    fileSize: bytes.byteLength,
    isModified: false,
    openedAt: Date.now(),
    sourceBuffers: { [sourceId]: bytes },
    pages,
    elements: [],
    nativeTextEdits: {},
    extractedPageTexts: {},
    watermark: {
      enabled: false,
      text: 'CONFIDENCIAL',
      color: '#C81E32',
      opacity: 0.14,
      fontSizePt: 48,
      rotation: -35,
      tiled: false,
    },
    headerFooter: {
      enabled: false,
      headerLeft: '',
      headerRight: '',
      footerCenterPattern: 'page-of-total',
      batesPrefix: 'LEF-',
      batesStart: 1,
      customFooter: '',
      fontSizePt: 9.5,
      color: '#525866',
    },
    metadata,
    scaleCalibration: {
      preset: '1:100',
      ratio: 100,
      unit: 'm',
    },
    nextCalloutNumber: 1,
    currentPageIndex: 0,
    zoom: settings.defaultZoom,
    viewLayout: settings.defaultViewLayout,
    paperFilter: settings.defaultPaperFilter,
    undoStack: [],
    redoStack: [],
  };
}

export async function extractPdfOutline(tab: PdfTabDocument): Promise<OutlineNode[]> {
  const firstSourceId = Object.keys(tab.sourceBuffers)[0];
  if (!firstSourceId) return [];
  const bytes = tab.sourceBuffers[firstSourceId];
  if (!bytes) return [];

  try {
    const pdf = await getPdfJsProxy(firstSourceId, bytes);
    const rawOutline = await pdf.getOutline();
    if (!rawOutline || rawOutline.length === 0) return [];

    const mapNodes = async (items: typeof rawOutline): Promise<OutlineNode[]> => {
      const nodes: OutlineNode[] = [];
      for (const item of items) {
        let pageIndex = 0;
        try {
          let dest = item.dest;
          if (typeof dest === 'string') {
            dest = await pdf.getDestination(dest);
          }
          if (Array.isArray(dest) && dest[0]) {
            pageIndex = await pdf.getPageIndex(dest[0]);
          }
        } catch {
          pageIndex = 0;
        }
        const children = item.items?.length ? await mapNodes(item.items) : [];
        nodes.push({
          title: item.title || 'Sección',
          pageIndex,
          children,
        });
      }
      return nodes;
    };

    return mapNodes(rawOutline);
  } catch {
    return [];
  }
}

export interface SearchMatchResult {
  pageIndex: number;
  pageNumber: number;
  snippet: string;
  occurrences: number;
}

export async function searchInTabDocument(
  tab: PdfTabDocument,
  query: string
): Promise<SearchMatchResult[]> {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const results: SearchMatchResult[] = [];

  for (let idx = 0; idx < tab.pages.length; idx++) {
    const pd = tab.pages[idx];
    let fullText = '';

    if (pd.sourceId !== 'blank' && tab.sourceBuffers[pd.sourceId]) {
      const pdf = await getPdfJsProxy(pd.sourceId, tab.sourceBuffers[pd.sourceId]);
      const page = await pdf.getPage(pd.sourcePageIndex + 1);
      const tc = await page.getTextContent();
      fullText = tc.items
        .map((it) => ('str' in it ? it.str : ''))
        .join(' ');
    }

    // Also include overlay texts on this page
    const extra = tab.elements
      .filter((el) => el.pageId === pd.id && el.text)
      .map((el) => el.text)
      .join(' ');
    const combined = `${fullText} ${extra}`.trim();
    const lower = combined.toLowerCase();

    let pos = lower.indexOf(q);
    if (pos !== -1) {
      let count = 0;
      const firstPos = pos;
      while (pos !== -1) {
        count++;
        pos = lower.indexOf(q, pos + q.length);
      }
      const start = Math.max(0, firstPos - 36);
      const end = Math.min(combined.length, firstPos + q.length + 52);
      const snippet = `${start > 0 ? '…' : ''}${combined.slice(start, end)}${
        end < combined.length ? '…' : ''
      }`;
      results.push({
        pageIndex: idx,
        pageNumber: idx + 1,
        snippet,
        occurrences: count,
      });
    }
  }

  return results;
}

export async function createBlankPdfBytes(
  widthPt = 595.28,
  heightPt = 841.89
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.addPage([widthPt, heightPt]);
  return doc.save();
}

/**
 * Generates an interactive 3-page Executive Sample PDF in Spanish
 * so the user can test Direct Existing-Text Editing, Moving Text, Adding Images,
 * Signatures, Stamps, and Page Reordering immediately!
 */
export async function generateShowcaseSamplePdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle('Propuesta Ejecutiva y Acuerdo Comercial — PDF-LEF');
  doc.setAuthor('Lycar Desarrollos');
  doc.setSubject('Documento interactivo de demostración');
  doc.setCreator('PDF-LEF Studio Pro');

  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontReg = await doc.embedFont(StandardFonts.Helvetica);
  const fontMono = await doc.embedFont(StandardFonts.Courier);

  const ruby = rgb(0.784, 0.118, 0.196);
  const dark = rgb(0.08, 0.09, 0.11);
  const muted = rgb(0.36, 0.39, 0.45);
  const lightBox = rgb(0.965, 0.97, 0.98);

  // PAGE 1: Commercial Proposal & Editable Pricing Table
  const p1 = doc.addPage([595.28, 841.89]);
  p1.drawRectangle({ x: 48, y: 760, width: 6, height: 38, color: ruby });
  p1.drawText('LYCAR DESARROLLOS · PDF-LEF STUDIO PRO', {
    x: 64,
    y: 785,
    size: 10,
    font: fontBold,
    color: ruby,
  });
  p1.drawText('Propuesta Comercial y Licencia Corporativa', {
    x: 64,
    y: 763,
    size: 20,
    font: fontBold,
    color: dark,
  });
  p1.drawText('Folio: LEF-2026-0842   |   Fecha: 13 de Noviembre de 2026', {
    x: 48,
    y: 730,
    size: 10.5,
    font: fontMono,
    color: muted,
  });

  p1.drawRectangle({ x: 48, y: 632, width: 499, height: 80, color: lightBox });
  p1.drawText('PRUEBA LA EDICION DIRECTA DE TEXTO EXISTENTE:', {
    x: 64,
    y: 690,
    size: 10.5,
    font: fontBold,
    color: ruby,
  });
  p1.drawText('1. Activa el modo "Editar y Anotar" -> "Editar Texto del PDF".', {
    x: 64,
    y: 671,
    size: 10.5,
    font: fontReg,
    color: dark,
  });
  p1.drawText('2. Haz clic sobre cualquier texto de esta pagina para cambiarlo o arrastralo para moverlo.', {
    x: 64,
    y: 653,
    size: 10.5,
    font: fontReg,
    color: dark,
  });

  p1.drawText('1. Resumen del Proyecto', {
    x: 48,
    y: 595,
    size: 14,
    font: fontBold,
    color: dark,
  });
  p1.drawText(
    'El presente documento establece las condiciones de entrega de la suite nativa para Windows.',
    { x: 48, y: 573, size: 11, font: fontReg, color: muted }
  );
  p1.drawText(
    'Incluye edicion de texto real, insercion de imagenes, firmas sin fondo y organizacion total.',
    { x: 48, y: 556, size: 11, font: fontReg, color: muted }
  );

  p1.drawText('2. Desglose Economico (Editable)', {
    x: 48,
    y: 515,
    size: 14,
    font: fontBold,
    color: dark,
  });

  const rows = [
    ['Concepto', 'Cantidad', 'Importe USD'],
    ['Licencia Empresarial PDF-LEF Windows 11', '25 puestos', '$ 1,250.00'],
    ['Modulo de Firmas y Sellos Locales Offline', 'Incluido', '$ 0.00'],
    ['Soporte Prioritario y Actualizaciones Anuales', '12 meses', '$ 340.00'],
    ['TOTAL NETO A FACTURAR', '', '$ 1,590.00'],
  ];

  let ry = 482;
  rows.forEach((r, idx) => {
    const isHeader = idx === 0;
    const isTotal = idx === rows.length - 1;
    if (isHeader || isTotal) {
      p1.drawRectangle({ x: 48, y: ry - 7, width: 499, height: 26, color: lightBox });
    }
    const f = isHeader || isTotal ? fontBold : fontReg;
    const c = isTotal ? ruby : dark;
    p1.drawText(r[0], { x: 58, y: ry, size: 10.5, font: f, color: c });
    if (r[1]) p1.drawText(r[1], { x: 345, y: ry, size: 10.5, font: f, color: muted });
    p1.drawText(r[2], { x: 458, y: ry, size: 10.5, font: f, color: c });
    ry -= 30;
  });

  p1.drawText('3. Conformidad y Firma Autorizada', {
    x: 48,
    y: 295,
    size: 14,
    font: fontBold,
    color: dark,
  });
  p1.drawText('Inserta aqui tu firma desde el boton "Firmar" o agrega el logo de tu empresa:', {
    x: 48,
    y: 274,
    size: 10.5,
    font: fontReg,
    color: muted,
  });

  p1.drawRectangle({
    x: 48,
    y: 155,
    width: 230,
    height: 98,
    borderColor: rgb(0.8, 0.82, 0.86),
    borderWidth: 1,
  });
  p1.drawText('Firma del Cliente / Sello', {
    x: 62,
    y: 168,
    size: 9.5,
    font: fontReg,
    color: muted,
  });

  p1.drawRectangle({
    x: 316,
    y: 155,
    width: 230,
    height: 98,
    borderColor: rgb(0.8, 0.82, 0.86),
    borderWidth: 1,
  });
  p1.drawText('Direccion Ejecutiva — Lycar Desarrollos', {
    x: 330,
    y: 168,
    size: 9.5,
    font: fontReg,
    color: muted,
  });

  // PAGE 2: Technical Specifications
  const p2 = doc.addPage([595.28, 841.89]);
  p2.drawText('Anexo Tecnico — Arquitectura 100% Local en Windows', {
    x: 48,
    y: 775,
    size: 17,
    font: fontBold,
    color: dark,
  });
  p2.drawText(
    'Todos los documentos abiertos en PDF-LEF se procesan exclusivamente en la memoria local del equipo.',
    { x: 48, y: 745, size: 11, font: fontReg, color: muted }
  );
  p2.drawText('Especificaciones Verificadas:', {
    x: 48,
    y: 705,
    size: 13,
    font: fontBold,
    color: ruby,
  });
  const specs = [
    '- Motor binario nativo Tauri v2 (Rust) con instalador ligero .exe para Windows 10 y Windows 11.',
    '- Edicion directa sobre textos existentes del PDF: modificar palabras, mover bloques y cambiar estilo.',
    '- Suite Ingenieria: cotas de medicion calibradas por escala (1:100, 1:50), areas m2 y globos.',
    '- Suite Contabilidad: calculadora de auditoria con IVA/ISR, marcas de conciliacion y exportar a Excel CSV.',
    '- Suite Administracion: Boveda de Logos Empresariales, Firmas sin fondo, Sellos y folios Bates.',
  ];
  let sy = 678;
  for (const line of specs) {
    p2.drawText(line, { x: 56, y: sy, size: 10.5, font: fontReg, color: dark });
    sy -= 26;
  }

  // PAGE 3: Engineering Plan & Accounting Conciliation Demo
  const p3 = doc.addPage([595.28, 841.89]);
  p3.drawText('Plano de Ingenieria (Escala 1:100) y Estado Contable', {
    x: 48,
    y: 780,
    size: 16,
    font: fontBold,
    color: dark,
  });
  p3.drawText('Usa la pestana "Ingenieria" para medir muros/areas o "Contabilidad" para conciliar partidas:', {
    x: 48,
    y: 758,
    size: 10.5,
    font: fontReg,
    color: muted,
  });

  // Sample Architectural / Structural Bay Rectangle (283.46 pt = 100 mm on paper = 10.00 m at 1:100!)
  p3.drawRectangle({
    x: 60,
    y: 530,
    width: 283.46,
    height: 170.08,
    borderColor: rgb(0.11, 0.3, 0.78),
    borderWidth: 1.8,
    color: rgb(0.95, 0.97, 1),
  });
  p3.drawText('NAVE INDUSTRIAL A-1 (10.00 m x 6.00 m = 60.00 m2)', {
    x: 82,
    y: 612,
    size: 9.5,
    font: fontBold,
    color: rgb(0.11, 0.3, 0.78),
  });

  // Accounting Ledger Table for CSV Export & Audit Tickmarks
  p3.drawText('Auxiliar de Polizas y Facturas para Conciliacion:', {
    x: 48,
    y: 480,
    size: 13,
    font: fontBold,
    color: dark,
  });
  const ledger = [
    ['Poliza', 'Proveedor / Concepto', 'Subtotal', 'IVA 16%', 'Total MXN'],
    ['ING-101', 'Acero Estructural S.A.', '45000.00', '7200.00', '52200.00'],
    ['EGR-102', 'Concretos del Sureste', '28500.00', '4560.00', '33060.00'],
    ['EGR-103', 'Servicios Electricos LEF', '12000.00', '1920.00', '13920.00'],
  ];
  let ly = 450;
  ledger.forEach((row, idx) => {
    const f = idx === 0 ? fontBold : fontMono;
    p3.drawText(row[0], { x: 54, y: ly, size: 9.5, font: f, color: dark });
    p3.drawText(row[1], { x: 125, y: ly, size: 9.5, font: idx === 0 ? fontBold : fontReg, color: dark });
    p3.drawText(row[2], { x: 315, y: ly, size: 9.5, font: f, color: dark });
    p3.drawText(row[3], { x: 405, y: ly, size: 9.5, font: f, color: muted });
    p3.drawText(row[4], { x: 482, y: ly, size: 9.5, font: f, color: idx === 0 ? ruby : dark });
    ly -= 26;
  });

  return doc.save();
}

/**
 * Converts normalized PDF page distance into calibrated real-world engineering measurement.
 * 1 PDF pt = 25.4 / 72 mm = 0.35277778 mm on paper.
 */
export function formatEngineeringLength(
  widthPt: number,
  heightPt: number,
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  cal: ScaleCalibration
): string {
  const dxPt = (p1.x - p0.x) * widthPt;
  const dyPt = (p1.y - p0.y) * heightPt;
  const distPt = Math.hypot(dxPt, dyPt);
  const realMm = distPt * (25.4 / 72) * (cal.ratio || 100);

  if (cal.unit === 'mm') return `${realMm.toFixed(1)} mm`;
  if (cal.unit === 'cm') return `${(realMm / 10).toFixed(2)} cm`;
  if (cal.unit === 'in') return `${(realMm / 25.4).toFixed(2)} in`;
  if (cal.unit === 'ft') return `${(realMm / 304.8).toFixed(2)} ft`;
  return `${(realMm / 1000).toFixed(2)} m`;
}

export function formatEngineeringArea(
  widthPt: number,
  heightPt: number,
  normW: number,
  normH: number,
  cal: ScaleCalibration
): string {
  const wMm = normW * widthPt * (25.4 / 72) * (cal.ratio || 100);
  const hMm = normH * heightPt * (25.4 / 72) * (cal.ratio || 100);
  if (cal.unit === 'ft') {
    const sqFt = (wMm / 304.8) * (hMm / 304.8);
    return `${sqFt.toFixed(2)} ft²`;
  }
  if (cal.unit === 'cm') {
    return `${((wMm / 10) * (hMm / 10)).toFixed(1)} cm²`;
  }
  const sqM = (wMm / 1000) * (hMm / 1000);
  return `${sqM.toFixed(2)} m²`;
}

/**
 * Extracts structured rows & columns from PDF pages into an Excel-ready UTF-8 BOM CSV string.
 */
export async function extractTabTablesToCsv(
  tab: PdfTabDocument,
  scope: 'current' | 'all' = 'all'
): Promise<string> {
  const targetIndices =
    scope === 'current' ? [tab.currentPageIndex] : tab.pages.map((_, idx) => idx);
  const csvLines: string[] = [];

  for (const idx of targetIndices) {
    const pd = tab.pages[idx];
    if (!pd || pd.sourceId === 'blank') continue;
    const bytes = tab.sourceBuffers[pd.sourceId];
    if (!bytes) continue;

    const pdf = await getPdfJsProxy(pd.sourceId, bytes);
    const page = await pdf.getPage(pd.sourcePageIndex + 1);
    const vp = page.getViewport({ scale: 1, rotation: (page.rotate + pd.rotation) % 360 });
    const tc = await page.getTextContent();

    interface CellToken {
      x: number;
      y: number;
      text: string;
    }

    const tokens: CellToken[] = [];
    for (const item of tc.items) {
      if (!('str' in item) || !item.str.trim()) continue;
      const tx = pdfjsLib.Util.transform(vp.transform, item.transform);
      tokens.push({ x: tx[4], y: tx[5], text: item.str.trim() });
    }

    tokens.sort((a, b) => (Math.abs(a.y - b.y) > 4.5 ? a.y - b.y : a.x - b.x));

    const rows: CellToken[][] = [];
    for (const tok of tokens) {
      const lastRow = rows[rows.length - 1];
      if (lastRow && Math.abs(lastRow[0].y - tok.y) <= 4.5) {
        lastRow.push(tok);
      } else {
        rows.push([tok]);
      }
    }

    if (targetIndices.length > 1) {
      csvLines.push(`"--- PÁGINA ${idx + 1} ---"`);
    }

    for (const row of rows) {
      row.sort((a, b) => a.x - b.x);
      // Merge tokens that belong to the same column (gap < 14 pt)
      const cols: string[] = [];
      let prevRight = -999;
      for (const cell of row) {
        if (cols.length > 0 && cell.x - prevRight < 14) {
          cols[cols.length - 1] = `${cols[cols.length - 1]} ${cell.text}`;
        } else {
          cols.push(cell.text);
        }
        prevRight = cell.x + cell.text.length * 4.8;
      }
      csvLines.push(
        cols.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')
      );
    }
  }

  return `\uFEFF${csvLines.join('\r\n')}`;
}
