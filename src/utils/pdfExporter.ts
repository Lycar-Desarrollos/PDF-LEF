import {
  PDFDocument,
  StandardFonts,
  degrees,
  rgb,
  type PDFFont,
  type PDFPage,
} from 'pdf-lib';
import JSZip from 'jszip';
import type { FontFamilyChoice, PdfTabDocument } from '../types/pdf';
import { normalizeImageToPngBytes } from './imageUtils';
import { renderPageToCanvas } from './pdfEngine';

function hexToPdfRgb(hex?: string, fallback = '#111318') {
  const raw = (hex && hex.startsWith('#') ? hex : fallback).replace('#', '');
  const full =
    raw.length === 3
      ? raw
          .split('')
          .map((c) => c + c)
          .join('')
      : raw.padEnd(6, '0').slice(0, 6);
  const num = parseInt(full, 16);
  const r = ((num >> 16) & 255) / 255;
  const g = ((num >> 8) & 255) / 255;
  const b = (num & 255) / 255;
  return rgb(
    Number.isFinite(r) ? r : 0,
    Number.isFinite(g) ? g : 0,
    Number.isFinite(b) ? b : 0
  );
}

/**
 * Ensures text is 100% compatible with WinAnsi StandardFonts (preserves full Spanish accents, ñ, ¿, ¡, €)
 */
function sanitizeWinAnsi(text: string): string {
  if (!text) return '';
  const normalized = text
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2026/g, '...');
  let out = '';
  for (let i = 0; i < normalized.length; i++) {
    const code = normalized.charCodeAt(i);
    if (
      code === 9 ||
      code === 10 ||
      code === 13 ||
      (code >= 32 && code <= 126) ||
      (code >= 160 && code <= 255)
    ) {
      out += normalized[i];
    }
  }
  return out;
}

interface EmbeddedStandardFontSet {
  sans: { normal: PDFFont; bold: PDFFont; italic: PDFFont; boldItalic: PDFFont };
  serif: { normal: PDFFont; bold: PDFFont; italic: PDFFont; boldItalic: PDFFont };
  mono: { normal: PDFFont; bold: PDFFont; italic: PDFFont; boldItalic: PDFFont };
}

async function embedFontSuite(pdfDoc: PDFDocument): Promise<EmbeddedStandardFontSet> {
  const [
    hReg,
    hBold,
    hObl,
    hBoldObl,
    tReg,
    tBold,
    tIt,
    tBoldIt,
    cReg,
    cBold,
    cObl,
    cBoldObl,
  ] = await Promise.all([
    pdfDoc.embedFont(StandardFonts.Helvetica),
    pdfDoc.embedFont(StandardFonts.HelveticaBold),
    pdfDoc.embedFont(StandardFonts.HelveticaOblique),
    pdfDoc.embedFont(StandardFonts.HelveticaBoldOblique),
    pdfDoc.embedFont(StandardFonts.TimesRoman),
    pdfDoc.embedFont(StandardFonts.TimesRomanBold),
    pdfDoc.embedFont(StandardFonts.TimesRomanItalic),
    pdfDoc.embedFont(StandardFonts.TimesRomanBoldItalic),
    pdfDoc.embedFont(StandardFonts.Courier),
    pdfDoc.embedFont(StandardFonts.CourierBold),
    pdfDoc.embedFont(StandardFonts.CourierOblique),
    pdfDoc.embedFont(StandardFonts.CourierBoldOblique),
  ]);

  return {
    sans: { normal: hReg, bold: hBold, italic: hObl, boldItalic: hBoldObl },
    serif: { normal: tReg, bold: tBold, italic: tIt, boldItalic: tBoldIt },
    mono: { normal: cReg, bold: cBold, italic: cObl, boldItalic: cBoldObl },
  };
}

function pickPdfFont(
  fonts: EmbeddedStandardFontSet,
  family: FontFamilyChoice = 'sans',
  weight: 'normal' | 'bold' = 'normal',
  style: 'normal' | 'italic' = 'normal'
): PDFFont {
  const group =
    family === 'serif'
      ? fonts.serif
      : family === 'mono'
      ? fonts.mono
      : family === 'script'
      ? fonts.serif
      : fonts.sans;
  const actualStyle = family === 'script' ? 'italic' : style;
  if (weight === 'bold' && actualStyle === 'italic') return group.boldItalic;
  if (weight === 'bold') return group.bold;
  if (actualStyle === 'italic') return group.italic;
  return group.normal;
}

export async function compileTabToPdfBytes(
  tab: PdfTabDocument,
  options?: { cleanMetadata?: boolean }
): Promise<Uint8Array> {
  const outDoc = await PDFDocument.create();
  const fonts = await embedFontSuite(outDoc);

  // Cache loaded source PDFDocuments
  const loadedSources = new Map<string, PDFDocument>();
  for (const [srcId, buf] of Object.entries(tab.sourceBuffers)) {
    const cloned = new Uint8Array(buf.byteLength);
    cloned.set(buf);
    const parsed = await PDFDocument.load(cloned, { ignoreEncryption: true });
    loadedSources.set(srcId, parsed);
  }

  // Image cache by dataUrl
  const imageCache = new Map<string, Awaited<ReturnType<PDFDocument['embedPng']>>>();

  const totalPages = tab.pages.length;

  for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
    const pd = tab.pages[pageIdx];
    let pdfPage: PDFPage;

    if (pd.sourceId === 'blank' || !loadedSources.has(pd.sourceId)) {
      pdfPage = outDoc.addPage([pd.widthPt || 595.28, pd.heightPt || 841.89]);
      if (pd.rotation) {
        pdfPage.setRotation(degrees(pd.rotation % 360));
      }
    } else {
      const srcDoc = loadedSources.get(pd.sourceId)!;
      const [copied] = await outDoc.copyPages(srcDoc, [pd.sourcePageIndex]);
      pdfPage = outDoc.addPage(copied);
      const baseAngle = pdfPage.getRotation().angle || 0;
      const newAngle = (baseAngle + pd.rotation) % 360;
      pdfPage.setRotation(degrees(newAngle));
    }

    const { width: rawW, height: rawH } = pdfPage.getSize();
    const rotAngle = ((pdfPage.getRotation().angle % 360) + 360) % 360;
    const pw = rotAngle === 90 || rotAngle === 270 ? rawH : rawW;
    const ph = rotAngle === 90 || rotAngle === 270 ? rawW : rawH;

    // Optional page crop
    if (pd.crop) {
      const cLeft = pd.crop.left * rawW;
      const cRight = pd.crop.right * rawW;
      const cTop = pd.crop.top * rawH;
      const cBottom = pd.crop.bottom * rawH;
      pdfPage.setCropBox(
        cLeft,
        cBottom,
        Math.max(50, rawW - cLeft - cRight),
        Math.max(50, rawH - cTop - cBottom)
      );
    }

    // 1. Apply Native Existing-Text Edits / Moves / Deletions on this page!
    const nativeEdits = Object.values(tab.nativeTextEdits).filter(
      (nt) => nt.pageId === pd.id && (nt.modified || nt.deleted)
    );

    for (const nt of nativeEdits) {
      // Cover original text run cleanly with sampled paper background color
      const patchX = nt.origX * pw - 1.5;
      const patchW = nt.origWidth * pw + 3;
      const patchH = nt.origHeight * ph + 2;
      const patchY = ph - (nt.origY * ph + nt.origHeight * ph) - 1;

      pdfPage.drawRectangle({
        x: patchX,
        y: patchY,
        width: patchW,
        height: patchH,
        color: hexToPdfRgb(nt.bgPatchColor, '#ffffff'),
      });

      if (!nt.deleted && nt.text.trim()) {
        const chosenFont = pickPdfFont(fonts, nt.fontFamily, nt.fontWeight, nt.fontStyle);
        const fSize = Math.max(6, nt.fontSizePt || 11);
        const lines = sanitizeWinAnsi(nt.text).split('\n');
        let lineY = ph - nt.y * ph - fSize * 0.88;
        for (const line of lines) {
          pdfPage.drawText(line, {
            x: nt.x * pw,
            y: lineY,
            size: fSize,
            font: chosenFont,
            color: hexToPdfRgb(nt.color, '#111318'),
          });
          lineY -= fSize * 1.18;
        }
      }
    }

    // 2. Apply Rich Movable Overlay Elements on this page sorted by zIndex
    const pageElements = tab.elements
      .filter((el) => el.pageId === pd.id)
      .sort((a, b) => a.zIndex - b.zIndex);

    for (const el of pageElements) {
      const boxX = el.x * pw;
      const boxW = el.width * pw;
      const boxH = el.height * ph;
      const boxY = ph - (el.y * ph + boxH);
      const opacity = el.opacity ?? 1;

      if (el.kind === 'highlight') {
        pdfPage.drawRectangle({
          x: boxX,
          y: boxY,
          width: boxW,
          height: boxH,
          color: hexToPdfRgb(el.color, '#FACC15'),
          opacity: Math.min(opacity, 0.42),
        });
      } else if (el.kind === 'underline') {
        pdfPage.drawLine({
          start: { x: boxX, y: boxY + 2 },
          end: { x: boxX + boxW, y: boxY + 2 },
          thickness: Math.max(1.5, el.strokeWidth || 2),
          color: hexToPdfRgb(el.color, '#C81E32'),
          opacity,
        });
      } else if (el.kind === 'strikeout') {
        pdfPage.drawLine({
          start: { x: boxX, y: boxY + boxH / 2 },
          end: { x: boxX + boxW, y: boxY + boxH / 2 },
          thickness: Math.max(1.5, el.strokeWidth || 2),
          color: hexToPdfRgb(el.color, '#C81E32'),
          opacity,
        });
      } else if (el.kind === 'redact') {
        pdfPage.drawRectangle({
          x: boxX,
          y: boxY,
          width: boxW,
          height: boxH,
          color: hexToPdfRgb(el.backgroundColor, '#0A0B0D'),
          opacity: 1,
        });
      } else if (el.kind === 'rect') {
        pdfPage.drawRectangle({
          x: boxX,
          y: boxY,
          width: boxW,
          height: boxH,
          borderColor: hexToPdfRgb(el.color, '#C81E32'),
          borderWidth: el.strokeWidth || 2,
          color:
            el.backgroundColor && el.backgroundColor !== 'transparent'
              ? hexToPdfRgb(el.backgroundColor)
              : undefined,
          opacity:
            el.backgroundColor && el.backgroundColor !== 'transparent' ? opacity * 0.25 : undefined,
          borderOpacity: opacity,
        });
      } else if (el.kind === 'ellipse') {
        pdfPage.drawEllipse({
          x: boxX + boxW / 2,
          y: boxY + boxH / 2,
          xScale: boxW / 2,
          yScale: boxH / 2,
          borderColor: hexToPdfRgb(el.color, '#C81E32'),
          borderWidth: el.strokeWidth || 2,
          borderOpacity: opacity,
        });
      } else if (el.kind === 'arrow') {
        const startX = boxX;
        const startY = boxY + boxH;
        const endX = boxX + boxW;
        const endY = boxY;
        const strokeCol = hexToPdfRgb(el.color, '#C81E32');
        const thick = el.strokeWidth || 2.2;
        pdfPage.drawLine({
          start: { x: startX, y: startY },
          end: { x: endX, y: endY },
          thickness: thick,
          color: strokeCol,
          opacity,
        });
        const angle = Math.atan2(endY - startY, endX - startX);
        const headLen = 10;
        pdfPage.drawLine({
          start: { x: endX, y: endY },
          end: {
            x: endX - headLen * Math.cos(angle - Math.PI / 6),
            y: endY - headLen * Math.sin(angle - Math.PI / 6),
          },
          thickness: thick,
          color: strokeCol,
          opacity,
        });
        pdfPage.drawLine({
          start: { x: endX, y: endY },
          end: {
            x: endX - headLen * Math.cos(angle + Math.PI / 6),
            y: endY - headLen * Math.sin(angle + Math.PI / 6),
          },
          thickness: thick,
          color: strokeCol,
          opacity,
        });
      } else if (el.kind === 'ink' && el.points && el.points.length > 1) {
        const strokeCol = hexToPdfRgb(el.color, '#C81E32');
        const thick = el.strokeWidth || 2.2;
        for (let i = 1; i < el.points.length; i++) {
          const p0 = el.points[i - 1];
          const p1 = el.points[i];
          pdfPage.drawLine({
            start: { x: p0.x * pw, y: ph - p0.y * ph },
            end: { x: p1.x * pw, y: ph - p1.y * ph },
            thickness: thick,
            color: strokeCol,
            opacity,
          });
        }
      } else if (el.kind === 'text') {
        if (el.backgroundColor && el.backgroundColor !== 'transparent') {
          pdfPage.drawRectangle({
            x: boxX,
            y: boxY,
            width: boxW,
            height: boxH,
            color: hexToPdfRgb(el.backgroundColor, '#ffffff'),
            opacity,
          });
        }
        if (el.borderColor && el.borderColor !== 'transparent') {
          pdfPage.drawRectangle({
            x: boxX,
            y: boxY,
            width: boxW,
            height: boxH,
            borderColor: hexToPdfRgb(el.borderColor),
            borderWidth: 1,
            borderOpacity: opacity,
          });
        }
        const font = pickPdfFont(fonts, el.fontFamily, el.fontWeight, el.fontStyle);
        const fSize = Math.max(6, el.fontSizePt || 12);
        const lines = sanitizeWinAnsi(el.text || '').split('\n');
        let curY = boxY + boxH - fSize - 4;
        for (const line of lines) {
          const lineW = font.widthOfTextAtSize(line, fSize);
          let drawX = boxX + 4;
          if (el.textAlign === 'center') drawX = boxX + (boxW - lineW) / 2;
          else if (el.textAlign === 'right') drawX = boxX + boxW - lineW - 4;
          pdfPage.drawText(line, {
            x: Math.max(0, drawX),
            y: curY,
            size: fSize,
            font,
            color: hexToPdfRgb(el.color, '#111318'),
            opacity,
          });
          curY -= fSize * 1.24;
        }
      } else if (el.kind === 'stamp') {
        const stampCol = hexToPdfRgb(el.color, '#C81E32');
        pdfPage.drawRectangle({
          x: boxX,
          y: boxY,
          width: boxW,
          height: boxH,
          borderColor: stampCol,
          borderWidth: 2.2,
          color: stampCol,
          opacity: 0.08 * opacity,
          borderOpacity: opacity,
        });
        const title = sanitizeWinAnsi(el.text || 'APROBADO');
        const mainSize = Math.max(10, Math.min(22, boxH * 0.42));
        const mainW = fonts.sans.bold.widthOfTextAtSize(title, mainSize);
        pdfPage.drawText(title, {
          x: boxX + (boxW - mainW) / 2,
          y: boxY + (el.subText ? boxH * 0.46 : (boxH - mainSize) / 2 + 2),
          size: mainSize,
          font: fonts.sans.bold,
          color: stampCol,
          opacity,
        });
        if (el.subText) {
          const sub = sanitizeWinAnsi(el.subText);
          const subSize = Math.max(7, mainSize * 0.48);
          const subW = fonts.mono.normal.widthOfTextAtSize(sub, subSize);
          pdfPage.drawText(sub, {
            x: boxX + (boxW - subW) / 2,
            y: boxY + boxH * 0.16,
            size: subSize,
            font: fonts.mono.normal,
            color: stampCol,
            opacity: opacity * 0.9,
          });
        }
      } else if ((el.kind === 'image' || el.kind === 'signature') && el.dataUrl) {
        let embedded = imageCache.get(el.dataUrl);
        if (!embedded) {
          const pngBytes = await normalizeImageToPngBytes(el.dataUrl);
          embedded = await outDoc.embedPng(pngBytes);
          imageCache.set(el.dataUrl, embedded);
        }
        pdfPage.drawImage(embedded, {
          x: boxX,
          y: boxY,
          width: boxW,
          height: boxH,
          opacity,
        });
        if (el.kind === 'signature' && el.subText) {
          const sigNote = sanitizeWinAnsi(el.subText);
          pdfPage.drawText(sigNote, {
            x: boxX,
            y: Math.max(4, boxY - 9),
            size: 7.5,
            font: fonts.mono.normal,
            color: hexToPdfRgb('#525866'),
            opacity,
          });
        }
      } else if (el.kind === 'note') {
        const noteCol = hexToPdfRgb(el.color, '#F59E0B');
        pdfPage.drawRectangle({
          x: boxX,
          y: boxY,
          width: 18,
          height: 18,
          color: noteCol,
          opacity,
        });
        pdfPage.drawText('N', {
          x: boxX + 5,
          y: boxY + 4,
          size: 10,
          font: fonts.sans.bold,
          color: rgb(1, 1, 1),
        });
      } else if (el.kind === 'dimension') {
        const p0 = el.points?.[0] || { x: el.x, y: el.y + el.height / 2 };
        const p1 = el.points?.[1] || { x: el.x + el.width, y: el.y + el.height / 2 };
        const sx = p0.x * pw;
        const sy = ph - p0.y * ph;
        const ex = p1.x * pw;
        const ey = ph - p1.y * ph;
        const dimCol = hexToPdfRgb(el.color, '#1D4ED8');
        pdfPage.drawLine({
          start: { x: sx, y: sy },
          end: { x: ex, y: ey },
          thickness: 1.8,
          color: dimCol,
          opacity,
        });
        // End ticks
        pdfPage.drawCircle({ x: sx, y: sy, size: 2.5, color: dimCol });
        pdfPage.drawCircle({ x: ex, y: ey, size: 2.5, color: dimCol });
        const label = sanitizeWinAnsi(el.text || '');
        if (label) {
          const midX = (sx + ex) / 2;
          const midY = (sy + ey) / 2;
          const lw = fonts.mono.bold.widthOfTextAtSize(label, 8.5);
          pdfPage.drawRectangle({
            x: midX - lw / 2 - 4,
            y: midY - 5,
            width: lw + 8,
            height: 13,
            color: rgb(1, 1, 1),
            borderColor: dimCol,
            borderWidth: 0.8,
          });
          pdfPage.drawText(label, {
            x: midX - lw / 2,
            y: midY - 2,
            size: 8.5,
            font: fonts.mono.bold,
            color: dimCol,
          });
        }
      } else if (el.kind === 'area') {
        const areaCol = hexToPdfRgb(el.color, '#1D4ED8');
        pdfPage.drawRectangle({
          x: boxX,
          y: boxY,
          width: boxW,
          height: boxH,
          color: areaCol,
          opacity: 0.1 * opacity,
          borderColor: areaCol,
          borderWidth: 1.5,
          borderOpacity: opacity,
        });
        const label = sanitizeWinAnsi(el.text || '');
        if (label) {
          const lw = fonts.mono.bold.widthOfTextAtSize(label, 9.5);
          pdfPage.drawText(label, {
            x: boxX + Math.max(4, (boxW - lw) / 2),
            y: boxY + boxH / 2 - 4,
            size: 9.5,
            font: fonts.mono.bold,
            color: areaCol,
          });
        }
      } else if (el.kind === 'callout') {
        const cCol = hexToPdfRgb(el.color, '#C81E32');
        const cx = boxX + 11;
        const cy = boxY + boxH - 11;
        pdfPage.drawCircle({ x: cx, y: cy, size: 10, color: cCol, opacity });
        const numStr = String(el.calloutNumber || 1);
        const nw = fonts.sans.bold.widthOfTextAtSize(numStr, 9.5);
        pdfPage.drawText(numStr, {
          x: cx - nw / 2,
          y: cy - 3.5,
          size: 9.5,
          font: fonts.sans.bold,
          color: rgb(1, 1, 1),
        });
        if (el.text) {
          pdfPage.drawText(sanitizeWinAnsi(el.text), {
            x: cx + 14,
            y: cy - 3.5,
            size: 9,
            font: fonts.sans.bold,
            color: cCol,
          });
        }
      } else if (el.kind === 'tickmark') {
        const tCol =
          el.tickVariant === 'err'
            ? hexToPdfRgb('#C42B1C')
            : el.tickVariant === 'warn'
            ? hexToPdfRgb('#B45309')
            : hexToPdfRgb('#0D7A5F');
        const badge =
          el.tickVariant === 'err' ? 'X' : el.tickVariant === 'warn' ? '!' : 'OK';
        pdfPage.drawCircle({
          x: boxX + 9,
          y: boxY + 9,
          size: 8.5,
          color: tCol,
          opacity,
        });
        const bw = fonts.sans.bold.widthOfTextAtSize(badge, 7.5);
        pdfPage.drawText(badge, {
          x: boxX + 9 - bw / 2,
          y: boxY + 6.2,
          size: 7.5,
          font: fonts.sans.bold,
          color: rgb(1, 1, 1),
        });
      }
    }

    // 3. Apply Watermark if enabled
    if (tab.watermark.enabled && tab.watermark.text.trim()) {
      const wmText = sanitizeWinAnsi(tab.watermark.text.trim());
      const wmSize = tab.watermark.fontSizePt || 46;
      const wmCol = hexToPdfRgb(tab.watermark.color, '#C81E32');
      const wmOp = tab.watermark.opacity ?? 0.14;
      const wmRot = degrees(tab.watermark.rotation || -35);

      if (tab.watermark.tiled) {
        for (let gx = 60; gx < pw; gx += 220) {
          for (let gy = 90; gy < ph; gy += 190) {
            pdfPage.drawText(wmText, {
              x: gx,
              y: gy,
              size: wmSize * 0.62,
              font: fonts.sans.bold,
              color: wmCol,
              opacity: wmOp,
              rotate: wmRot,
            });
          }
        }
      } else {
        const tw = fonts.sans.bold.widthOfTextAtSize(wmText, wmSize);
        pdfPage.drawText(wmText, {
          x: Math.max(30, (pw - tw * 0.8) / 2),
          y: ph * 0.45,
          size: wmSize,
          font: fonts.sans.bold,
          color: wmCol,
          opacity: wmOp,
          rotate: wmRot,
        });
      }
    }

    // 4. Apply Header / Footer / Bates Numbering if enabled
    if (tab.headerFooter.enabled) {
      const hf = tab.headerFooter;
      const hfSize = hf.fontSizePt || 9.5;
      const hfCol = hexToPdfRgb(hf.color, '#525866');

      if (hf.headerLeft.trim()) {
        pdfPage.drawText(sanitizeWinAnsi(hf.headerLeft), {
          x: 36,
          y: ph - 26,
          size: hfSize,
          font: fonts.sans.normal,
          color: hfCol,
        });
      }
      if (hf.headerRight.trim()) {
        const rightTxt = sanitizeWinAnsi(hf.headerRight);
        const rw = fonts.sans.normal.widthOfTextAtSize(rightTxt, hfSize);
        pdfPage.drawText(rightTxt, {
          x: Math.max(36, pw - rw - 36),
          y: ph - 26,
          size: hfSize,
          font: fonts.sans.normal,
          color: hfCol,
        });
      }

      let footerLabel = '';
      const num = pageIdx + 1;
      if (hf.footerCenterPattern === 'page-of-total') {
        footerLabel = `Página ${num} de ${totalPages}`;
      } else if (hf.footerCenterPattern === 'number-only') {
        footerLabel = `${num}`;
      } else if (hf.footerCenterPattern === 'bates') {
        const batesNum = String((hf.batesStart || 1) + pageIdx).padStart(5, '0');
        footerLabel = `${hf.batesPrefix || 'LEF-'}${batesNum}`;
      } else {
        footerLabel = hf.customFooter
          .replace(/\{page\}/g, String(num))
          .replace(/\{total\}/g, String(totalPages));
      }

      const cleanFooter = sanitizeWinAnsi(footerLabel);
      if (cleanFooter) {
        const fw = fonts.sans.normal.widthOfTextAtSize(cleanFooter, hfSize);
        pdfPage.drawText(cleanFooter, {
          x: (pw - fw) / 2,
          y: 20,
          size: hfSize,
          font: fonts.sans.normal,
          color: hfCol,
        });
      }
    }
  }

  // 5. Document Metadata or Privacy Sanitization
  if (options?.cleanMetadata) {
    outDoc.setTitle('');
    outDoc.setAuthor('');
    outDoc.setSubject('');
    outDoc.setKeywords([]);
    outDoc.setCreator('PDF-LEF Studio Pro');
    outDoc.setProducer('PDF-LEF Local Engine');
  } else {
    outDoc.setTitle(tab.metadata.title || '');
    outDoc.setAuthor(tab.metadata.author || '');
    outDoc.setSubject(tab.metadata.subject || '');
    outDoc.setKeywords(
      tab.metadata.keywords
        ? tab.metadata.keywords
            .split(',')
            .map((k) => k.trim())
            .filter(Boolean)
        : []
    );
    outDoc.setCreator(tab.metadata.creator || 'PDF-LEF Studio Pro');
    outDoc.setProducer('PDF-LEF Native Engine');
  }

  return outDoc.save({ useObjectStreams: true });
}

export async function mergeMultiplePdfBuffers(
  items: Array<{ fileName: string; bytes: Uint8Array }>
): Promise<Uint8Array> {
  const merged = await PDFDocument.create();
  merged.setCreator('PDF-LEF Studio Pro');
  for (const item of items) {
    const cloned = new Uint8Array(item.bytes.byteLength);
    cloned.set(item.bytes);
    const src = await PDFDocument.load(cloned, { ignoreEncryption: true });
    const indices = src.getPageIndices();
    const copied = await merged.copyPages(src, indices);
    copied.forEach((p) => merged.addPage(p));
  }
  return merged.save({ useObjectStreams: true });
}

export function parsePageRangeSpec(spec: string, totalPages: number): number[] {
  const indices = new Set<number>();
  const parts = spec
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  for (const part of parts) {
    if (part.includes('-')) {
      const [aStr, bStr] = part.split('-').map((s) => s.trim());
      const start = Math.max(1, parseInt(aStr, 10));
      const end = Math.min(totalPages, parseInt(bStr, 10));
      if (!Number.isNaN(start) && !Number.isNaN(end) && start <= end) {
        for (let n = start; n <= end; n++) indices.add(n - 1);
      }
    } else {
      const n = parseInt(part, 10);
      if (!Number.isNaN(n) && n >= 1 && n <= totalPages) {
        indices.add(n - 1);
      }
    }
  }
  return Array.from(indices).sort((a, b) => a - b);
}

export async function extractSelectedPagesAsPdf(
  tab: PdfTabDocument,
  pageIndices: number[]
): Promise<Uint8Array> {
  const subsetPages = pageIndices
    .map((idx) => tab.pages[idx])
    .filter(Boolean);
  const subTab: PdfTabDocument = {
    ...tab,
    pages: subsetPages,
  };
  return compileTabToPdfBytes(subTab);
}

export async function exportTabPagesToImagesZip(
  tab: PdfTabDocument,
  dpi: 150 | 300 | 600 = 300,
  format: 'png' | 'jpeg' = 'png'
): Promise<Blob> {
  // Compile final edited PDF first so exported images include all edited/moved texts, signatures, and stamps!
  const compiledBytes = await compileTabToPdfBytes(tab);
  const tempSourceId = `export_${Date.now()}`;
  const zip = new JSZip();
  const scale = dpi / 72;

  for (let i = 0; i < tab.pages.length; i++) {
    const canvas = document.createElement('canvas');
    await renderPageToCanvas(
      tempSourceId,
      compiledBytes,
      {
        id: `exp_${i}`,
        sourceId: tempSourceId,
        sourcePageIndex: i,
        rotation: 0,
        widthPt: tab.pages[i].widthPt,
        heightPt: tab.pages[i].heightPt,
      },
      canvas,
      scale,
      false
    );
    const mime = format === 'jpeg' ? 'image/jpeg' : 'image/png';
    const dataUrl = canvas.toDataURL(mime, 0.92);
    const base64 = dataUrl.split(',')[1] || '';
    const ext = format === 'jpeg' ? 'jpg' : 'png';
    const baseName = tab.fileName.replace(/\.pdf$/i, '');
    zip.file(`${baseName}_pagina_${String(i + 1).padStart(3, '0')}.${ext}`, base64, {
      base64: true,
    });
  }

  return zip.generateAsync({ type: 'blob' });
}
