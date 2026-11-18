import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import type { PdfTabDocument } from '../types/pdf';
import { compileTabToPdfBytes, parsePageRangeSpec } from './pdfExporter';

export type PrintPageScope = 'all' | 'current' | 'custom';
export type PrintScaleMode = 'fit' | 'exact';
export type PrintQualityDpi = 220 | 300;

export interface PrintJobOptions {
  scope: PrintPageScope;
  customRange?: string;
  scaleMode: PrintScaleMode;
  dpi: PrintQualityDpi;
  onProgress?: (rendered: number, total: number) => void;
}

const SPOOL_CONTAINER_ID = 'kova-print-spool';
const SPOOL_STYLE_ID = 'kova-print-page-style';

let activeBlobUrls: string[] = [];

export function resolvePrintPageIndices(
  totalPages: number,
  currentPageIndex: number,
  scope: PrintPageScope,
  customRange = ''
): number[] {
  if (totalPages <= 0) return [];
  if (scope === 'current') {
    const clamped = Math.max(0, Math.min(totalPages - 1, currentPageIndex));
    return [clamped];
  }
  if (scope === 'custom') {
    return parsePageRangeSpec(customRange, totalPages);
  }
  return Array.from({ length: totalPages }, (_, i) => i);
}

export function buildPrintPageCssRule(
  firstPageWidthPt: number,
  firstPageHeightPt: number,
  scaleMode: PrintScaleMode
): string {
  const safeW = Math.max(72, firstPageWidthPt || 595.28);
  const safeH = Math.max(72, firstPageHeightPt || 841.89);
  const wMm = (safeW * 25.4) / 72;
  const hMm = (safeH * 25.4) / 72;

  if (scaleMode === 'exact') {
    return `@page { size: ${wMm.toFixed(2)}mm ${hMm.toFixed(2)}mm; margin: 0mm !important; }`;
  }
  const orientation = safeW > safeH ? 'landscape' : 'portrait';
  return `@page { size: ${orientation}; margin: 0mm !important; }`;
}

export function cleanupPrintSpool(): void {
  if (typeof document !== 'undefined') {
    document.getElementById(SPOOL_CONTAINER_ID)?.remove();
    document.getElementById(SPOOL_STYLE_ID)?.remove();
  }
  if (activeBlobUrls.length > 0 && typeof URL !== 'undefined') {
    for (const u of activeBlobUrls) {
      try {
        URL.revokeObjectURL(u);
      } catch {
        // Ignore revoke error
      }
    }
    activeBlobUrls = [];
  }
}

export type CompiledPrintProxy = pdfjsLib.PDFDocumentProxy;

const printTaskRegistry = new WeakMap<
  CompiledPrintProxy,
  { destroy?: () => Promise<void> }
>();

export function destroyPrintProxy(proxy: CompiledPrintProxy | null | undefined): void {
  if (!proxy) return;
  const task = printTaskRegistry.get(proxy);
  if (task && typeof task.destroy === 'function') {
    task.destroy().catch(() => {});
    return;
  }
  const maybeCleanup = (proxy as unknown as { cleanup?: () => Promise<void> }).cleanup;
  if (typeof maybeCleanup === 'function') {
    maybeCleanup.call(proxy).catch(() => {});
  }
}

export async function loadCompiledPrintProxy(tab: PdfTabDocument): Promise<{
  compiledBytes: Uint8Array;
  pdfProxy: CompiledPrintProxy;
}> {
  const compiledBytes = await compileTabToPdfBytes(tab);
  const cloned = new Uint8Array(compiledBytes.byteLength);
  cloned.set(compiledBytes);

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
    ...(nodeFontsPath ? { standardFontDataUrl: nodeFontsPath } : {}),
  });
  const pdfProxy = await loadingTask.promise;
  printTaskRegistry.set(pdfProxy, loadingTask);

  return { compiledBytes, pdfProxy };
}

export async function renderCompiledPagePreview(
  pdfProxy: pdfjsLib.PDFDocumentProxy,
  pageIndex: number,
  canvas: HTMLCanvasElement,
  maxCssWidth = 240
): Promise<{ widthMm: number; heightMm: number }> {
  const page = await pdfProxy.getPage(pageIndex + 1);
  const baseVp = page.getViewport({ scale: 1 });
  const cssScale = Math.max(0.18, Math.min(1.5, maxCssWidth / Math.max(1, baseVp.width)));
  const dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1;
  const cssVp = page.getViewport({ scale: cssScale });
  const renderVp = page.getViewport({ scale: cssScale * dpr });

  canvas.width = Math.max(1, Math.floor(renderVp.width));
  canvas.height = Math.max(1, Math.floor(renderVp.height));
  canvas.style.width = `${Math.round(cssVp.width)}px`;
  canvas.style.height = `${Math.round(cssVp.height)}px`;

  const ctx = canvas.getContext('2d', { alpha: false });
  if (ctx) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({
      canvasContext: ctx,
      canvas,
      viewport: renderVp,
    }).promise;
  }

  return {
    widthMm: Math.round((baseVp.width * 25.4) / 72),
    heightMm: Math.round((baseVp.height * 25.4) / 72),
  };
}

function canvasToImageUrl(canvas: HTMLCanvasElement): Promise<{ url: string; isBlob: boolean }> {
  return new Promise((resolve) => {
    if (typeof canvas.toBlob === 'function') {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve({ url: URL.createObjectURL(blob), isBlob: true });
          } else {
            resolve({ url: canvas.toDataURL('image/png'), isBlob: false });
          }
        },
        'image/png'
      );
      return;
    }
    resolve({ url: canvas.toDataURL('image/png'), isBlob: false });
  });
}

function waitNextFrame(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    } else {
      setTimeout(resolve, 32);
    }
  });
}

export async function spoolCompiledPagesAndPrint(
  pdfProxy: pdfjsLib.PDFDocumentProxy,
  pageIndices: number[],
  options: {
    scaleMode: PrintScaleMode;
    dpi: PrintQualityDpi;
    onProgress?: (rendered: number, total: number) => void;
  }
): Promise<void> {
  if (typeof document === 'undefined' || typeof window === 'undefined' || pageIndices.length === 0) {
    return;
  }

  cleanupPrintSpool();

  const spool = document.createElement('div');
  spool.id = SPOOL_CONTAINER_ID;
  spool.setAttribute('aria-hidden', 'true');

  const requestedScale = options.dpi / 72;
  // Keep memory lean on very large multi-page print jobs while keeping crisp typography
  const batchAdjustedScale =
    pageIndices.length > 25 ? Math.min(requestedScale, 2.5) : requestedScale;

  let firstWidthPt = 595.28;
  let firstHeightPt = 841.89;
  const decodePromises: Promise<void>[] = [];

  for (let i = 0; i < pageIndices.length; i++) {
    const pageIdx = pageIndices[i];
    const page = await pdfProxy.getPage(pageIdx + 1);
    const vp1 = page.getViewport({ scale: 1 });
    if (i === 0) {
      firstWidthPt = vp1.width;
      firstHeightPt = vp1.height;
    }

    const maxEdgePt = Math.max(1, vp1.width, vp1.height);
    const safeScale = Math.min(batchAdjustedScale, 4096 / maxEdgePt);
    const renderVp = page.getViewport({ scale: safeScale });

    const offscreen = document.createElement('canvas');
    offscreen.width = Math.max(1, Math.floor(renderVp.width));
    offscreen.height = Math.max(1, Math.floor(renderVp.height));

    const ctx = offscreen.getContext('2d', { alpha: false });
    if (ctx) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, offscreen.width, offscreen.height);
      await page.render({
        canvasContext: ctx,
        canvas: offscreen,
        viewport: renderVp,
      }).promise;
    }

    const { url, isBlob } = await canvasToImageUrl(offscreen);
    if (isBlob) activeBlobUrls.push(url);

    // Release offscreen backing store immediately
    offscreen.width = 1;
    offscreen.height = 1;

    const sheet = document.createElement('div');
    sheet.className = 'kova-print-sheet';

    if (options.scaleMode === 'exact') {
      const pageWMm = (vp1.width * 25.4) / 72;
      const pageHMm = Math.max(10, (vp1.height * 25.4) / 72 - 0.4);
      sheet.style.width = `${pageWMm.toFixed(2)}mm`;
      sheet.style.height = `${pageHMm.toFixed(2)}mm`;
    } else {
      sheet.style.width = '100%';
      sheet.style.height = '99.5vh';
    }

    const img = document.createElement('img');
    img.src = url;
    img.alt = `Hoja ${pageIdx + 1}`;
    sheet.appendChild(img);
    spool.appendChild(sheet);

    decodePromises.push(
      img.decode
        ? img.decode().catch(() => {})
        : new Promise<void>((res) => {
            if (img.complete) res();
            else {
              img.onload = () => res();
              img.onerror = () => res();
            }
          })
    );

    options.onProgress?.(i + 1, pageIndices.length);
  }

  const styleEl = document.createElement('style');
  styleEl.id = SPOOL_STYLE_ID;
  styleEl.textContent = buildPrintPageCssRule(firstWidthPt, firstHeightPt, options.scaleMode);

  document.head.appendChild(styleEl);
  document.body.appendChild(spool);

  await Promise.all(decodePromises);
  await waitNextFrame();

  const onAfterPrint = () => {
    window.removeEventListener('afterprint', onAfterPrint);
    setTimeout(() => cleanupPrintSpool(), 400);
  };
  window.addEventListener('afterprint', onAfterPrint);

  window.print();
}
