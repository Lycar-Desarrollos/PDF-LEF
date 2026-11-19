import {
  PDFDocument,
  StandardFonts,
  degrees,
  rgb,
  type PDFFont,
  type PDFPage,
} from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import JSZip from 'jszip';
import type { FontFamilyChoice, PdfTabDocument } from '../types/pdf';
import {
  getFontFallbackCategory,
  resolveFontBytesForPdfExport,
} from './fontRegistry';
import { normalizeImageToPngBytes } from './imageUtils';
import {
  extractStructuredPageLines,
  hasNativeTextMeaningfulDiff,
  renderPageToCanvas,
} from './pdfEngine';

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

function sanitizeForFont(text: string, supportedCodePoints?: Set<number>): string {
  if (!text) return '';
  if (!supportedCodePoints) return sanitizeWinAnsi(text);

  let out = '';
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    if (cp === undefined) continue;
    if (cp === 9 || cp === 10 || cp === 13 || cp === 32 || supportedCodePoints.has(cp)) {
      out += ch;
    } else if ((cp === 0x2018 || cp === 0x2019) && supportedCodePoints.has(0x27)) {
      out += "'";
    } else if ((cp === 0x201c || cp === 0x201d) && supportedCodePoints.has(0x22)) {
      out += '"';
    } else if (cp === 0x2026 && supportedCodePoints.has(0x2e)) {
      out += '...';
    }
  }
  return out;
}

/**
 * Wraps sanitized text so neither edited native lines nor added text boxes
 * ever overflow past maxWidthPt on the exported PDF page.
 */
export function wrapPdfTextToWidth(
  text: string,
  font: PDFFont,
  fontSize: number,
  maxWidthPt: number,
  supportedCodePoints?: Set<number>
): string[] {
  const safe = sanitizeForFont(text, supportedCodePoints);
  if (!safe) return [];
  const limit = Math.max(24, maxWidthPt);
  const paragraphs = safe.replace(/\r\n/g, '\n').split('\n');
  const wrapped: string[] = [];

  for (const para of paragraphs) {
    if (!para) {
      wrapped.push('');
      continue;
    }
    if (font.widthOfTextAtSize(para, fontSize) <= limit) {
      wrapped.push(para);
      continue;
    }

    const words = para.split(/\s+/).filter((w) => w.length > 0);
    let current = '';

    const pushLongWord = (word: string) => {
      let chunk = '';
      for (const ch of word) {
        const candidate = chunk + ch;
        if (chunk && font.widthOfTextAtSize(candidate, fontSize) > limit) {
          wrapped.push(chunk);
          chunk = ch;
        } else {
          chunk = candidate;
        }
      }
      current = chunk;
    };

    for (const word of words) {
      if (!current) {
        if (font.widthOfTextAtSize(word, fontSize) <= limit) {
          current = word;
        } else {
          pushLongWord(word);
        }
      } else {
        const candidate = `${current} ${word}`;
        if (font.widthOfTextAtSize(candidate, fontSize) <= limit) {
          current = candidate;
        } else {
          wrapped.push(current);
          if (font.widthOfTextAtSize(word, fontSize) <= limit) {
            current = word;
          } else {
            current = '';
            pushLongWord(word);
          }
        }
      }
    }

    if (current) {
      wrapped.push(current);
    }
  }

  return wrapped;
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
  const category = getFontFallbackCategory(family);
  const group =
    category === 'serif'
      ? fonts.serif
      : category === 'mono'
        ? fonts.mono
        : category === 'script'
          ? fonts.serif
          : fonts.sans;
  const actualStyle = category === 'script' ? 'italic' : style;
  if (weight === 'bold' && actualStyle === 'italic') return group.boldItalic;
  if (weight === 'bold') return group.bold;
  if (actualStyle === 'italic') return group.italic;
  return group.normal;
}

interface ResolvedPdfFontBundle {
  font: PDFFont;
  simulateBold: boolean;
  supportedCodePoints?: Set<number>;
}

async function resolveActivePdfFont(
  pdfDoc: PDFDocument,
  standardFonts: EmbeddedStandardFontSet,
  cache: Map<string, ResolvedPdfFontBundle>,
  family: FontFamilyChoice = 'sans',
  weight: 'normal' | 'bold' = 'normal',
  style: 'normal' | 'italic' = 'normal'
): Promise<ResolvedPdfFontBundle> {
  const cacheKey = `${family}|${weight}|${style}`;
  const existing = cache.get(cacheKey);
  if (existing) return existing;

  try {
    const resolvedBytes = await resolveFontBytesForPdfExport(family, weight, style);
    if (resolvedBytes) {
      const embedded = await pdfDoc.embedFont(resolvedBytes.bytes);
      const bundle: ResolvedPdfFontBundle = {
        font: embedded,
        simulateBold: resolvedBytes.simulateBold,
        supportedCodePoints: new Set<number>(embedded.getCharacterSet()),
      };
      cache.set(cacheKey, bundle);
      return bundle;
    }
  } catch {
    // Gracefully fall back to built-in StandardFonts if font binary cannot be embedded
  }

  const fallback: ResolvedPdfFontBundle = {
    font: pickPdfFont(standardFonts, family, weight, style),
    simulateBold: false,
  };
  cache.set(cacheKey, fallback);
  return fallback;
}

export async function compileTabToPdfBytes(
  tab: PdfTabDocument,
  options?: { cleanMetadata?: boolean }
): Promise<Uint8Array> {
  const outDoc = await PDFDocument.create();
  outDoc.registerFontkit(fontkit);
  const fonts = await embedFontSuite(outDoc);
  const embeddedFontCache = new Map<string, ResolvedPdfFontBundle>();

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

    // Optional page crop (CropBox + TrimBox for universal PDF viewer support)
    if (
      pd.crop &&
      (pd.crop.left > 0 || pd.crop.right > 0 || pd.crop.top > 0 || pd.crop.bottom > 0)
    ) {
      const cLeft = pd.crop.left * rawW;
      const cRight = pd.crop.right * rawW;
      const cTop = pd.crop.top * rawH;
      const cBottom = pd.crop.bottom * rawH;
      const cropW = Math.max(50, rawW - cLeft - cRight);
      const cropH = Math.max(50, rawH - cTop - cBottom);
      pdfPage.setCropBox(cLeft, cBottom, cropW, cropH);
      pdfPage.setTrimBox(cLeft, cBottom, cropW, cropH);
    }

    // 1. Apply Native Existing-Text Edits / Moves / Deletions on this page!
    const pageBaselines = tab.extractedPageTexts[pd.id] ?? [];
    const nativeEdits = Object.values(tab.nativeTextEdits).filter((nt) => {
      if (nt.pageId !== pd.id) return false;
      if (nt.deleted) return true;
      if (!nt.modified) return false;
      const baseline = pageBaselines.find((b) => b.id === nt.id);
      return baseline ? hasNativeTextMeaningfulDiff(nt, baseline) : true;
    });

    for (const nt of nativeEdits) {
      // Cover original text run cleanly with sampled background color (tight horizontal bounds protect adjacent inline labels)
      const patchX = Math.max(0, nt.origX * pw - 0.5);
      const patchW = Math.min(pw - patchX, nt.origWidth * pw + 1.0);
      const patchH = nt.origHeight * ph + 1.4;
      const patchY = Math.max(0, ph - (nt.origY * ph + nt.origHeight * ph) - 0.7);
      const patchRgb = hexToPdfRgb(nt.bgPatchColor, '#ffffff');

      pdfPage.drawRectangle({
        x: patchX,
        y: patchY,
        width: patchW,
        height: patchH,
        color: patchRgb,
      });

      if (!nt.deleted && nt.text.trim()) {
        const resolved = await resolveActivePdfFont(
          outDoc,
          fonts,
          embeddedFontCache,
          nt.fontFamily,
          nt.fontWeight,
          nt.fontStyle
        );
        const chosenFont = resolved.font;
        const fSize = Math.max(6, nt.fontSizePt || 11);
        const maxNativeW =
          typeof nt.customWidth === 'number' && nt.customWidth > 0.03
            ? Math.max(36, Math.min((0.98 - nt.x) * pw, nt.customWidth * pw))
            : Math.max(40, (0.972 - nt.x) * pw);
        const lines = wrapPdfTextToWidth(
          nt.text,
          chosenFont,
          fSize,
          maxNativeW,
          resolved.supportedCodePoints
        );

        // If edited text is wider than original patch or wraps, paint clean solid background under new glyphs
        if (lines.length > 0) {
          const widestLine = Math.max(
            ...lines.map((ln) => chosenFont.widthOfTextAtSize(ln, fSize))
          );
          const totalBlockH = lines.length * fSize * 1.18;
          const newBoxX = Math.max(0, nt.x * pw - 0.5);
          const newBoxTopFromBottom = ph - nt.y * ph + 0.8;
          pdfPage.drawRectangle({
            x: newBoxX,
            y: Math.max(0, newBoxTopFromBottom - totalBlockH - 0.8),
            width: Math.min(pw - newBoxX, widestLine + 1.6),
            height: totalBlockH + 1.6,
            color: patchRgb,
          });
        }

        let lineY = ph - nt.y * ph - fSize * 0.88;
        for (const line of lines) {
          if (lineY < 8) break;
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
          color: hexToPdfRgb(el.color, '#2563EB'),
          opacity,
        });
      } else if (el.kind === 'strikeout') {
        pdfPage.drawLine({
          start: { x: boxX, y: boxY + boxH / 2 },
          end: { x: boxX + boxW, y: boxY + boxH / 2 },
          thickness: Math.max(1.5, el.strokeWidth || 2),
          color: hexToPdfRgb(el.color, '#DC2626'),
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
          borderColor: hexToPdfRgb(el.color, '#2563EB'),
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
          borderColor: hexToPdfRgb(el.color, '#2563EB'),
          borderWidth: el.strokeWidth || 2,
          borderOpacity: opacity,
        });
      } else if (el.kind === 'arrow') {
        const hasPts = el.points && el.points.length >= 2;
        const startX = hasPts ? el.points![0].x * pw : boxX;
        const startY = hasPts ? ph - el.points![0].y * ph : boxY + boxH;
        const endX = hasPts ? el.points![1].x * pw : boxX + boxW;
        const endY = hasPts ? ph - el.points![1].y * ph : boxY;
        const strokeCol = hexToPdfRgb(el.color, '#2563EB');
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
        const strokeCol = hexToPdfRgb(el.color, '#2563EB');
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
        const resolved = await resolveActivePdfFont(
          outDoc,
          fonts,
          embeddedFontCache,
          el.fontFamily,
          el.fontWeight,
          el.fontStyle
        );
        const font = resolved.font;
        const fSize = Math.max(6, el.fontSizePt || 12);
        const lines = wrapPdfTextToWidth(
          el.text || '',
          font,
          fSize,
          Math.max(24, boxW - 8),
          resolved.supportedCodePoints
        );
        let curY = boxY + boxH - fSize - 4;
        for (const line of lines) {
          if (curY < 6) break;
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
        const stampCol = hexToPdfRgb(el.color, '#2563EB');
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
        const noteBody = sanitizeWinAnsi(el.text || '');
        if (noteBody) {
          const noteLines = wrapPdfTextToWidth(noteBody, fonts.sans.normal, 8.5, Math.max(80, pw - boxX - 36));
          const firstLine = noteLines[0] || '';
          const lw = fonts.sans.normal.widthOfTextAtSize(firstLine, 8.5);
          pdfPage.drawRectangle({
            x: boxX + 21,
            y: boxY + 1,
            width: lw + 10,
            height: 16,
            color: rgb(1, 0.99, 0.92),
            borderColor: noteCol,
            borderWidth: 0.9,
            opacity: opacity * 0.96,
          });
          pdfPage.drawText(firstLine, {
            x: boxX + 26,
            y: boxY + 5,
            size: 8.5,
            font: fonts.sans.normal,
            color: hexToPdfRgb('#1E293B'),
            opacity,
          });
        }
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
        const cCol = hexToPdfRgb(el.color, '#2563EB');
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
      const wmCol = hexToPdfRgb(tab.watermark.color, '#2563EB');
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
        footerLabel = `${hf.batesPrefix || 'KOVA-'}${batesNum}`;
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
    outDoc.setCreator('Kova PDF');
    outDoc.setProducer('Kova PDF Local Engine');
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
    outDoc.setCreator(tab.metadata.creator || 'Kova PDF');
    outDoc.setProducer('Kova PDF Native Engine');
  }

  return outDoc.save({ useObjectStreams: true });
}

export async function mergeMultiplePdfBuffers(
  items: Array<{ fileName: string; bytes: Uint8Array }>
): Promise<Uint8Array> {
  const merged = await PDFDocument.create();
  merged.setCreator('Kova PDF');
  merged.setProducer('Kova PDF Native Engine');
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

/**
 * Splits a PDF into multiple separate PDF files (every `pagesPerFile` pages) packaged in a .zip
 */
export async function splitPdfIntoZip(
  tab: PdfTabDocument,
  pagesPerFile = 1
): Promise<Blob> {
  const zip = new JSZip();
  const step = Math.max(1, Math.floor(pagesPerFile));
  const baseName = tab.fileName.replace(/\.pdf$/i, '');

  for (let start = 0; start < tab.pages.length; start += step) {
    const indices: number[] = [];
    for (let k = start; k < Math.min(tab.pages.length, start + step); k++) {
      indices.push(k);
    }
    const partBytes = await extractSelectedPagesAsPdf(tab, indices);
    const label =
      indices.length === 1
        ? `pagina_${String(indices[0] + 1).padStart(3, '0')}`
        : `paginas_${String(indices[0] + 1).padStart(3, '0')}-${String(
            indices[indices.length - 1] + 1
          ).padStart(3, '0')}`;
    zip.file(`${baseName}_${label}.pdf`, partBytes);
  }

  return zip.generateAsync({ type: 'blob' });
}

/**
 * Compresses or flattens a PDF locally with 3 selectable levels:
 * - 'lossless': Vector object-stream optimization + metadata cleanup (100% vector sharpness)
 * - 'balanced': Smart 144 DPI JPEG stream optimization (shrinks heavy scans/images dramatically)
 * - 'extreme': 102 DPI high-ratio JPEG optimization for strict upload portals
 * If `flattenReadOnly` is true, flattens all pages into non-editable secure rasterized pages.
 */
export type CompressionLevel = 'lossless' | 'balanced' | 'extreme';

export async function compressPdfDocument(
  tab: PdfTabDocument,
  level: CompressionLevel = 'balanced',
  flattenReadOnly = false
): Promise<{ bytes: Uint8Array; originalBytes: number; compressedBytes: number }> {
  const originalBytes = Math.max(
    tab.fileSize || 0,
    Object.values(tab.sourceBuffers).reduce((acc, b) => acc + b.byteLength, 0)
  );

  // Always compile clean vector object-stream version first
  const losslessBytes = await compileTabToPdfBytes(tab, { cleanMetadata: true });

  if ((level === 'lossless' && !flattenReadOnly) || typeof document === 'undefined') {
    return {
      bytes: losslessBytes,
      originalBytes: Math.max(originalBytes, losslessBytes.byteLength),
      compressedBytes: losslessBytes.byteLength,
    };
  }

  // Rasterized JPEG recompression / flattening when DOM canvas is available
  const dpi = flattenReadOnly && level === 'lossless' ? 200 : level === 'balanced' ? 144 : 102;
  const jpegQuality =
    flattenReadOnly && level === 'lossless' ? 0.85 : level === 'balanced' ? 0.74 : 0.56;
  const scale = dpi / 72;

  const rasterDoc = await PDFDocument.create();
  rasterDoc.setCreator('Kova PDF');
  rasterDoc.setProducer('Kova PDF Optimizer');

  const tempSourceId = `opt_${Date.now()}`;
  for (let i = 0; i < tab.pages.length; i++) {
    const pd = tab.pages[i];
    const canvas = document.createElement('canvas');
    await renderPageToCanvas(
      tempSourceId,
      losslessBytes,
      {
        id: `opt_p_${i}`,
        sourceId: tempSourceId,
        sourcePageIndex: i,
        rotation: 0,
        widthPt: pd.widthPt,
        heightPt: pd.heightPt,
      },
      canvas,
      scale,
      false
    );
    const dataUrl = canvas.toDataURL('image/jpeg', jpegQuality);
    const base64 = dataUrl.split(',')[1] || '';
    const bin = atob(base64);
    const jpgBytes = new Uint8Array(bin.length);
    for (let k = 0; k < bin.length; k++) jpgBytes[k] = bin.charCodeAt(k);

    const jpgEmbed = await rasterDoc.embedJpg(jpgBytes);
    const rot = ((pd.rotation % 360) + 360) % 360;
    const pw = rot === 90 || rot === 270 ? pd.heightPt : pd.widthPt;
    const ph = rot === 90 || rot === 270 ? pd.widthPt : pd.heightPt;
    const outPage = rasterDoc.addPage([pw, ph]);
    outPage.drawImage(jpgEmbed, { x: 0, y: 0, width: pw, height: ph });
  }

  const rasterBytes = await rasterDoc.save({ useObjectStreams: true });

  // Unless user explicitly requested read-only flattening, never return a file larger than lossless!
  const chosen =
    flattenReadOnly || rasterBytes.byteLength < losslessBytes.byteLength
      ? rasterBytes
      : losslessBytes;

  return {
    bytes: chosen,
    originalBytes: Math.max(originalBytes, chosen.byteLength),
    compressedBytes: chosen.byteLength,
  };
}

function escapeXml(str: string): string {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Exports all text & edits from the active PDF into clean UTF-8 plain text (.txt)
 */
export async function exportTabToPlainText(tab: PdfTabDocument): Promise<string> {
  const pages = await extractStructuredPageLines(tab);
  return pages
    .map((lines, idx) => {
      const header = pages.length > 1 ? `=== Página ${idx + 1} ===\n` : '';
      const body = lines.map((ln) => ln.cells.join('    ')).join('\n');
      return `${header}${body}`;
    })
    .join('\n\n');
}

/**
 * Generates a genuine, standards-compliant Microsoft Word (.docx) OOXML package locally using JSZip,
 * preserving headings, bold emphasis, multi-column tables (<w:tbl>), edited texts, and page breaks!
 */
export async function exportTabToDocxBlob(tab: PdfTabDocument): Promise<Blob> {
  const pages = await extractStructuredPageLines(tab);
  const zip = new JSZip();

  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`
  );

  zip.file(
    '_rels/.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`
  );

  zip.file(
    'word/_rels/document.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`
  );

  zip.file(
    'word/styles.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/>
        <w:sz w:val="22"/>
        <w:color w:val="111827"/>
      </w:rPr>
    </w:rPrDefault>
  </w:docDefaults>
</w:styles>`
  );

  const bodyParts: string[] = [];

  pages.forEach((lines, pageIdx) => {
    let i = 0;
    while (i < lines.length) {
      const ln = lines[i];

      // Group consecutive multi-column lines into a clean Word Table (<w:tbl>)
      if (ln.cells.length >= 2) {
        const tableRows: typeof lines = [];
        while (i < lines.length && lines[i].cells.length >= 2) {
          tableRows.push(lines[i]);
          i++;
        }
        const maxCols = Math.max(...tableRows.map((r) => r.cells.length));
        const colTwips = Math.floor(9360 / Math.max(1, maxCols));
        const trXml = tableRows
          .map((row, rIdx) => {
            const padded = [...row.cells];
            while (padded.length < maxCols) padded.push('');
            const isHeader = rIdx === 0 && row.bold;
            const cellsXml = padded
              .map(
                (cellText) => `<w:tc>
              <w:tcPr>
                <w:tcW w:w="${colTwips}" w:type="dxa"/>
                ${isHeader ? '<w:shd w:val="clear" w:color="auto" w:fill="F1F5F9"/>' : ''}
              </w:tcPr>
              <w:p>
                <w:pPr><w:spacing w:before="60" w:after="60"/></w:pPr>
                <w:r>
                  <w:rPr>
                    ${row.bold ? '<w:b/>' : ''}
                    <w:sz w:val="${Math.round(Math.max(18, Math.min(32, row.fontSize * 2)))}"/>
                  </w:rPr>
                  <w:t xml:space="preserve">${escapeXml(cellText)}</w:t>
                </w:r>
              </w:p>
            </w:tc>`
              )
              .join('');
            return `<w:tr>${cellsXml}</w:tr>`;
          })
          .join('');

        bodyParts.push(`<w:tbl>
          <w:tblPr>
            <w:tblW w:w="9360" w:type="dxa"/>
            <w:tblBorders>
              <w:top w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
              <w:left w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
              <w:bottom w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
              <w:right w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
              <w:insideH w:val="single" w:sz="4" w:space="0" w:color="E2E8F0"/>
              <w:insideV w:val="single" w:sz="4" w:space="0" w:color="E2E8F0"/>
            </w:tblBorders>
          </w:tblPr>
          ${trXml}
        </w:tbl>
        <w:p><w:pPr><w:spacing w:after="120"/></w:pPr></w:p>`);
        continue;
      }

      // Standard paragraph or heading
      const halfPts = Math.round(Math.max(18, Math.min(56, ln.fontSize * 2)));
      const text = ln.cells[0] || '';
      const spacingAfter = ln.fontSize >= 14 ? 160 : 90;
      bodyParts.push(`<w:p>
        <w:pPr><w:spacing w:after="${spacingAfter}"/></w:pPr>
        <w:r>
          <w:rPr>
            ${ln.bold || ln.fontSize >= 15 ? '<w:b/>' : ''}
            <w:sz w:val="${halfPts}"/>
          </w:rPr>
          <w:t xml:space="preserve">${escapeXml(text)}</w:t>
        </w:r>
      </w:p>`);
      i++;
    }

    if (pageIdx < pages.length - 1) {
      bodyParts.push(`<w:p><w:r><w:br w:type="page"/></w:r></w:p>`);
    }
  });

  zip.file(
    'word/document.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${bodyParts.join('\n')}
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1080" w:right="1080" w:bottom="1080" w:left="1080"/>
    </w:sectPr>
  </w:body>
</w:document>`
  );

  return zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
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
