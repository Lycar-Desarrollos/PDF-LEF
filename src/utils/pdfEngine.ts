import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
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

import { matchPdfFontNameToChoice } from './fontRegistry';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  '../../node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

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

  const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';
  const nodeFontsPath = !isBrowser
    ? new URL(/* @vite-ignore */ '.', import.meta.url).pathname.replace(
        /\/src\/utils\/$/,
        '/node_modules/pdfjs-dist/standard_fonts/'
      )
    : undefined;
  const loadingTask = pdfjsLib.getDocument({
    data: cloned,
    useSystemFonts: isBrowser,
    disableFontFace: false,
    fontExtraProperties: true,
    ...(nodeFontsPath ? { standardFontDataUrl: nodeFontsPath } : {}),
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
  const dpr = hiDpi && typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2.25) : 1;

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
  return matchPdfFontNameToChoice(fontName);
}

/**
 * Extracts real existing text runs from a PDF page, merges adjacent words on the same baseline,
 * auto-samples exact background & ink foreground colors from the rendered page bitmap,
 * and clamps patch bounds cleanly between neighboring lines so zero ghosting or clipping occurs.
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
  const sampleScale = 1.5;
  const sampleViewport = page.getViewport({ scale: sampleScale, rotation: totalRotation });
  const textContent = await page.getTextContent();

  // Render 1.5x offscreen bitmap once per page for high-precision background mode & glyph ink scanning
  let cw = 0;
  let ch = 0;
  let pagePixels: Uint8ClampedArray | null = null;
  if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
    const sampleCanvas = document.createElement('canvas');
    cw = Math.max(1, Math.floor(sampleViewport.width));
    ch = Math.max(1, Math.floor(sampleViewport.height));
    sampleCanvas.width = cw;
    sampleCanvas.height = ch;
    const sCtx = sampleCanvas.getContext('2d', { willReadFrequently: true });
    if (sCtx) {
      sCtx.fillStyle = '#ffffff';
      sCtx.fillRect(0, 0, cw, ch);
      await page.render({
        canvasContext: sCtx,
        canvas: sampleCanvas,
        viewport: sampleViewport,
      }).promise;
      pagePixels = sCtx.getImageData(0, 0, cw, ch).data;
    }
  } else {
    await page.getOperatorList();
  }

  const commonObjs = (
    page as unknown as {
      commonObjs?: {
        has: (id: string) => boolean;
        get: (id: string) => {
          name?: string;
          bold?: boolean;
          black?: boolean;
          italic?: boolean;
          fallbackName?: string;
        };
      };
    }
  ).commonObjs;

  const toHex = (r: number, g: number, b: number) =>
    `#${[r, g, b]
      .map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0'))
      .join('')}`;

  const getPixelAtPt = (ptX: number, ptY: number): [number, number, number] => {
    if (!pagePixels || cw <= 0 || ch <= 0) return [255, 255, 255];
    const px = Math.max(0, Math.min(cw - 1, Math.round(ptX * sampleScale)));
    const py = Math.max(0, Math.min(ch - 1, Math.round(ptY * sampleScale)));
    const off = (py * cw + px) * 4;
    return [pagePixels[off], pagePixels[off + 1], pagePixels[off + 2]];
  };

  const sampleDominantBgAndInk = (
    leftPt: number,
    topPt: number,
    rightPt: number,
    bottomPt: number
  ): { bg: [number, number, number]; ink: [number, number, number]; inkBoundsPt?: [number, number, number, number] } => {
    if (!pagePixels || cw <= 0 || ch <= 0) {
      return { bg: [255, 255, 255], ink: [20, 22, 26] };
    }

    // 1. Collect dense perimeter ring samples (28 points) around the text box & find exact dominant mode cluster
    const ring: Array<[number, number, number]> = [];
    const xA = leftPt - 1.4;
    const xB = rightPt + 1.4;
    const yA = topPt - 1.2;
    const yB = bottomPt + 1.2;

    for (let i = 0; i <= 8; i++) {
      const t = i / 8;
      const sx = xA + (xB - xA) * t;
      ring.push(getPixelAtPt(sx, yA));
      ring.push(getPixelAtPt(sx, yB));
    }
    for (let j = 1; j <= 4; j++) {
      const t = j / 5;
      const sy = yA + (yB - yA) * t;
      ring.push(getPixelAtPt(xA, sy));
      ring.push(getPixelAtPt(xB, sy));
    }

    let bestCluster: Array<[number, number, number]> = [];
    for (const seed of ring) {
      const neighbors = ring.filter(
        (p) => Math.hypot(p[0] - seed[0], p[1] - seed[1], p[2] - seed[2]) <= 9
      );
      if (neighbors.length > bestCluster.length) {
        bestCluster = neighbors;
      }
    }

    const bgSource = bestCluster.length > 0 ? bestCluster : ring;
    const bgR = Math.round(bgSource.reduce((s, p) => s + p[0], 0) / bgSource.length);
    const bgG = Math.round(bgSource.reduce((s, p) => s + p[1], 0) / bgSource.length);
    const bgB = Math.round(bgSource.reduce((s, p) => s + p[2], 0) / bgSource.length);
    const bgLum = 0.299 * bgR + 0.587 * bgG + 0.114 * bgB;

    // 2. Scan interior pixels at 1.5x resolution for high-contrast glyph ink core
    const px0 = Math.max(0, Math.floor((leftPt - 1.5) * sampleScale));
    const px1 = Math.min(cw - 1, Math.ceil((rightPt + 2) * sampleScale));
    const py0 = Math.max(0, Math.floor(topPt * sampleScale));
    const py1 = Math.min(ch - 1, Math.ceil(bottomPt * sampleScale));

    const inkPixels: Array<{ r: number; g: number; b: number; dist: number }> = [];
    let minPx = px1;
    let maxPx = px0;
    let minPy = py1;
    let maxPy = py0;

    const stepX = px1 - px0 > 380 ? 2 : 1;
    for (let py = py0; py <= py1; py++) {
      const rowOff = py * cw * 4;
      for (let px = px0; px <= px1; px += stepX) {
        const off = rowOff + px * 4;
        const r = pagePixels[off];
        const g = pagePixels[off + 1];
        const b = pagePixels[off + 2];
        const dist = Math.hypot(r - bgR, g - bgG, b - bgB);
        if (dist > 40) {
          if (px < minPx) minPx = px;
          if (px > maxPx) maxPx = px;
          if (py < minPy) minPy = py;
          if (py > maxPy) maxPy = py;
          inkPixels.push({ r, g, b, dist });
        }
      }
    }

    if (inkPixels.length > 0) {
      inkPixels.sort((a, b) => b.dist - a.dist);
      const coreCount = Math.max(1, Math.ceil(inkPixels.length * 0.2));
      const core = inkPixels.slice(0, coreCount);
      const rs = core.map((c) => c.r).sort((a, b) => a - b);
      const gs = core.map((c) => c.g).sort((a, b) => a - b);
      const bs = core.map((c) => c.b).sort((a, b) => a - b);
      const mid = Math.floor(core.length / 2);
      return {
        bg: [bgR, bgG, bgB],
        ink: [rs[mid], gs[mid], bs[mid]],
        inkBoundsPt: [
          minPx / sampleScale,
          minPy / sampleScale,
          maxPx / sampleScale,
          maxPy / sampleScale,
        ],
      };
    }

    return {
      bg: [bgR, bgG, bgB],
      ink: bgLum < 110 ? [255, 255, 255] : [20, 22, 26],
    };
  };

  interface StyledFragment {
    left: number;
    baselineY: number;
    top: number;
    width: number;
    height: number;
    fontSize: number;
    str: string;
    fontName: string;
    family: FontFamilyChoice;
    weight: 'normal' | 'bold';
    style: 'normal' | 'italic';
    bgRgb: [number, number, number];
    inkRgb: [number, number, number];
  }

  const fragments: StyledFragment[] = [];
  for (const item of textContent.items) {
    if (!('str' in item)) continue;
    const str = item.str;
    if (!str || !str.trim()) continue;

    const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);
    const fontHeight = Math.max(6.5, Math.hypot(tx[2], tx[3]));
    const left = tx[4];
    const baselineY = tx[5];
    const top = baselineY - fontHeight * 0.92;
    const rawW = item.width * viewport.scale || str.length * fontHeight * 0.52;
    const width = Math.max(5, rawW + fontHeight * 0.04);
    const height = fontHeight * 1.2;
    const fName = item.fontName || '';

    const styleMeta = (
      textContent.styles as Record<string, { fontFamily?: string }> | undefined
    )?.[fName];
    const fontObj =
      commonObjs && fName && commonObjs.has(fName) ? commonObjs.get(fName) : null;
    const primaryFontInfo = guessFontChoice(`${fontObj?.name || ''} ${fName}`);
    const fullHintInfo = guessFontChoice(
      `${fontObj?.name || ''} ${fName} ${styleMeta?.fontFamily || ''} ${fontObj?.fallbackName || ''}`
    );
    const resolvedFamily: FontFamilyChoice =
      primaryFontInfo.family !== 'sans' ? primaryFontInfo.family : fullHintInfo.family;
    const resolvedWeight: 'normal' | 'bold' =
      fontObj?.bold || fontObj?.black || primaryFontInfo.weight === 'bold' ? 'bold' : 'normal';
    const resolvedStyle: 'normal' | 'italic' =
      fontObj?.italic || primaryFontInfo.style === 'italic' ? 'italic' : 'normal';

    const quickSample = sampleDominantBgAndInk(left, top, left + width, top + height);

    fragments.push({
      left,
      baselineY,
      top,
      width,
      height,
      fontSize: fontHeight,
      str,
      fontName: fName,
      family: resolvedFamily,
      weight: resolvedWeight,
      style: resolvedStyle,
      bgRgb: quickSample.bg,
      inkRgb: quickSample.ink,
    });
  }

  // Sort top-to-bottom by baseline, then left-to-right
  fragments.sort((a, b) =>
    Math.abs(a.baselineY - b.baselineY) > 3 ? a.baselineY - b.baselineY : a.left - b.left
  );

  // Merge ONLY adjacent fragments on the same baseline that share IDENTICAL weight, style, family, ink color, and background!
  const merged: StyledFragment[] = [];
  for (const frag of fragments) {
    const prev = merged[merged.length - 1];
    const maxHorizGap = Math.min(18, Math.max(prev ? prev.fontSize * 1.15 : 0, 7));
    const sameStyle =
      prev &&
      prev.weight === frag.weight &&
      prev.style === frag.style &&
      prev.family === frag.family;
    const sameColors =
      prev &&
      Math.hypot(
        prev.inkRgb[0] - frag.inkRgb[0],
        prev.inkRgb[1] - frag.inkRgb[1],
        prev.inkRgb[2] - frag.inkRgb[2]
      ) <= 36 &&
      Math.hypot(
        prev.bgRgb[0] - frag.bgRgb[0],
        prev.bgRgb[1] - frag.bgRgb[1],
        prev.bgRgb[2] - frag.bgRgb[2]
      ) <= 22;

    if (
      prev &&
      sameStyle &&
      sameColors &&
      Math.abs(prev.baselineY - frag.baselineY) <= Math.max(2.4, prev.fontSize * 0.22) &&
      Math.abs(prev.fontSize - frag.fontSize) <= 1.8 &&
      frag.left >= prev.left - 1.5 &&
      frag.left - (prev.left + prev.width) <= maxHorizGap
    ) {
      const gap = frag.left - (prev.left + prev.width);
      const needsSpace =
        gap > prev.fontSize * 0.13 && !prev.str.endsWith(' ') && !frag.str.startsWith(' ');
      prev.str = `${prev.str}${needsSpace ? ' ' : ''}${frag.str}`;
      prev.width = Math.max(prev.width, frag.left + frag.width - prev.left);
      prev.top = Math.min(prev.top, frag.top);
      prev.height = Math.max(prev.height, frag.height);
    } else {
      merged.push({ ...frag });
    }
  }

  const vw = Math.max(1, viewport.width);
  const vh = Math.max(1, viewport.height);

  return merged.map((m, idx) => {
    // 1. Clamp BOTH vertical AND same-line horizontal bounds against neighboring spans so adjacent labels (e.g. "Modalidad:") are never clipped
    let minAllowedTop = Math.max(0, m.top - m.fontSize * 0.14);
    let maxAllowedBottom = Math.min(vh, m.top + m.height + m.fontSize * 0.12);
    let minAllowedLeft = Math.max(0, m.left - 1.5);
    let maxAllowedRight = Math.min(vw, m.left + m.width + 2.2);

    for (let j = 0; j < merged.length; j++) {
      if (j === idx) continue;
      const other = merged[j];
      const sameLine = Math.abs(other.baselineY - m.baselineY) <= m.fontSize * 0.42;

      if (sameLine) {
        const otherRight = other.left + other.width;
        if (otherRight <= m.left + 3 && otherRight > m.left - 18) {
          minAllowedLeft = Math.max(minAllowedLeft, (otherRight + m.left) * 0.5);
        } else if (other.left >= m.left + m.width - 3 && other.left < m.left + m.width + 18) {
          maxAllowedRight = Math.min(maxAllowedRight, (m.left + m.width + other.left) * 0.5);
        }
        continue;
      }

      const horizOverlap =
        other.left <= m.left + m.width + 6 && other.left + other.width >= m.left - 6;
      if (!horizOverlap) continue;

      if (other.baselineY < m.baselineY - m.fontSize * 0.35) {
        const otherApproxBottom = other.baselineY + other.fontSize * 0.24;
        const mid = (otherApproxBottom + m.top) * 0.5;
        if (mid < m.baselineY - m.fontSize * 0.45) {
          minAllowedTop = Math.max(minAllowedTop, mid);
        }
      } else if (other.baselineY > m.baselineY + m.fontSize * 0.35) {
        const otherApproxTop = other.baselineY - other.fontSize * 0.88;
        const mid = (m.top + m.height + otherApproxTop) * 0.5;
        if (mid > m.baselineY + m.fontSize * 0.04) {
          maxAllowedBottom = Math.min(maxAllowedBottom, mid);
        }
      }
    }

    let boxLeft = Math.max(minAllowedLeft, m.left - 1);
    let boxRight = Math.min(maxAllowedRight, m.left + m.width + 1.8);
    let boxTop = Math.max(minAllowedTop, m.top);
    let boxBottom = Math.min(maxAllowedBottom, m.top + m.height);

    const finalSample = sampleDominantBgAndInk(boxLeft, boxTop, boxRight, boxBottom);
    if (finalSample.inkBoundsPt) {
      const [ix0, iy0, ix1, iy1] = finalSample.inkBoundsPt;
      boxLeft = Math.max(minAllowedLeft, Math.min(boxLeft, ix0 - 0.8));
      boxRight = Math.min(maxAllowedRight, Math.max(boxRight, ix1 + 1.2));
      boxTop = Math.max(minAllowedTop, Math.min(boxTop, iy0 - 0.8));
      boxBottom = Math.min(maxAllowedBottom, Math.max(boxBottom, iy1 + 1.0));
    }

    const bgPatchColor = toHex(finalSample.bg[0], finalSample.bg[1], finalSample.bg[2]);
    const textColor = toHex(finalSample.ink[0], finalSample.ink[1], finalSample.ink[2]);

    const normX = Math.max(0, Math.min(0.985, boxLeft / vw));
    const normY = Math.max(0, Math.min(0.985, boxTop / vh));
    const normW = Math.max(0.012, Math.min(1 - normX, (boxRight - boxLeft) / vw));
    const normH = Math.max(0.011, Math.min(1 - normY, (boxBottom - boxTop) / vh));

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
      fontFamily: m.family,
      fontWeight: m.weight,
      fontStyle: m.style,
      color: textColor,
      bgPatchColor,
      deleted: false,
      modified: false,
    };
  });
}

export function hasNativeTextMeaningfulDiff(
  candidate: NativePdfTextItem,
  baseline: NativePdfTextItem
): boolean {
  if (candidate.deleted) return true;
  if (candidate.text !== baseline.originalText) return true;
  if (
    Math.abs(candidate.x - baseline.origX) > 0.0015 ||
    Math.abs(candidate.y - baseline.origY) > 0.0015
  ) {
    return true;
  }
  if (
    Boolean(candidate.customWidth) !== Boolean(baseline.customWidth) ||
    (candidate.customWidth !== undefined &&
      Math.abs(candidate.customWidth - (baseline.customWidth ?? baseline.origWidth)) > 0.002)
  ) {
    return true;
  }
  if (Math.abs(candidate.fontSizePt - baseline.fontSizePt) > 0.08) return true;
  if (
    candidate.fontWeight !== baseline.fontWeight ||
    candidate.fontStyle !== baseline.fontStyle ||
    candidate.fontFamily !== baseline.fontFamily
  ) {
    return true;
  }
  if (candidate.color.toLowerCase() !== baseline.color.toLowerCase()) return true;
  if (
    (candidate.bgPatchColor || '#ffffff').toLowerCase() !==
    (baseline.bgPatchColor || '#ffffff').toLowerCase()
  ) {
    return true;
  }
  return false;
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
    creator: 'Kova PDF',
    producer: 'Kova PDF Native Engine',
  };

  try {
    const metaRes = await pdfJsDoc.getMetadata();
    const info = (metaRes?.info || {}) as Record<string, string>;
    metadata = {
      title: info.Title || metadata.title,
      author: info.Author || '',
      subject: info.Subject || '',
      keywords: info.Keywords || '',
      creator: info.Creator || 'Kova PDF',
      producer: info.Producer || 'Kova PDF Native Engine',
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
      color: '#2563EB',
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
      batesPrefix: 'KOVA-',
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

    const extracted = tab.extractedPageTexts[pd.id];
    const pageEdits = Object.values(tab.nativeTextEdits).filter(
      (nt) => nt.pageId === pd.id && (nt.modified || nt.deleted)
    );

    if (extracted && extracted.length > 0) {
      fullText = extracted
        .map((base) => tab.nativeTextEdits[base.id] || base)
        .filter((nt) => !nt.deleted && nt.text.trim())
        .map((nt) => nt.text)
        .join(' ');
    } else if (pd.sourceId !== 'blank' && tab.sourceBuffers[pd.sourceId]) {
      const pdf = await getPdfJsProxy(pd.sourceId, tab.sourceBuffers[pd.sourceId]);
      const page = await pdf.getPage(pd.sourcePageIndex + 1);
      const tc = await page.getTextContent();
      fullText = tc.items
        .map((it) => ('str' in it ? it.str : ''))
        .join(' ');

      for (const nt of pageEdits) {
        if (nt.originalText) {
          fullText = fullText.replace(nt.originalText, nt.deleted ? '' : nt.text);
        } else if (!nt.deleted && nt.text) {
          fullText = `${fullText} ${nt.text}`;
        }
      }
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
 * Generates a clean, minimalist 2-page Executive Sample PDF in Spanish
 * so the user can test Direct Existing-Text Editing, Moving Text with Snap Alignment,
 * Inserting Clean Images/Logos, Signatures, Stamps, and Page Organization immediately.
 */
export async function generateShowcaseSamplePdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle('Propuesta Ejecutiva y Acuerdo de Servicios — Kova PDF');
  doc.setAuthor('Kova Studio');
  doc.setSubject('Documento ejecutivo editable');
  doc.setCreator('Kova PDF');

  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontReg = await doc.embedFont(StandardFonts.Helvetica);
  const fontMono = await doc.embedFont(StandardFonts.Courier);

  const sapphire = rgb(0.145, 0.388, 0.922);
  const dark = rgb(0.06, 0.09, 0.16);
  const muted = rgb(0.36, 0.41, 0.49);
  const lightBox = rgb(0.96, 0.973, 0.992);

  // PAGE 1: Clean Executive Proposal & Editable Summary Table
  const p1 = doc.addPage([595.28, 841.89]);
  p1.drawRectangle({ x: 52, y: 760, width: 5, height: 38, color: sapphire });
  p1.drawText('KOVA PDF · DOCUMENTO EJECUTIVO INTERACTIVO', {
    x: 68,
    y: 785,
    size: 9.5,
    font: fontBold,
    color: sapphire,
  });
  p1.drawText('Acuerdo de Servicios y Propuesta Comercial', {
    x: 68,
    y: 763,
    size: 19,
    font: fontBold,
    color: dark,
  });
  p1.drawText('Folio: KOVA-2026-0190   |   Fecha: 15 de Noviembre de 2026', {
    x: 52,
    y: 730,
    size: 10,
    font: fontMono,
    color: muted,
  });

  p1.drawRectangle({ x: 52, y: 638, width: 491, height: 74, color: lightBox });
  p1.drawText('EDICIÓN DIRECTA SIN DAÑAR EL DISEÑO:', {
    x: 68,
    y: 690,
    size: 10,
    font: fontBold,
    color: sapphire,
  });
  p1.drawText('Haz clic sobre cualquier línea de esta hoja para corregir su texto al instante,', {
    x: 68,
    y: 672,
    size: 10,
    font: fontReg,
    color: dark,
  });
  p1.drawText('o arrástrala con las guías magnéticas para moverla sin que nada se desempareje.', {
    x: 68,
    y: 655,
    size: 10,
    font: fontReg,
    color: dark,
  });

  p1.drawText('1. Alcance General', {
    x: 52,
    y: 596,
    size: 13.5,
    font: fontBold,
    color: dark,
  });
  p1.drawText(
    'Este documento presenta los términos generales de entrega, soporte y confidencialidad.',
    { x: 52, y: 574, size: 10.5, font: fontReg, color: muted }
  );
  p1.drawText(
    'Puedes agregar imágenes limpias, logotipos sin fondo, firmas o sellos en cualquier sección.',
    { x: 52, y: 557, size: 10.5, font: fontReg, color: muted }
  );

  p1.drawText('2. Resumen de Conceptos', {
    x: 52,
    y: 514,
    size: 13.5,
    font: fontBold,
    color: dark,
  });

  const rows = [
    ['Descripción del Servicio', 'Período', 'Importe USD'],
    ['Implementación y Configuración Documental', 'Entrega única', '$ 1,250.00'],
    ['Licencia Corporativa Local para Windows', 'Permanente', '$ 680.00'],
    ['Soporte Preferente y Actualizaciones', '12 meses', '$ 290.00'],
    ['TOTAL GENERAL', '', '$ 2,220.00'],
  ];

  let ry = 480;
  rows.forEach((r, idx) => {
    const isHeader = idx === 0;
    const isTotal = idx === rows.length - 1;
    if (isHeader || isTotal) {
      p1.drawRectangle({ x: 52, y: ry - 7, width: 491, height: 26, color: lightBox });
    }
    const f = isHeader || isTotal ? fontBold : fontReg;
    const c = isTotal ? sapphire : dark;
    p1.drawText(r[0], { x: 64, y: ry, size: 10.5, font: f, color: c });
    if (r[1]) p1.drawText(r[1], { x: 345, y: ry, size: 10.5, font: f, color: muted });
    p1.drawText(r[2], { x: 458, y: ry, size: 10.5, font: f, color: c });
    ry -= 32;
  });

  p1.drawText('3. Conformidad y Firmas', {
    x: 52,
    y: 288,
    size: 13.5,
    font: fontBold,
    color: dark,
  });
  p1.drawText('Coloca aquí tu firma transparente o el logotipo oficial de tu organización:', {
    x: 52,
    y: 268,
    size: 10,
    font: fontReg,
    color: muted,
  });

  p1.drawRectangle({
    x: 52,
    y: 148,
    width: 228,
    height: 98,
    borderColor: rgb(0.82, 0.85, 0.9),
    borderWidth: 1,
  });
  p1.drawText('Representante del Cliente', {
    x: 68,
    y: 162,
    size: 9.5,
    font: fontReg,
    color: muted,
  });

  p1.drawRectangle({
    x: 315,
    y: 148,
    width: 228,
    height: 98,
    borderColor: rgb(0.82, 0.85, 0.9),
    borderWidth: 1,
  });
  p1.drawText('Autorización — Dirección General', {
    x: 331,
    y: 162,
    size: 9.5,
    font: fontReg,
    color: muted,
  });

  // PAGE 2: Clean Clauses & Notes Page
  const p2 = doc.addPage([595.28, 841.89]);
  p2.drawRectangle({ x: 52, y: 760, width: 5, height: 32, color: sapphire });
  p2.drawText('Anexo — Términos de Privacidad y Entrega Local', {
    x: 68,
    y: 768,
    size: 16,
    font: fontBold,
    color: dark,
  });
  p2.drawText(
    'Todos los archivos abiertos y editados en Kova PDF permanecen al 100% en tu computadora.',
    { x: 52, y: 734, size: 10.5, font: fontReg, color: muted }
  );

  const specs = [
    '1. Edición directa de textos existentes conservando la alineación y el color original.',
    '2. Inserción limpia de imágenes, fotografías y logotipos con eliminación de fondo blanco.',
    '3. Firmas manuscritas sin fondo, sellos rápidos, resaltado, notas y censura confidencial.',
    '4. Suite integral offline: unir, dividir, eliminar páginas, comprimir y convertir a Word/Excel.',
    '5. Icono nativo de documento en Windows 10 y 11 al establecerla como app predeterminada.',
  ];
  let sy = 690;
  for (const line of specs) {
    p2.drawText(line, { x: 58, y: sy, size: 10.5, font: fontReg, color: dark });
    sy -= 28;
  }

  return doc.save();
}

/**
 * Converts normalized PDF page distance into calibrated real-world measurement.
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
 * Extracts structured rows & columns from PDF pages into an Excel-ready UTF-8 BOM CSV string,
 * incorporating any direct native-text edits or deletions made by the user.
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

    const pageEdits = Object.values(tab.nativeTextEdits).filter(
      (nt) => nt.pageId === pd.id && (nt.modified || nt.deleted)
    );

    const tokens: CellToken[] = [];
    for (const item of tc.items) {
      if (!('str' in item) || !item.str.trim()) continue;
      const tx = pdfjsLib.Util.transform(vp.transform, item.transform);
      const nx = tx[4] / Math.max(1, vp.width);
      const ny = tx[5] / Math.max(1, vp.height);
      const overridden = pageEdits.some(
        (nt) =>
          nx >= nt.origX - 0.008 &&
          nx <= nt.origX + nt.origWidth + 0.008 &&
          ny >= nt.origY - 0.008 &&
          ny <= nt.origY + nt.origHeight + 0.018
      );
      if (!overridden) {
        tokens.push({ x: tx[4], y: tx[5], text: item.str.trim() });
      }
    }

    for (const nt of pageEdits) {
      if (!nt.deleted && nt.text.trim()) {
        tokens.push({
          x: nt.x * vp.width,
          y: nt.y * vp.height + (nt.fontSizePt || 10.5) * 0.86,
          text: nt.text.trim(),
        });
      }
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

export interface StructuredPageLine {
  y: number;
  fontSize: number;
  bold: boolean;
  cells: string[];
}

export async function extractStructuredPageLines(
  tab: PdfTabDocument
): Promise<StructuredPageLine[][]> {
  const allPages: StructuredPageLine[][] = [];

  for (let idx = 0; idx < tab.pages.length; idx++) {
    const pd = tab.pages[idx];
    if (!pd) continue;

    interface LineToken {
      x: number;
      y: number;
      width: number;
      fontSize: number;
      bold: boolean;
      text: string;
    }

    const tokens: LineToken[] = [];
    const pageEdits = Object.values(tab.nativeTextEdits).filter(
      (nt) => nt.pageId === pd.id && (nt.modified || nt.deleted)
    );

    if (pd.sourceId !== 'blank' && tab.sourceBuffers[pd.sourceId]) {
      const pdf = await getPdfJsProxy(pd.sourceId, tab.sourceBuffers[pd.sourceId]);
      const page = await pdf.getPage(pd.sourcePageIndex + 1);
      const vp = page.getViewport({ scale: 1, rotation: (page.rotate + pd.rotation) % 360 });
      const tc = await page.getTextContent();

      for (const item of tc.items) {
        if (!('str' in item) || !item.str.trim()) continue;
        const tx = pdfjsLib.Util.transform(vp.transform, item.transform);
        const fontSize = Math.max(7, Math.hypot(tx[2], tx[3]));
        const nx = tx[4] / Math.max(1, vp.width);
        const ny = (tx[5] - fontSize * 0.5) / Math.max(1, vp.height);
        const overridden = pageEdits.some(
          (nt) =>
            nx >= nt.origX - 0.01 &&
            nx <= nt.origX + nt.origWidth + 0.01 &&
            ny >= nt.origY - 0.012 &&
            ny <= nt.origY + nt.origHeight + 0.016
        );
        if (!overridden) {
          const fname = (item.fontName || '').toLowerCase();
          tokens.push({
            x: tx[4],
            y: tx[5],
            width: item.width * vp.scale || item.str.length * fontSize * 0.5,
            fontSize,
            bold: fname.includes('bold') || fname.includes('black'),
            text: item.str.trim(),
          });
        }
      }

      for (const nt of pageEdits) {
        if (!nt.deleted && nt.text.trim()) {
          tokens.push({
            x: nt.x * vp.width,
            y: nt.y * vp.height + (nt.fontSizePt || 10.5) * 0.86,
            width: nt.width * vp.width,
            fontSize: nt.fontSizePt || 10.5,
            bold: nt.fontWeight === 'bold',
            text: nt.text.trim(),
          });
        }
      }
    }

    for (const el of tab.elements) {
      if (el.pageId === pd.id && el.text && el.text.trim()) {
        tokens.push({
          x: el.x * pd.widthPt,
          y: el.y * pd.heightPt + (el.fontSizePt || 11),
          width: el.width * pd.widthPt,
          fontSize: el.fontSizePt || 11,
          bold: el.fontWeight === 'bold',
          text: el.text.trim(),
        });
      }
    }

    tokens.sort((a, b) => (Math.abs(a.y - b.y) > 4.5 ? a.y - b.y : a.x - b.x));

    const rowGroups: LineToken[][] = [];
    for (const tok of tokens) {
      const last = rowGroups[rowGroups.length - 1];
      if (last && Math.abs(last[0].y - tok.y) <= 4.5) {
        last.push(tok);
      } else {
        rowGroups.push([tok]);
      }
    }

    const pageLines: StructuredPageLine[] = rowGroups.map((grp) => {
      grp.sort((a, b) => a.x - b.x);
      const cells: string[] = [];
      let prevRight = -999;
      let maxFont = 10;
      let anyBold = false;
      for (const item of grp) {
        if (item.fontSize > maxFont) maxFont = item.fontSize;
        if (item.bold) anyBold = true;
        if (cells.length > 0 && item.x - prevRight < Math.max(24, item.fontSize * 2.2)) {
          cells[cells.length - 1] = `${cells[cells.length - 1]} ${item.text}`;
        } else {
          cells.push(item.text);
        }
        prevRight = item.x + item.width;
      }
      return {
        y: grp[0].y,
        fontSize: Math.round(maxFont * 2) / 2,
        bold: anyBold,
        cells,
      };
    });

    allPages.push(pageLines);
  }

  return allPages;
}
