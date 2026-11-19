import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Bold,
  Copy,
  GripHorizontal,
  GripVertical,
  RotateCcw,
  RotateCw,
  Trash2,
  Wand2,
} from 'lucide-react';
import type {
  ActiveTool,
  AppSettings,
  CustomFontEntry,
  FontFamilyChoice,
  NativePdfTextItem,
  PageDescriptor,
  PdfOverlayElement,
  PdfTabDocument,
  WorkspaceMode,
} from '../types/pdf';
import { canvasFontForChoice, cssFontForChoice } from '../utils/fontRegistry';
import {
  computeRelativeDragRotationDeg,
  normalizeAngleDeg,
} from '../utils/rotationMath';
import {
  extractNativeEditableTexts,
  formatEngineeringArea,
  formatEngineeringLength,
  renderPageToCanvas,
} from '../utils/pdfEngine';
import {
  fileToDataUrl,
  getImageDimensions,
  removeSignatureBackground,
} from '../utils/imageUtils';
import { FontPickerControl } from './FontPickerControl';

interface PdfCanvasStageProps {
  tab: PdfTabDocument;
  compareTab: PdfTabDocument | null;
  workspaceMode: WorkspaceMode;
  activeTool: ActiveTool;
  settings: AppSettings;
  customFonts?: CustomFontEntry[];
  onUploadCustomFontForTarget?: (
    files: FileList,
    applyChoice: (choice: FontFamilyChoice) => void
  ) => void;
  selectedElementId: string | null;
  selectedNativeTextId: string | null;
  onSelectElement: (id: string | null) => void;
  onSelectNativeText: (id: string | null) => void;
  onCurrentPageVisible: (pageIndex: number) => void;
  onCacheExtractedPageTexts: (pageId: string, items: NativePdfTextItem[]) => void;
  onUpdateNativeTextItem: (item: NativePdfTextItem, pushUndo?: boolean) => void;
  onResetNativeTextItem: (id: string) => void;
  onAddOverlayElement: (el: PdfOverlayElement) => void;
  onIncrementCalloutNumber: () => void;
  onUpdateOverlayElement: (
    id: string,
    patch: Partial<PdfOverlayElement>,
    pushUndo?: boolean
  ) => void;
  onDuplicateOverlayElement: (id: string) => void;
  onReorderElementLayer: (id: string, dir: 'front' | 'back') => void;
  onDeleteOverlayElement: (id: string) => void;
  onSwitchToSelectTool: () => void;
  onActivateEditPdfText?: () => void;
  onChangeZoom?: (zoom: number) => void;
}

let sharedMeasureCtx: CanvasRenderingContext2D | null = null;

function measureTextLayoutPx(
  text: string,
  fontPx: number,
  choice: FontFamilyChoice,
  weight: 'normal' | 'bold',
  style: 'normal' | 'italic',
  maxWidthPx: number
): { naturalWidthPx: number; rows: number } {
  const safeMax = Math.max(36, maxWidthPx);
  const lines = (text || '').replace(/\r\n/g, '\n').split('\n');

  if (typeof document !== 'undefined' && !sharedMeasureCtx) {
    const c = document.createElement('canvas');
    sharedMeasureCtx = c.getContext('2d');
  }

  const measureSeg = (seg: string): number => {
    if (!seg) return 0;
    if (sharedMeasureCtx) {
      const actualStyle = choice === 'script' ? 'italic' : style;
      sharedMeasureCtx.font = `${actualStyle} ${weight} ${fontPx}px ${canvasFontForChoice(choice)}`;
      return sharedMeasureCtx.measureText(seg).width;
    }
    return seg.length * fontPx * 0.54;
  };

  let widest = 0;
  let totalRows = 0;
  for (const seg of lines) {
    const w = measureSeg(seg);
    if (w > widest) widest = w;
    totalRows += Math.max(1, Math.ceil((w + 4) / Math.max(24, safeMax - 6)));
  }

  return {
    naturalWidthPx: Math.min(safeMax, Math.max(42, Math.ceil(widest + 16))),
    rows: Math.max(1, totalRows),
  };
}

type ResizeHandleDir = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

interface InteractivePageCardProps {
  tab: PdfTabDocument;
  pageDesc: PageDescriptor;
  pageIndex: number;
  totalPages: number;
  isEditableMode: boolean;
  activeTool: ActiveTool;
  settings: AppSettings;
  customFonts?: CustomFontEntry[];
  onUploadCustomFontForTarget?: (
    files: FileList,
    applyChoice: (choice: FontFamilyChoice) => void
  ) => void;
  selectedElementId: string | null;
  selectedNativeTextId: string | null;
  onSelectElement: (id: string | null) => void;
  onSelectNativeText: (id: string | null) => void;
  onCacheExtractedPageTexts: (pageId: string, items: NativePdfTextItem[]) => void;
  onUpdateNativeTextItem: (item: NativePdfTextItem, pushUndo?: boolean) => void;
  onResetNativeTextItem: (id: string) => void;
  onAddOverlayElement: (el: PdfOverlayElement) => void;
  onIncrementCalloutNumber: () => void;
  onUpdateOverlayElement: (
    id: string,
    patch: Partial<PdfOverlayElement>,
    pushUndo?: boolean
  ) => void;
  onDuplicateOverlayElement: (id: string) => void;
  onReorderElementLayer: (id: string, dir: 'front' | 'back') => void;
  onDeleteOverlayElement: (id: string) => void;
  onSwitchToSelectTool: () => void;
  onActivateEditPdfText?: () => void;
}

const InteractivePageCard: React.FC<InteractivePageCardProps> = ({
  tab,
  pageDesc,
  pageIndex,
  totalPages,
  isEditableMode,
  activeTool,
  settings,
  customFonts = [],
  onUploadCustomFontForTarget,
  selectedElementId,
  selectedNativeTextId,
  onSelectElement,
  onSelectNativeText,
  onCacheExtractedPageTexts,
  onUpdateNativeTextItem,
  onResetNativeTextItem,
  onAddOverlayElement,
  onIncrementCalloutNumber,
  onUpdateOverlayElement,
  onDuplicateOverlayElement,
  onReorderElementLayer,
  onDeleteOverlayElement,
  onSwitchToSelectTool,
  onActivateEditPdfText,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const [boxSize, setBoxSize] = useState<{ w: number; h: number }>({
    w: pageDesc.widthPt * tab.zoom,
    h: pageDesc.heightPt * tab.zoom,
  });
  const [editingOverlayId, setEditingOverlayId] = useState<string | null>(null);
  const [snapV, setSnapV] = useState<number | null>(null);
  const [snapH, setSnapH] = useState<number | null>(null);
  const [dragHud, setDragHud] = useState<string | null>(null);

  // Live drawing preview state (shapes, highlights, ink, dimension lines, directional arrows)
  const [draftBox, setDraftBox] = useState<{
    x: number;
    y: number;
    w: number;
    h: number;
  } | null>(null);
  const [draftInk, setDraftInk] = useState<Array<{ x: number; y: number }> | null>(null);
  const [draftLine, setDraftLine] = useState<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    label: string;
    isArrow?: boolean;
  } | null>(null);

  // Render PDF page canvas cleanly on zoom / rotation change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    const bytes = tab.sourceBuffers[pageDesc.sourceId];
    renderPageToCanvas(
      pageDesc.sourceId,
      bytes,
      pageDesc,
      canvas,
      tab.zoom,
      settings.hiDpiRendering
    )
      .then(({ cssWidth, cssHeight }) => {
        if (!cancelled) {
          setBoxSize({ w: cssWidth, h: cssHeight });
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [tab.sourceBuffers, pageDesc, tab.zoom, settings.hiDpiRendering]);

  // Extract existing PDF text blocks on demand when entering edit-pdf-text mode
  useEffect(() => {
    if (!isEditableMode || activeTool !== 'edit-pdf-text') return;
    if (tab.extractedPageTexts[pageDesc.id]) return;

    const bytes = tab.sourceBuffers[pageDesc.sourceId];
    extractNativeEditableTexts(pageDesc.sourceId, bytes, pageDesc)
      .then((items) => {
        onCacheExtractedPageTexts(pageDesc.id, items);
      })
      .catch(() => {});
  }, [
    isEditableMode,
    activeTool,
    pageDesc,
    tab.extractedPageTexts,
    tab.sourceBuffers,
    onCacheExtractedPageTexts,
  ]);

  const getNormCoords = (clientX: number, clientY: number) => {
    const rect = overlayRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return { nx: 0, ny: 0 };
    return {
      nx: Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)),
      ny: Math.max(0, Math.min(1, (clientY - rect.top) / rect.height)),
    };
  };

  // Combine extracted native text items with edited versions
  const baseExtracted = tab.extractedPageTexts[pageDesc.id] || [];
  const mergedNativeItems: NativePdfTextItem[] =
    activeTool === 'edit-pdf-text' && isEditableMode
      ? baseExtracted.map((base) => tab.nativeTextEdits[base.id] || base)
      : Object.values(tab.nativeTextEdits).filter(
          (nt) => nt.pageId === pageDesc.id && (nt.modified || nt.deleted)
        );

  // Dragging an Overlay Element (supports Multi-Edge Magnetic Snap, Shift Axis-Lock, and Alt-Drag Quick Clone!)
  const startMoveOverlay = (e: React.MouseEvent, el: PdfOverlayElement) => {
    if (!isEditableMode || el.locked || activeTool === 'pan') return;
    if (editingOverlayId === el.id) return;
    e.stopPropagation();

    const rect = overlayRef.current?.getBoundingClientRect();
    if (!rect) return;
    const startClientX = e.clientX;
    const startClientY = e.clientY;
    const origX = el.x;
    const origY = el.y;
    const origPoints = el.points ? el.points.map((p) => ({ ...p })) : undefined;
    let targetId = el.id;
    let clonedViaAlt = false;
    let moved = false;

    onSelectElement(el.id);
    onSelectNativeText(null);

    const peerOverlays = tab.elements.filter((p) => p.pageId === pageDesc.id && p.id !== el.id);
    const xTargets: number[] = [0.06, 0.5, 0.94];
    const yTargets: number[] = [0.5];
    for (const peer of peerOverlays) {
      xTargets.push(peer.x, peer.x + peer.width / 2, peer.x + peer.width);
      yTargets.push(peer.y, peer.y + peer.height / 2, peer.y + peer.height);
    }
    for (const nt of baseExtracted.slice(0, 40)) {
      xTargets.push(nt.x);
    }

    const onMove = (ev: MouseEvent) => {
      const pxDist = Math.hypot(ev.clientX - startClientX, ev.clientY - startClientY);
      if (!moved && pxDist < 2.5) return;

      if (!moved && ev.altKey && !clonedViaAlt) {
        clonedViaAlt = true;
        const cloneId = `${el.kind}_alt_${Date.now()}`;
        const clonedEl: PdfOverlayElement = {
          ...el,
          id: cloneId,
          zIndex: tab.elements.length + 2,
          points: origPoints ? origPoints.map((p) => ({ ...p })) : undefined,
        };
        onAddOverlayElement(clonedEl);
        onSelectElement(cloneId);
        targetId = cloneId;
      }

      moved = true;
      let dx = (ev.clientX - startClientX) / rect.width;
      let dy = (ev.clientY - startClientY) / rect.height;

      // Shift-drag locks movement strictly to horizontal or vertical axis
      let axisLocked = false;
      if (ev.shiftKey) {
        axisLocked = true;
        if (Math.abs(dx) >= Math.abs(dy)) {
          dy = 0;
        } else {
          dx = 0;
        }
      }

      let nextX = Math.max(0, Math.min(1 - el.width, origX + dx));
      let nextY = Math.max(0, Math.min(1 - el.height, origY + dy));
      let snapNote = '';

      if (settings.snapGuides) {
        let foundV: number | null = null;
        let foundH: number | null = null;
        const thresh = 0.009;

        // Check center, left, and right edges against xTargets
        for (const tx of xTargets) {
          if (Math.abs(nextX + el.width / 2 - tx) < thresh) {
            nextX = Math.max(0, Math.min(1 - el.width, tx - el.width / 2));
            foundV = tx;
            snapNote = Math.abs(tx - 0.5) < 0.001 ? 'Centrado H' : 'Alineado';
            break;
          }
          if (Math.abs(nextX - tx) < thresh) {
            nextX = Math.max(0, Math.min(1 - el.width, tx));
            foundV = tx;
            snapNote = 'Alineado';
            break;
          }
          if (Math.abs(nextX + el.width - tx) < thresh) {
            nextX = Math.max(0, Math.min(1 - el.width, tx - el.width));
            foundV = tx;
            snapNote = 'Alineado';
            break;
          }
        }

        // Check middle, top, and bottom edges against yTargets
        for (const ty of yTargets) {
          if (Math.abs(nextY + el.height / 2 - ty) < thresh) {
            nextY = Math.max(0, Math.min(1 - el.height, ty - el.height / 2));
            foundH = ty;
            snapNote = snapNote || (Math.abs(ty - 0.5) < 0.001 ? 'Centrado V' : 'Alineado');
            break;
          }
          if (Math.abs(nextY - ty) < thresh) {
            nextY = Math.max(0, Math.min(1 - el.height, ty));
            foundH = ty;
            snapNote = snapNote || 'Alineado';
            break;
          }
          if (Math.abs(nextY + el.height - ty) < thresh) {
            nextY = Math.max(0, Math.min(1 - el.height, ty - el.height));
            foundH = ty;
            snapNote = snapNote || 'Alineado';
            break;
          }
        }

        setSnapV(axisLocked && dy === 0 ? null : foundV);
        setSnapH(axisLocked && dx === 0 ? origY + el.height / 2 : foundH);
      }

      const patch: Partial<PdfOverlayElement> = { x: nextX, y: nextY };
      if (origPoints) {
        const actualDx = nextX - origX;
        const actualDy = nextY - origY;
        patch.points = origPoints.map((pt) => ({
          x: Math.max(0, Math.min(1, pt.x + actualDx)),
          y: Math.max(0, Math.min(1, pt.y + actualDy)),
        }));
      }
      onUpdateOverlayElement(targetId, patch, false);

      const modeTag = clonedViaAlt
        ? 'Copia rápida · '
        : axisLocked
        ? 'Eje fijo · '
        : snapNote
        ? `${snapNote} · `
        : '';
      setDragHud(`${modeTag}X ${(nextX * 100).toFixed(1)}% · Y ${(nextY * 100).toFixed(1)}%`);
    };

    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      setSnapV(null);
      setSnapH(null);
      setDragHud(null);
      if (moved && !clonedViaAlt) {
        onUpdateOverlayElement(targetId, {}, true);
      }
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // Dragging 360° Start/End Endpoints on Arrows & Engineering Dimensions
  const startDragEndpoint = (
    e: React.MouseEvent,
    el: PdfOverlayElement,
    pointIndex: 0 | 1
  ) => {
    e.stopPropagation();
    e.preventDefault();
    const basePts =
      el.points && el.points.length >= 2
        ? [
            { x: el.points[0].x, y: el.points[0].y },
            { x: el.points[1].x, y: el.points[1].y },
          ]
        : [
            { x: el.x, y: el.y + el.height },
            { x: el.x + el.width, y: el.y },
          ];

    const onMove = (ev: MouseEvent) => {
      const { nx, ny } = getNormCoords(ev.clientX, ev.clientY);
      const otherIdx = pointIndex === 0 ? 1 : 0;
      let px = nx;
      let py = ny;
      if (ev.shiftKey) {
        const dx = px - basePts[otherIdx].x;
        const dy = py - basePts[otherIdx].y;
        if (Math.abs(dx) >= Math.abs(dy)) py = basePts[otherIdx].y;
        else px = basePts[otherIdx].x;
      }
      const nextPts =
        pointIndex === 0 ? [{ x: px, y: py }, basePts[1]] : [basePts[0], { x: px, y: py }];
      const minX = Math.min(nextPts[0].x, nextPts[1].x);
      const maxX = Math.max(nextPts[0].x, nextPts[1].x);
      const minY = Math.min(nextPts[0].y, nextPts[1].y);
      const maxY = Math.max(nextPts[0].y, nextPts[1].y);
      const patch: Partial<PdfOverlayElement> = {
        x: Math.max(0, minX - 0.012),
        y: Math.max(0, minY - 0.012),
        width: Math.max(0.035, maxX - minX + 0.024),
        height: Math.max(0.028, maxY - minY + 0.024),
        points: nextPts,
      };
      if (el.kind === 'dimension') {
        patch.text = formatEngineeringLength(
          pageDesc.widthPt,
          pageDesc.heightPt,
          nextPts[0],
          nextPts[1],
          tab.scaleCalibration
        );
      }
      onUpdateOverlayElement(el.id, patch, false);
      const deg = Math.round(
        (Math.atan2(nextPts[1].y - nextPts[0].y, nextPts[1].x - nextPts[0].x) * 180) / Math.PI
      );
      setDragHud(
        el.kind === 'dimension'
          ? `Medida: ${patch.text} · ${deg}°`
          : `Dirección: ${deg}° (Shift = recto)`
      );
    };

    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      setDragHud(null);
      onUpdateOverlayElement(el.id, {}, true);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // Resizing an Overlay Element via 8 handles
  const startResizeOverlay = (
    e: React.MouseEvent,
    el: PdfOverlayElement,
    dir: ResizeHandleDir
  ) => {
    e.stopPropagation();
    e.preventDefault();
    const rect = overlayRef.current?.getBoundingClientRect();
    if (!rect) return;

    const startClientX = e.clientX;
    const startClientY = e.clientY;
    const ox = el.x;
    const oy = el.y;
    const ow = el.width;
    const oh = el.height;
    const origPts = el.points ? el.points.map((p) => ({ ...p })) : undefined;
    const ratio = ow / Math.max(0.01, oh);

    const onMove = (ev: MouseEvent) => {
      const dx = (ev.clientX - startClientX) / rect.width;
      const dy = (ev.clientY - startClientY) / rect.height;

      let nx = ox;
      let ny = oy;
      let nw = ow;
      let nh = oh;

      if (dir.includes('e')) nw = Math.max(0.02, Math.min(1 - ox, ow + dx));
      if (dir.includes('s')) nh = Math.max(0.014, Math.min(1 - oy, oh + dy));
      if (dir.includes('w')) {
        const maxLeftDelta = ow - 0.02;
        const clampedDx = Math.max(-ox, Math.min(maxLeftDelta, dx));
        nx = ox + clampedDx;
        nw = ow - clampedDx;
      }
      if (dir.includes('n')) {
        const maxTopDelta = oh - 0.014;
        const clampedDy = Math.max(-oy, Math.min(maxTopDelta, dy));
        ny = oy + clampedDy;
        nh = oh - clampedDy;
      }

      if (
        (el.preserveAspect || ev.shiftKey) &&
        (dir === 'se' || dir === 'nw' || dir === 'ne' || dir === 'sw')
      ) {
        nh = Math.max(0.014, nw / ratio);
        if (dir.includes('n')) {
          ny = Math.max(0, oy + oh - nh);
        }
      }

      const patch: Partial<PdfOverlayElement> = { x: nx, y: ny, width: nw, height: nh };
      if (origPts && ow > 0.001 && oh > 0.001) {
        patch.points = origPts.map((pt) => ({
          x: nx + ((pt.x - ox) / ow) * nw,
          y: ny + ((pt.y - oy) / oh) * nh,
        }));
      }
      if (el.kind === 'area') {
        patch.text = formatEngineeringArea(
          pageDesc.widthPt,
          pageDesc.heightPt,
          nw,
          nh,
          tab.scaleCalibration
        );
      }
      onUpdateOverlayElement(el.id, patch, false);
      const wMm = Math.round(nw * pageDesc.widthPt * 0.3528);
      const hMm = Math.round(nh * pageDesc.heightPt * 0.3528);
      setDragHud(`Tamaño · ${wMm} × ${hMm} mm`);
    };

    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      setDragHud(null);
      onUpdateOverlayElement(el.id, {}, true);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // 1-Motion Drag-or-Click for Existing Native PDF Text Blocks!
  // - Drag (> 3px): moves the native text block immediately with magnetic row/column/center snap!
  // - Click without drag (<= 3px): selects & opens inline text editing!
  const startMoveNativeText = (
    e: React.MouseEvent,
    item: NativePdfTextItem,
    deferSelectUntilClickOrDrag = false
  ) => {
    if (activeTool === 'pan' || e.button !== 0) return;
    e.stopPropagation();
    if (!deferSelectUntilClickOrDrag) {
      e.preventDefault();
      onSelectNativeText(item.id);
      onSelectElement(null);
    }

    const rect = overlayRef.current?.getBoundingClientRect();
    if (!rect) return;
    const startClientX = e.clientX;
    const startClientY = e.clientY;
    const ox = item.x;
    const oy = item.y;
    let moved = false;
    let latest = { ...item };

    const peers = mergedNativeItems.filter((p) => !p.deleted && p.id !== item.id);

    const onMove = (ev: MouseEvent) => {
      const pxDist = Math.hypot(ev.clientX - startClientX, ev.clientY - startClientY);
      if (!moved && pxDist < 3.2) return;
      if (!moved) {
        moved = true;
        onSelectNativeText(item.id);
        onSelectElement(null);
      }

      let dx = (ev.clientX - startClientX) / rect.width;
      let dy = (ev.clientY - startClientY) / rect.height;
      let axisLocked = false;
      if (ev.shiftKey) {
        axisLocked = true;
        if (Math.abs(dx) >= Math.abs(dy)) dy = 0;
        else dx = 0;
      }

      let nx = Math.max(0.01, Math.min(0.97 - Math.min(0.08, item.width), ox + dx));
      let ny = Math.max(0.008, Math.min(0.985 - item.height, oy + dy));
      let snapLabel = '';

      if (settings.snapGuides) {
        let matchedV: number | null = null;
        let matchedH: number | null = null;

        // 1. Snap left edge to original X or peer column X
        if (Math.abs(nx - item.origX) < 0.007) {
          nx = item.origX;
          matchedV = nx;
          snapLabel = 'Columna original';
        } else {
          for (const peer of peers) {
            if (Math.abs(nx - peer.x) < 0.007) {
              nx = peer.x;
              matchedV = peer.x;
              snapLabel = 'Alineado a columna';
              break;
            }
          }
        }
        // Or snap center of page
        if (matchedV === null && Math.abs(nx + item.width / 2 - 0.5) < 0.01) {
          nx = Math.max(0.01, 0.5 - item.width / 2);
          matchedV = 0.5;
          snapLabel = 'Centrado en hoja';
        }

        // 2. Snap baseline/top row to original Y or peer row Y
        if (Math.abs(ny - item.origY) < 0.006) {
          ny = item.origY;
          matchedH = ny;
          snapLabel = snapLabel || 'Renglón original';
        } else {
          for (const peer of peers) {
            if (Math.abs(ny - peer.y) < 0.006) {
              ny = peer.y;
              matchedH = peer.y;
              snapLabel = snapLabel || 'Mismo renglón';
              break;
            }
          }
        }

        setSnapV(matchedV);
        setSnapH(matchedH);
      }

      latest = {
        ...latest,
        x: nx,
        y: ny,
        modified: true,
      };
      onUpdateNativeTextItem(latest, false);
      const prefix = axisLocked ? 'Eje fijo · ' : snapLabel ? `${snapLabel} · ` : 'Moviendo texto · ';
      setDragHud(`${prefix}X ${(nx * 100).toFixed(1)}% · Y ${(ny * 100).toFixed(1)}%`);
    };

    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      setSnapV(null);
      setSnapH(null);
      setDragHud(null);
      if (moved) {
        onUpdateNativeTextItem(latest, true);
      } else if (deferSelectUntilClickOrDrag) {
        onSelectNativeText(item.id);
        onSelectElement(null);
      }
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const startResizeNativeTextWidth = (
    e: React.MouseEvent,
    item: NativePdfTextItem,
    currentWidthPx: number
  ) => {
    e.stopPropagation();
    e.preventDefault();
    const rect = overlayRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return;

    const startClientX = e.clientX;
    const baseNormW = Math.max(0.05, currentWidthPx / rect.width);
    let latest = { ...item };

    const onMove = (ev: MouseEvent) => {
      const dx = (ev.clientX - startClientX) / rect.width;
      const nextW = Math.max(0.06, Math.min(0.975 - item.x, baseNormW + dx));
      latest = {
        ...latest,
        customWidth: nextW,
        modified: true,
      };
      onUpdateNativeTextItem(latest, false);
      const wMm = Math.round(nextW * pageDesc.widthPt * 0.3528);
      setDragHud(`Ancho de columna · ${wMm} mm`);
    };

    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      setDragHud(null);
      onUpdateNativeTextItem(latest, true);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // Interactive 360° Free/Snap Rotation for Overlay Elements (Shift = 15° snap)
  const startRotateOverlay = (e: React.MouseEvent, el: PdfOverlayElement) => {
    e.stopPropagation();
    e.preventDefault();
    const boxEl = (e.currentTarget as HTMLElement).closest('.overlay-item') as HTMLElement | null;
    const r = boxEl?.getBoundingClientRect();
    if (!r) return;
    const centerX = r.left + r.width / 2;
    const centerY = r.top + r.height / 2;
    const startX = e.clientX;
    const startY = e.clientY;
    const initRot = el.rotation || 0;
    let latestRot = initRot;

    const onMove = (ev: MouseEvent) => {
      latestRot = computeRelativeDragRotationDeg(
        centerX,
        centerY,
        startX,
        startY,
        ev.clientX,
        ev.clientY,
        initRot,
        ev.shiftKey
      );
      onUpdateOverlayElement(el.id, { rotation: latestRot }, false);
      setDragHud(`Rotación · ${latestRot > 0 ? '+' : ''}${latestRot}°`);
    };

    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      setDragHud(null);
      onUpdateOverlayElement(el.id, { rotation: latestRot }, true);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // Interactive 360° Free/Snap Rotation for Native PDF Text Blocks (Shift = 15° snap)
  const startRotateNativeText = (e: React.MouseEvent, item: NativePdfTextItem) => {
    e.stopPropagation();
    e.preventDefault();
    const boxEl = (e.currentTarget as HTMLElement).closest(
      '.native-text-box'
    ) as HTMLElement | null;
    const r = boxEl?.getBoundingClientRect();
    if (!r) return;
    const centerX = r.left + r.width / 2;
    const centerY = r.top + r.height / 2;
    const startX = e.clientX;
    const startY = e.clientY;
    const initRot = item.rotation || 0;
    let latest = { ...item };

    const onMove = (ev: MouseEvent) => {
      const nextRot = computeRelativeDragRotationDeg(
        centerX,
        centerY,
        startX,
        startY,
        ev.clientX,
        ev.clientY,
        initRot,
        ev.shiftKey
      );
      latest = {
        ...latest,
        rotation: nextRot,
        modified: true,
      };
      onUpdateNativeTextItem(latest, false);
      setDragHud(`Rotación · ${nextRot > 0 ? '+' : ''}${nextRot}°`);
    };

    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      setDragHud(null);
      onUpdateNativeTextItem(latest, true);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // Duplicate any Native PDF Text Item as an independent movable Overlay Text Box!
  const duplicateNativeTextAsOverlay = (nt: NativePdfTextItem) => {
    const newId = `txt_clone_${Date.now()}`;
    onAddOverlayElement({
      id: newId,
      pageId: pageDesc.id,
      kind: 'text',
      x: Math.min(0.84, nt.x + 0.02),
      y: Math.min(0.94, nt.y + Math.max(0.022, nt.height + 0.006)),
      width: Math.max(0.16, Math.min(0.85, nt.width + 0.03)),
      height: Math.max(0.032, nt.height + 0.012),
      rotation: nt.rotation || 0,
      opacity: 1,
      zIndex: tab.elements.length + 2,
      text: nt.text,
      fontFamily: nt.fontFamily,
      fontSizePt: nt.fontSizePt,
      fontWeight: nt.fontWeight,
      fontStyle: nt.fontStyle,
      textAlign: 'left',
      color: nt.color,
      backgroundColor: 'transparent',
    });
    onSwitchToSelectTool();
    onSelectNativeText(null);
    onSelectElement(newId);
  };

  // Zero-Mode-Trap: Double-clicking ANY text on the PDF page automatically activates Edit PDF Text and selects it!
  const handleStageDoubleClick = async (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target !== overlayRef.current) return;
    const { nx, ny } = getNormCoords(e.clientX, e.clientY);
    let items = tab.extractedPageTexts[pageDesc.id];
    if (!items) {
      try {
        const bytes = tab.sourceBuffers[pageDesc.sourceId];
        items = await extractNativeEditableTexts(pageDesc.sourceId, bytes, pageDesc);
        onCacheExtractedPageTexts(pageDesc.id, items);
      } catch {
        return;
      }
    }
    const candidates = items.map((base) => tab.nativeTextEdits[base.id] || base).filter((it) => !it.deleted);
    const pad = 0.008;
    const hit = candidates.find(
      (it) =>
        nx >= it.x - pad &&
        nx <= it.x + it.width + pad &&
        ny >= it.y - pad &&
        ny <= it.y + it.height + pad
    );
    if (hit && onActivateEditPdfText) {
      onActivateEditPdfText();
      onSelectElement(null);
      onSelectNativeText(hit.id);
    }
  };

  // Page Background Click / Drag-to-Create Tool Handler
  const handleStageMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (activeTool === 'pan') return;
    if (e.target !== overlayRef.current) return;
    onSelectElement(null);
    onSelectNativeText(null);
    setEditingOverlayId(null);

    if (!isEditableMode) return;
    const { nx, ny } = getNormCoords(e.clientX, e.clientY);

    if (activeTool === 'add-text') {
      const newId = `el_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const newEl: PdfOverlayElement = {
        id: newId,
        pageId: pageDesc.id,
        kind: 'text',
        x: Math.min(0.76, nx),
        y: Math.min(0.92, ny),
        width: 0.28,
        height: 0.052,
        rotation: 0,
        opacity: 1,
        zIndex: tab.elements.length + 1,
        text: 'Escribe tu texto aquí',
        fontFamily: settings.defaultFontFamily,
        fontSizePt: settings.defaultFontSizePt,
        fontWeight: 'normal',
        fontStyle: 'normal',
        textAlign: 'left',
        color: settings.defaultTextColor,
        backgroundColor: 'transparent',
      };
      onAddOverlayElement(newEl);
      onSelectElement(newId);
      setEditingOverlayId(newId);
      if (settings.autoSelectAfterInsert) onSwitchToSelectTool();
      return;
    }

    if (activeTool === 'note') {
      const newId = `el_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      onAddOverlayElement({
        id: newId,
        pageId: pageDesc.id,
        kind: 'note',
        x: Math.min(0.92, nx),
        y: Math.min(0.92, ny),
        width: 0.042,
        height: 0.032,
        rotation: 0,
        opacity: 1,
        zIndex: tab.elements.length + 1,
        text: 'Nota de revisión…',
        color: '#F59E0B',
        author: settings.authorName,
        createdAt: new Date().toLocaleDateString('es-ES'),
      });
      onSelectElement(newId);
      if (settings.autoSelectAfterInsert) onSwitchToSelectTool();
      return;
    }

    // Auto-Numbered Callout Pin
    if (activeTool === 'callout') {
      const num = tab.nextCalloutNumber || 1;
      const newId = `cal_${Date.now()}`;
      onAddOverlayElement({
        id: newId,
        pageId: pageDesc.id,
        kind: 'callout',
        x: Math.min(0.8, nx),
        y: Math.min(0.92, ny),
        width: 0.19,
        height: 0.036,
        rotation: 0,
        opacity: 1,
        zIndex: tab.elements.length + 1,
        calloutNumber: num,
        text: `Nota #${num}`,
        color: '#2563EB',
      });
      onIncrementCalloutNumber();
      onSelectElement(newId);
      return;
    }

    // Accounting Reconciliation Audit Tickmarks
    if (
      activeTool === 'tick-ok' ||
      activeTool === 'tick-err' ||
      activeTool === 'tick-warn'
    ) {
      const variant =
        activeTool === 'tick-err'
          ? 'err'
          : activeTool === 'tick-warn'
          ? 'warn'
          : 'ok';
      const defaultColor =
        variant === 'ok' ? '#0D7A5F' : variant === 'err' ? '#C42B1C' : '#B45309';
      const defaultLabel =
        variant === 'ok'
          ? 'Conciliado OK'
          : variant === 'err'
          ? 'Diferencia'
          : 'Revisar IVA';
      const newId = `tm_${Date.now()}`;
      onAddOverlayElement({
        id: newId,
        pageId: pageDesc.id,
        kind: 'tickmark',
        x: Math.min(0.86, nx),
        y: Math.min(0.94, ny),
        width: 0.14,
        height: 0.032,
        rotation: 0,
        opacity: 1,
        zIndex: tab.elements.length + 1,
        tickVariant: variant,
        color: defaultColor,
        text: defaultLabel,
      });
      onSelectElement(newId);
      return;
    }

    // Engineering Calibrated Linear Distance Measurement
    if (activeTool === 'measure-line') {
      const startPt = { x: nx, y: ny };
      let endPt = { x: Math.min(0.98, nx + 0.08), y: ny };
      let label = formatEngineeringLength(
        pageDesc.widthPt,
        pageDesc.heightPt,
        startPt,
        endPt,
        tab.scaleCalibration
      );
      setDraftLine({ x1: startPt.x, y1: startPt.y, x2: endPt.x, y2: endPt.y, label });

      const onMove = (ev: MouseEvent) => {
        const p = getNormCoords(ev.clientX, ev.clientY);
        endPt = { x: p.nx, y: p.ny };
        label = formatEngineeringLength(
          pageDesc.widthPt,
          pageDesc.heightPt,
          startPt,
          endPt,
          tab.scaleCalibration
        );
        setDraftLine({ x1: startPt.x, y1: startPt.y, x2: endPt.x, y2: endPt.y, label });
      };

      const onUp = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        setDraftLine(null);
        const minX = Math.min(startPt.x, endPt.x);
        const maxX = Math.max(startPt.x, endPt.x);
        const minY = Math.min(startPt.y, endPt.y);
        const maxY = Math.max(startPt.y, endPt.y);
        const newId = `dim_${Date.now()}`;
        onAddOverlayElement({
          id: newId,
          pageId: pageDesc.id,
          kind: 'dimension',
          x: Math.max(0, minX - 0.015),
          y: Math.max(0, minY - 0.018),
          width: Math.max(0.06, maxX - minX + 0.03),
          height: Math.max(0.035, maxY - minY + 0.036),
          rotation: 0,
          opacity: 1,
          zIndex: tab.elements.length + 1,
          color: '#1D4ED8',
          strokeWidth: 2,
          points: [startPt, endPt],
          text: label,
          subText: `Escala ${tab.scaleCalibration.preset}`,
        });
        onSelectElement(newId);
      };

      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
      return;
    }

    // Engineering Calibrated Area Measurement (m² / cm² / ft²)
    if (activeTool === 'measure-area') {
      const startX = nx;
      const startY = ny;
      let curBox = { x: startX, y: startY, w: 0.06, h: 0.05 };
      setDraftBox(curBox);

      const onMove = (ev: MouseEvent) => {
        const p = getNormCoords(ev.clientX, ev.clientY);
        curBox = {
          x: Math.min(startX, p.nx),
          y: Math.min(startY, p.ny),
          w: Math.abs(p.nx - startX),
          h: Math.abs(p.ny - startY),
        };
        setDraftBox(curBox);
      };

      const onUp = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        setDraftBox(null);
        const finalW = Math.max(0.05, curBox.w);
        const finalH = Math.max(0.04, curBox.h);
        const areaText = formatEngineeringArea(
          pageDesc.widthPt,
          pageDesc.heightPt,
          finalW,
          finalH,
          tab.scaleCalibration
        );
        const newId = `area_${Date.now()}`;
        onAddOverlayElement({
          id: newId,
          pageId: pageDesc.id,
          kind: 'area',
          x: curBox.x,
          y: curBox.y,
          width: finalW,
          height: finalH,
          rotation: 0,
          opacity: 1,
          zIndex: tab.elements.length + 1,
          color: '#0D7A5F',
          strokeWidth: 1.8,
          text: areaText,
          subText: `Escala ${tab.scaleCalibration.preset}`,
        });
        onSelectElement(newId);
      };

      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
      return;
    }

    if (activeTool === 'ink') {
      const pts = [{ x: nx, y: ny }];
      setDraftInk(pts);
      const onMove = (ev: MouseEvent) => {
        const p = getNormCoords(ev.clientX, ev.clientY);
        pts.push({ x: p.nx, y: p.ny });
        setDraftInk([...pts]);
      };
      const onUp = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        setDraftInk(null);
        if (pts.length > 1) {
          const xs = pts.map((p) => p.x);
          const ys = pts.map((p) => p.y);
          const minX = Math.min(...xs);
          const maxX = Math.max(...xs);
          const minY = Math.min(...ys);
          const maxY = Math.max(...ys);
          const newId = `el_${Date.now()}`;
          onAddOverlayElement({
            id: newId,
            pageId: pageDesc.id,
            kind: 'ink',
            x: minX,
            y: minY,
            width: Math.max(0.02, maxX - minX),
            height: Math.max(0.02, maxY - minY),
            rotation: 0,
            opacity: 1,
            zIndex: tab.elements.length + 1,
            color: settings.defaultInkColor,
            strokeWidth: settings.defaultInkWidth,
            points: pts,
          });
        }
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
      return;
    }

    if (activeTool === 'arrow') {
      const startPt = { x: nx, y: ny };
      let endPt = { x: Math.min(0.98, nx + 0.08), y: Math.max(0.02, ny - 0.04) };
      setDraftLine({
        x1: startPt.x,
        y1: startPt.y,
        x2: endPt.x,
        y2: endPt.y,
        label: 'Flecha direccional',
        isArrow: true,
      });

      const onMove = (ev: MouseEvent) => {
        const p = getNormCoords(ev.clientX, ev.clientY);
        let px = p.nx;
        let py = p.ny;
        if (ev.shiftKey) {
          const dx = px - startPt.x;
          const dy = py - startPt.y;
          if (Math.abs(dx) >= Math.abs(dy)) py = startPt.y;
          else px = startPt.x;
        }
        endPt = { x: px, y: py };
        setDraftLine({
          x1: startPt.x,
          y1: startPt.y,
          x2: endPt.x,
          y2: endPt.y,
          label: ev.shiftKey ? 'Flecha recta (Shift)' : 'Flecha 360°',
          isArrow: true,
        });
      };

      const onUp = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        setDraftLine(null);
        const minX = Math.min(startPt.x, endPt.x);
        const maxX = Math.max(startPt.x, endPt.x);
        const minY = Math.min(startPt.y, endPt.y);
        const maxY = Math.max(startPt.y, endPt.y);
        const newId = `arr_${Date.now()}`;
        onAddOverlayElement({
          id: newId,
          pageId: pageDesc.id,
          kind: 'arrow',
          x: Math.max(0, minX - 0.012),
          y: Math.max(0, minY - 0.012),
          width: Math.max(0.04, maxX - minX + 0.024),
          height: Math.max(0.028, maxY - minY + 0.024),
          rotation: 0,
          opacity: 1,
          zIndex: tab.elements.length + 1,
          color: settings.defaultInkColor,
          strokeWidth: 2.2,
          points: [startPt, endPt],
        });
        onSelectElement(newId);
        if (settings.autoSelectAfterInsert) onSwitchToSelectTool();
      };

      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
      return;
    }

    const boxTools: ActiveTool[] = [
      'highlight',
      'underline',
      'strikeout',
      'rect',
      'ellipse',
      'redact',
    ];
    if (boxTools.includes(activeTool)) {
      const startX = nx;
      const startY = ny;
      let curBox = { x: startX, y: startY, w: 0.001, h: 0.001 };
      setDraftBox(curBox);

      const onMove = (ev: MouseEvent) => {
        const p = getNormCoords(ev.clientX, ev.clientY);
        curBox = {
          x: Math.min(startX, p.nx),
          y: Math.min(startY, p.ny),
          w: Math.abs(p.nx - startX),
          h: Math.abs(p.ny - startY),
        };
        setDraftBox(curBox);
      };

      const onUp = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        setDraftBox(null);
        const finalW = Math.max(0.04, curBox.w);
        const finalH = Math.max(0.018, curBox.h);
        const newId = `el_${Date.now()}`;
        onAddOverlayElement({
          id: newId,
          pageId: pageDesc.id,
          kind: activeTool === 'redact' ? 'redact' : (activeTool as PdfOverlayElement['kind']),
          x: curBox.x,
          y: curBox.y,
          width: finalW,
          height: finalH,
          rotation: 0,
          opacity: activeTool === 'highlight' ? 0.38 : 1,
          zIndex: tab.elements.length + 1,
          color:
            activeTool === 'highlight'
              ? settings.defaultHighlightColor
              : settings.defaultInkColor,
          backgroundColor: activeTool === 'redact' ? '#0B0C0E' : 'transparent',
          strokeWidth: 2.2,
        });
        onSelectElement(newId);
        if (settings.autoSelectAfterInsert) onSwitchToSelectTool();
      };

      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    }
  };

  // Drag & Drop Images directly onto any PDF page!
  const handleDropImageOnPage = async (e: React.DragEvent<HTMLDivElement>) => {
    const files = Array.from(e.dataTransfer.files || []).filter((f) =>
      f.type.startsWith('image/')
    );
    if (files.length === 0) return;
    e.preventDefault();
    e.stopPropagation();

    const { nx, ny } = getNormCoords(e.clientX, e.clientY);
    for (const imgFile of files) {
      const dataUrl = await fileToDataUrl(imgFile);
      const dims = await getImageDimensions(dataUrl);
      const aspect = dims.width / Math.max(1, dims.height);
      const w = 0.28;
      const h = Math.min(0.45, (w / aspect) * (boxSize.w / Math.max(1, boxSize.h)));
      const newId = `img_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      onAddOverlayElement({
        id: newId,
        pageId: pageDesc.id,
        kind: 'image',
        x: Math.min(0.7, nx),
        y: Math.min(0.7, ny),
        width: w,
        height: h,
        rotation: 0,
        opacity: 1,
        zIndex: tab.elements.length + 1,
        dataUrl,
        naturalWidth: dims.width,
        naturalHeight: dims.height,
        preserveAspect: true,
        text: imgFile.name,
      });
      onSelectElement(newId);
    }
  };

  const pageOverlays = tab.elements
    .filter((el) => el.pageId === pageDesc.id)
    .sort((a, b) => a.zIndex - b.zIndex);

  const cursorStyle =
    activeTool === 'pan'
      ? 'grab'
      : activeTool === 'add-text'
      ? 'text'
      : activeTool === 'ink' ||
        activeTool === 'rect' ||
        activeTool === 'ellipse' ||
        activeTool === 'arrow' ||
        activeTool === 'highlight' ||
        activeTool === 'redact' ||
        activeTool === 'measure-line' ||
        activeTool === 'measure-area' ||
        activeTool === 'callout' ||
        activeTool === 'tick-ok' ||
        activeTool === 'tick-err' ||
        activeTool === 'tick-warn'
      ? 'crosshair'
      : 'default';

  const activeNativeOnPage =
    isEditableMode && selectedNativeTextId
      ? mergedNativeItems.find((n) => n.id === selectedNativeTextId && !n.deleted) || null
      : null;

  return (
    <div
      className={`pdf-page-shell paper-${tab.paperFilter}`}
      style={{ width: boxSize.w, height: boxSize.h }}
      data-page-index={pageIndex}
    >
      <canvas ref={canvasRef} className="pdf-render-canvas" />

      {/* Interactive Vector & Text Overlay Layer */}
      <div
        ref={overlayRef}
        className={`pdf-overlay-layer ${activeNativeOnPage ? 'has-active-native-edit' : ''}`}
        style={{ cursor: cursorStyle }}
        onMouseDown={handleStageMouseDown}
        onDoubleClick={handleStageDoubleClick}
        onDragOver={(e) => {
          if (Array.from(e.dataTransfer.types).includes('Files')) e.preventDefault();
        }}
        onDrop={handleDropImageOnPage}
      >
        {/* Live Floating Manipulation HUD Pill */}
        {dragHud && <div className="live-drag-hud">{dragHud}</div>}

        {/* Smart Alignment Guides */}
        {snapV !== null && (
          <div className="snap-guide-v" style={{ left: `${snapV * 100}%` }} />
        )}
        {snapH !== null && (
          <div className="snap-guide-h" style={{ top: `${snapH * 100}%` }} />
        )}

        {/* Live Crop Margin Trim Mask Preview (clipped safely inside its own wrapper) */}
        {pageDesc.crop &&
          (pageDesc.crop.top > 0 ||
            pageDesc.crop.right > 0 ||
            pageDesc.crop.bottom > 0 ||
            pageDesc.crop.left > 0) && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                overflow: 'hidden',
                pointerEvents: 'none',
                zIndex: 18,
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: `${pageDesc.crop.top * 100}%`,
                  right: `${pageDesc.crop.right * 100}%`,
                  bottom: `${pageDesc.crop.bottom * 100}%`,
                  left: `${pageDesc.crop.left * 100}%`,
                  border: '1.5px dashed var(--accent)',
                  boxShadow: '0 0 0 9999px rgba(15, 23, 42, 0.24)',
                }}
              />
            </div>
          )}

        {/* 1. Original Position Cover Patches for Modified/Moved/Deleted/Active Native PDF Texts */}
        {mergedNativeItems
          .filter(
            (nt) =>
              nt.pageId === pageDesc.id &&
              (nt.modified || nt.deleted || selectedNativeTextId === nt.id)
          )
          .map((nt) => (
            <div
              key={`patch_${nt.id}`}
              className="native-text-patch"
              style={{
                left: `calc(${nt.origX * 100}% - 0.5px)`,
                top: `calc(${nt.origY * 100}% - 0.5px)`,
                width: `calc(${nt.origWidth * 100}% + 1px)`,
                height: `calc(${nt.origHeight * 100}% + 1px)`,
                backgroundColor: nt.bgPatchColor || '#ffffff',
              }}
            />
          ))}

        {/* 2. Editable & Movable Native PDF Text Blocks */}
        {mergedNativeItems
          .filter((nt) => !nt.deleted)
          .map((nt) => {
            const isSelected = selectedNativeTextId === nt.id;
            const isEditTool = isEditableMode && activeTool === 'edit-pdf-text';
            const scaledFontPx = Math.max(8, nt.fontSizePt * tab.zoom);
            const maxAvailPx = Math.max(48, (0.972 - nt.x) * boxSize.w);
            const targetWrapPx =
              typeof nt.customWidth === 'number' && nt.customWidth > 0.03
                ? Math.min(maxAvailPx, Math.max(48, nt.customWidth * boxSize.w))
                : maxAvailPx;
            const measured = measureTextLayoutPx(
              nt.text,
              scaledFontPx,
              nt.fontFamily,
              nt.fontWeight,
              nt.fontStyle,
              targetWrapPx
            );
            const finalWidthPx =
              typeof nt.customWidth === 'number' && nt.customWidth > 0.03
                ? targetWrapPx
                : Math.min(maxAvailPx, Math.max(measured.naturalWidthPx, 48));
            const visualRows = measured.rows;

            // Case A: Unmodified text that is NOT currently selected
            if (!nt.modified && !isSelected) {
              if (!isEditTool) return null;
              // Clean hover hotspot: click to edit inline, OR drag immediately to move!
              return (
                <div
                  key={nt.id}
                  className="native-text-hotspot"
                  style={{
                    left: `${nt.x * 100}%`,
                    top: `${nt.y * 100}%`,
                    width: `${nt.width * 100}%`,
                    height: `${nt.height * 100}%`,
                  }}
                  title="Clic para editar texto · Arrastra para moverlo"
                  onMouseDown={(e) => startMoveNativeText(e, nt, true)}
                />
              );
            }

            // Case B: Actively selected for editing OR Modified text item
            const isNearTop = nt.y < 0.095;
            const isNearRight = nt.x > 0.54;
            const bgSolid = nt.bgPatchColor || '#ffffff';

            const ntRot = normalizeAngleDeg(nt.rotation || 0);

            return (
              <div
                key={nt.id}
                className={`native-text-box ${nt.modified ? 'modified' : ''} ${
                  isSelected ? 'selected' : ''
                } ${!isEditTool && !isSelected ? 'readonly-modified' : ''}`}
                style={{
                  left: `${nt.x * 100}%`,
                  top: `${nt.y * 100}%`,
                  maxWidth: `${Math.max(5, (0.972 - nt.x) * 100)}%`,
                }}
                onMouseDown={(e) => {
                  if (!isSelected || e.altKey) {
                    startMoveNativeText(e, nt, !isSelected);
                    return;
                  }
                  e.stopPropagation();
                  onSelectNativeText(nt.id);
                  onSelectElement(null);
                }}
              >
                {/* Floating Quick Action Bar when Selected (stays upright 0° even when text is rotated!) */}
                {isSelected && isEditTool && (
                  <div
                    className={`object-quickbar ${isNearTop ? 'placed-bottom' : ''}`}
                    style={isNearRight ? { left: 'auto', right: 0 } : undefined}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      className="btn"
                      style={{ height: 24, padding: '0 6px', fontSize: 11, cursor: 'grab' }}
                      onMouseDown={(e) => startMoveNativeText(e, nt)}
                      title="Arrastra para mover con alineación magnética"
                    >
                      <GripHorizontal size={13} />
                      <span>Mover</span>
                    </button>

                    <div style={{ width: 1, height: 16, background: 'var(--border-subtle)', margin: '0 2px' }} />

                    <FontPickerControl
                      compact
                      selectWidth={94}
                      value={nt.fontFamily}
                      customFonts={customFonts}
                      onChange={(nextFamily) =>
                        onUpdateNativeTextItem(
                          { ...nt, fontFamily: nextFamily, modified: true },
                          true
                        )
                      }
                      onUploadFiles={
                        onUploadCustomFontForTarget
                          ? (files) =>
                              onUploadCustomFontForTarget(files, (choice) =>
                                onUpdateNativeTextItem(
                                  { ...nt, fontFamily: choice, modified: true },
                                  true
                                )
                              )
                          : undefined
                      }
                    />

                    <button
                      type="button"
                      className="btn icon-only"
                      style={{ width: 22, height: 22, fontSize: 10, fontWeight: 700 }}
                      onClick={() =>
                        onUpdateNativeTextItem(
                          { ...nt, fontSizePt: Math.max(6, Math.round((nt.fontSizePt - 1) * 2) / 2), modified: true },
                          true
                        )
                      }
                      title="Reducir tamaño de letra (A-)"
                    >
                      A-
                    </button>
                    <span style={{ fontSize: 10.5, fontWeight: 600, padding: '0 3px', color: 'var(--text-muted)' }}>
                      {nt.fontSizePt}pt
                    </span>
                    <button
                      type="button"
                      className="btn icon-only"
                      style={{ width: 22, height: 22, fontSize: 10, fontWeight: 700 }}
                      onClick={() =>
                        onUpdateNativeTextItem(
                          { ...nt, fontSizePt: Math.min(72, Math.round((nt.fontSizePt + 1) * 2) / 2), modified: true },
                          true
                        )
                      }
                      title="Aumentar tamaño de letra (A+)"
                    >
                      A+
                    </button>

                    <button
                      type="button"
                      className={`btn icon-only ${nt.fontWeight === 'bold' ? 'active' : ''}`}
                      style={{ width: 22, height: 22 }}
                      onClick={() =>
                        onUpdateNativeTextItem(
                          {
                            ...nt,
                            fontWeight: nt.fontWeight === 'bold' ? 'normal' : 'bold',
                            modified: true,
                          },
                          true
                        )
                      }
                      title="Alternar negrita"
                    >
                      <Bold size={11.5} />
                    </button>

                    <label
                      className="quickbar-color-chip"
                      title="Color del texto (A)"
                    >
                      <span
                        style={{
                          display: 'inline-flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          lineHeight: 1,
                        }}
                      >
                        <span>A</span>
                        <span
                          style={{
                            width: 12,
                            height: 3,
                            borderRadius: 1.5,
                            backgroundColor: nt.color,
                            boxShadow: '0 0 0 1px rgba(148,163,184,0.45)',
                            marginTop: 1,
                          }}
                        />
                      </span>
                      <input
                        type="color"
                        value={nt.color}
                        onChange={(e) =>
                          onUpdateNativeTextItem(
                            { ...nt, color: e.target.value, modified: true },
                            true
                          )
                        }
                        style={{ opacity: 0, position: 'absolute', inset: 0, cursor: 'pointer' }}
                      />
                    </label>

                    <label
                      className="quickbar-color-chip"
                      title="Color del fondo (parche)"
                    >
                      <span
                        style={{
                          width: 11,
                          height: 11,
                          borderRadius: 2.5,
                          backgroundColor: bgSolid,
                          border: '1px solid rgba(148,163,184,0.75)',
                          display: 'inline-block',
                        }}
                      />
                      <span style={{ fontSize: 10 }}>Fondo</span>
                      <input
                        type="color"
                        value={bgSolid}
                        onChange={(e) =>
                          onUpdateNativeTextItem(
                            { ...nt, bgPatchColor: e.target.value, modified: true },
                            true
                          )
                        }
                        style={{ opacity: 0, position: 'absolute', inset: 0, cursor: 'pointer' }}
                      />
                    </label>

                    <div style={{ width: 1, height: 16, background: 'var(--border-subtle)', margin: '0 2px' }} />

                    <button
                      type="button"
                      className={`btn icon-only ${ntRot !== 0 ? 'active' : ''}`}
                      style={{ width: 22, height: 22 }}
                      onClick={() =>
                        onUpdateNativeTextItem(
                          {
                            ...nt,
                            rotation: normalizeAngleDeg(ntRot + 90),
                            modified: true,
                          },
                          true
                        )
                      }
                      title={`Girar +90° (Actual: ${ntRot}° · También puedes arrastrar el círculo inferior 360°)`}
                    >
                      <RotateCw size={11.5} />
                    </button>

                    <button
                      type="button"
                      className="btn icon-only"
                      style={{ width: 22, height: 22 }}
                      onClick={() => duplicateNativeTextAsOverlay(nt)}
                      title="Duplicar como texto libre móvil (Ctrl+D)"
                    >
                      <Copy size={11.5} />
                    </button>

                    {nt.modified && (
                      <button
                        type="button"
                        className="btn icon-only"
                        style={{ width: 22, height: 22 }}
                        onClick={() => onResetNativeTextItem(nt.id)}
                        title="Restaurar texto original"
                      >
                        <RotateCcw size={12} />
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn icon-only"
                      style={{ width: 22, height: 22, color: 'var(--danger)' }}
                      onClick={() =>
                        onUpdateNativeTextItem(
                          { ...nt, deleted: true, modified: true },
                          true
                        )
                      }
                      title="Borrar este texto del PDF"
                    >
                      <Trash2 size={12} />
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      style={{ height: 22, padding: '0 8px', fontSize: 10.5, marginLeft: 2 }}
                      onClick={() => onSelectNativeText(null)}
                      title="Confirmar edición (o presiona Esc)"
                    >
                      ✓ Listo
                    </button>
                  </div>
                )}

                <div
                  className="native-rotatable-stage"
                  style={{
                    minHeight: `${Math.max(14, nt.height * boxSize.h)}px`,
                    backgroundColor: bgSolid,
                    transform: ntRot ? `rotate(${ntRot}deg)` : undefined,
                    transformOrigin: 'center center',
                  }}
                >
                  {/* Left Drag-Grip Handle Pill when Selected */}
                  {isSelected && isEditTool && (
                    <div
                      className="native-drag-handle"
                      onMouseDown={(e) => startMoveNativeText(e, nt)}
                      title="Arrastra desde aquí para mover el texto (Shift = recto)"
                    >
                      <GripVertical size={11} />
                    </div>
                  )}

                  {/* Right Column-Width Resize Handle when Selected */}
                  {isSelected && isEditTool && (
                    <div
                      className="native-width-handle"
                      onMouseDown={(e) => startResizeNativeTextWidth(e, nt, finalWidthPx)}
                      title="Arrastra el borde derecho para ajustar el ancho de columna del texto"
                    />
                  )}

                  {/* Bottom-Center 360° Free/Snap Rotation Handle */}
                  {isSelected && isEditTool && (
                    <>
                      <div className="rotate-handle-stem" />
                      <div
                        className="rotate-handle-knob"
                        onMouseDown={(e) => startRotateNativeText(e, nt)}
                        title="Arrastra en círculo para rotar el texto 360° (Shift = saltos exactos de 15°)"
                      >
                        <RotateCw size={11} />
                      </div>
                    </>
                  )}

                  {/* If selected in edit mode: Editable Textarea (No Spellcheck Squiggles!) */}
                  {isSelected && isEditTool ? (
                    <textarea
                      rows={visualRows}
                      className="native-text-editor"
                      autoFocus
                      spellCheck={false}
                      autoCorrect="off"
                      autoCapitalize="off"
                      value={nt.text}
                      onFocus={() => {
                        onSelectNativeText(nt.id);
                        onSelectElement(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                          onSelectNativeText(null);
                        }
                      }}
                      onChange={(e) =>
                        onUpdateNativeTextItem(
                          {
                            ...nt,
                            text: e.target.value,
                            modified: true,
                          },
                          true
                        )
                      }
                      style={{
                        fontFamily: cssFontForChoice(nt.fontFamily),
                        fontSize: `${scaledFontPx}px`,
                        fontWeight: nt.fontWeight,
                        fontStyle: nt.fontStyle,
                        color: nt.color,
                        backgroundColor: bgSolid,
                        width: `${finalWidthPx}px`,
                      }}
                    />
                  ) : (
                    /* Modified item display when NOT actively selected */
                    <span
                      style={{
                        fontFamily: cssFontForChoice(nt.fontFamily),
                        fontSize: `${scaledFontPx}px`,
                        fontWeight: nt.fontWeight,
                        fontStyle: nt.fontStyle,
                        color: nt.color,
                        whiteSpace: 'pre-wrap',
                        overflowWrap: 'break-word',
                        display: 'inline-block',
                        maxWidth: `${targetWrapPx}px`,
                        width: nt.customWidth ? `${targetWrapPx}px` : undefined,
                        lineHeight: 1.18,
                        backgroundColor: bgSolid,
                      }}
                    >
                      {nt.text}
                    </span>
                  )}
                </div>
              </div>
            );
          })}

        {/* 3. Rich Movable & Resizable Overlay Elements */}
        {pageOverlays.map((el) => {
          const isSelected = isEditableMode && selectedElementId === el.id;
          const isInlineEditing = editingOverlayId === el.id;
          const fontPx = Math.max(8, (el.fontSizePt || 12) * tab.zoom);
          const ntRight = activeNativeOnPage
            ? activeNativeOnPage.x +
              (activeNativeOnPage.customWidth ?? Math.max(activeNativeOnPage.width, 0.25))
            : 0;
          const ntBottom = activeNativeOnPage
            ? activeNativeOnPage.y + Math.max(activeNativeOnPage.height, 0.032)
            : 0;
          const overlapsActiveNative =
            Boolean(activeNativeOnPage) &&
            !isSelected &&
            (el.kind === 'image' ||
              el.kind === 'signature' ||
              el.kind === 'stamp' ||
              el.kind === 'rect' ||
              el.kind === 'redact') &&
            el.x < ntRight + 0.01 &&
            el.x + el.width > activeNativeOnPage!.x - 0.01 &&
            el.y < ntBottom + 0.015 &&
            el.y + el.height > activeNativeOnPage!.y - 0.015;

          const isRotatableKind =
            el.kind === 'text' ||
            el.kind === 'stamp' ||
            el.kind === 'image' ||
            el.kind === 'signature' ||
            el.kind === 'rect';
          const elRot = isRotatableKind ? normalizeAngleDeg(el.rotation || 0) : 0;

          return (
            <div
              key={el.id}
              className={`overlay-item ${isSelected ? 'selected' : ''} ${
                overlapsActiveNative ? 'xray-ghost' : ''
              }`}
              style={{
                left: `${el.x * 100}%`,
                top: `${el.y * 100}%`,
                width: `${el.width * 100}%`,
                height: `${el.height * 100}%`,
                opacity: el.opacity ?? 1,
                zIndex: 44 + Math.min(el.zIndex, 20),
                pointerEvents: isEditableMode ? 'auto' : 'none',
              }}
              onMouseDown={(e) => startMoveOverlay(e, el)}
              onDoubleClick={(e) => {
                e.stopPropagation();
                if (el.kind === 'text') setEditingOverlayId(el.id);
              }}
            >
              {/* Floating Quick Actions when Selected (stays upright 0°!) */}
              {isSelected && (
                <div
                  className="object-quickbar"
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  {el.kind === 'text' && (
                    <FontPickerControl
                      compact
                      selectWidth={98}
                      value={el.fontFamily || 'sans'}
                      customFonts={customFonts}
                      onChange={(nextFamily) =>
                        onUpdateOverlayElement(el.id, { fontFamily: nextFamily }, true)
                      }
                      onUploadFiles={
                        onUploadCustomFontForTarget
                          ? (files) =>
                              onUploadCustomFontForTarget(files, (choice) =>
                                onUpdateOverlayElement(el.id, { fontFamily: choice }, true)
                              )
                          : undefined
                      }
                    />
                  )}
                  {el.kind === 'image' && el.dataUrl && (
                    <button
                      type="button"
                      className="btn"
                      style={{ height: 24, padding: '0 7px', fontSize: 11, color: 'var(--accent)' }}
                      onClick={async () => {
                        if (!el.dataUrl) return;
                        const cleaned = await removeSignatureBackground(el.dataUrl, undefined, 232);
                        onUpdateOverlayElement(el.id, { dataUrl: cleaned }, true);
                      }}
                      title="Quitar fondo blanco de esta imagen o logotipo"
                    >
                      <Wand2 size={12} />
                      <span>Sin fondo</span>
                    </button>
                  )}
                  {isRotatableKind && (
                    <button
                      type="button"
                      className={`btn icon-only ${elRot !== 0 ? 'active' : ''}`}
                      style={{ width: 24, height: 24 }}
                      onClick={() =>
                        onUpdateOverlayElement(
                          el.id,
                          { rotation: normalizeAngleDeg(elRot + 90) },
                          true
                        )
                      }
                      title={`Girar +90° (Actual: ${elRot}° · También puedes arrastrar el círculo inferior 360°)`}
                    >
                      <RotateCw size={12.5} />
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn icon-only"
                    style={{ width: 24, height: 24 }}
                    onClick={() => onDuplicateOverlayElement(el.id)}
                    title="Duplicar elemento (Ctrl+D)"
                  >
                    <Copy size={12.5} />
                  </button>
                  <button
                    type="button"
                    className="btn icon-only"
                    style={{ width: 24, height: 24 }}
                    onClick={() => onReorderElementLayer(el.id, 'front')}
                    title="Traer al frente"
                  >
                    <ArrowUp size={12.5} />
                  </button>
                  <button
                    type="button"
                    className="btn icon-only"
                    style={{ width: 24, height: 24 }}
                    onClick={() => onReorderElementLayer(el.id, 'back')}
                    title="Enviar al fondo"
                  >
                    <ArrowDown size={12.5} />
                  </button>
                  <button
                    type="button"
                    className="btn icon-only"
                    style={{ width: 24, height: 24, color: 'var(--danger)' }}
                    onClick={() => onDeleteOverlayElement(el.id)}
                    title="Eliminar (Supr)"
                  >
                    <Trash2 size={12.5} />
                  </button>
                </div>
              )}

              <div
                className="overlay-rotatable-stage"
                style={{
                  transform: elRot ? `rotate(${elRot}deg)` : undefined,
                  transformOrigin: 'center center',
                }}
              >
                {/* 360° Endpoint Handles for Arrows & Dimensions vs 8 Box Resize Handles */}
                {isSelected &&
                  (el.kind === 'arrow' || el.kind === 'dimension' ? (
                    <>
                      {(() => {
                        const p0 = el.points?.[0] || { x: el.x, y: el.y + el.height };
                        const p1 = el.points?.[1] || { x: el.x + el.width, y: el.y };
                        const relX0 = ((p0.x - el.x) / Math.max(0.001, el.width)) * 100;
                        const relY0 = ((p0.y - el.y) / Math.max(0.001, el.height)) * 100;
                        const relX1 = ((p1.x - el.x) / Math.max(0.001, el.width)) * 100;
                        const relY1 = ((p1.y - el.y) / Math.max(0.001, el.height)) * 100;
                        return (
                          <>
                            <div
                              className="endpoint-handle"
                              style={{ left: `${relX0}%`, top: `${relY0}%` }}
                              title="Arrastra el origen (Shift = línea recta)"
                              onMouseDown={(e) => startDragEndpoint(e, el, 0)}
                            />
                            <div
                              className="endpoint-handle"
                              style={{ left: `${relX1}%`, top: `${relY1}%` }}
                              title="Arrastra la punta en cualquier dirección 360° (Shift = recto)"
                              onMouseDown={(e) => startDragEndpoint(e, el, 1)}
                            />
                          </>
                        );
                      })()}
                    </>
                  ) : (
                    <>
                      {(['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as ResizeHandleDir[]).map(
                        (dir) => (
                          <div
                            key={dir}
                            className={`resize-handle ${dir}`}
                            onMouseDown={(e) => startResizeOverlay(e, el, dir)}
                          />
                        )
                      )}
                      {isRotatableKind && (
                        <>
                          <div className="rotate-handle-stem" />
                          <div
                            className="rotate-handle-knob"
                            onMouseDown={(e) => startRotateOverlay(e, el)}
                            title="Arrastra en círculo para rotar 360° (Shift = saltos exactos de 15°)"
                          >
                            <RotateCw size={11} />
                          </div>
                        </>
                      )}
                    </>
                  ))}

              {/* Render Element Visual Content */}
              {el.kind === 'text' &&
                (isInlineEditing ? (
                  <textarea
                    autoFocus
                    spellCheck={false}
                    autoCorrect="off"
                    value={el.text || ''}
                    onChange={(e) =>
                      onUpdateOverlayElement(el.id, { text: e.target.value }, true)
                    }
                    onBlur={() => setEditingOverlayId(null)}
                    onMouseDown={(e) => e.stopPropagation()}
                    style={{
                      width: '100%',
                      height: '100%',
                      resize: 'none',
                      border: 'none',
                      outline: 'none',
                      padding: 4,
                      background:
                        el.backgroundColor && el.backgroundColor !== 'transparent'
                          ? el.backgroundColor
                          : 'rgba(255,255,255,0.92)',
                      fontFamily: cssFontForChoice(el.fontFamily),
                      fontSize: `${fontPx}px`,
                      fontWeight: el.fontWeight || 'normal',
                      fontStyle: el.fontStyle || 'normal',
                      textAlign: el.textAlign || 'left',
                      color: el.color || '#111318',
                      lineHeight: 1.24,
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: '100%',
                      height: '100%',
                      padding: 4,
                      background: el.backgroundColor || 'transparent',
                      border:
                        el.borderColor && el.borderColor !== 'transparent'
                          ? `1px solid ${el.borderColor}`
                          : 'none',
                      fontFamily: cssFontForChoice(el.fontFamily),
                      fontSize: `${fontPx}px`,
                      fontWeight: el.fontWeight || 'normal',
                      fontStyle: el.fontStyle || 'normal',
                      textAlign: el.textAlign || 'left',
                      color: el.color || '#111318',
                      whiteSpace: 'pre-wrap',
                      lineHeight: 1.24,
                      overflow: 'hidden',
                    }}
                  >
                    {el.text}
                  </div>
                ))}

              {(el.kind === 'image' || el.kind === 'signature') && el.dataUrl && (
                <div style={{ width: '100%', height: '100%', position: 'relative' }}>
                  <img
                    src={el.dataUrl}
                    alt={el.kind}
                    draggable={false}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: el.preserveAspect ? 'contain' : 'fill',
                      display: 'block',
                      pointerEvents: 'none',
                    }}
                  />
                  {el.kind === 'signature' && el.subText && (
                    <div
                      style={{
                        fontSize: `${Math.max(8, 7.5 * tab.zoom)}px`,
                        fontFamily: 'var(--font-mono)',
                        color: '#525866',
                        marginTop: 2,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {el.subText}
                    </div>
                  )}
                </div>
              )}

              {el.kind === 'stamp' && (
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    border: `2.5px solid ${el.color || '#2563EB'}`,
                    borderRadius: 6,
                    backgroundColor: `${el.color || '#2563EB'}14`,
                    color: el.color || '#2563EB',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 4,
                    textAlign: 'center',
                  }}
                >
                  <div
                    style={{
                      fontWeight: 800,
                      letterSpacing: '0.06em',
                      fontSize: `${Math.max(10, 14 * tab.zoom)}px`,
                      lineHeight: 1.1,
                    }}
                  >
                    {el.text || 'APROBADO'}
                  </div>
                  {el.subText && (
                    <div
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: `${Math.max(7.5, 8.5 * tab.zoom)}px`,
                        marginTop: 2,
                      }}
                    >
                      {el.subText}
                    </div>
                  )}
                </div>
              )}

              {el.kind === 'highlight' && (
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    backgroundColor: el.color || '#FACC15',
                    mixBlendMode: 'multiply',
                  }}
                />
              )}

              {el.kind === 'underline' && (
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    borderBottom: `${Math.max(2, (el.strokeWidth || 2) * tab.zoom)}px solid ${
                      el.color || '#2563EB'
                    }`,
                  }}
                />
              )}

              {el.kind === 'strikeout' && (
                <div
                  style={{
                    width: '100%',
                    height: '50%',
                    borderBottom: `${Math.max(2, (el.strokeWidth || 2) * tab.zoom)}px solid ${
                      el.color || '#2563EB'
                    }`,
                  }}
                />
              )}

              {el.kind === 'redact' && (
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    backgroundColor: el.backgroundColor || '#0B0C0E',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'rgba(255,255,255,0.45)',
                    fontSize: 9,
                    fontFamily: 'var(--font-mono)',
                    letterSpacing: '0.08em',
                  }}
                >
                  CONFIDENCIAL
                </div>
              )}

              {el.kind === 'rect' && (
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    border: `${Math.max(1.5, (el.strokeWidth || 2) * tab.zoom)}px solid ${
                      el.color || '#2563EB'
                    }`,
                    backgroundColor:
                      el.backgroundColor && el.backgroundColor !== 'transparent'
                        ? `${el.backgroundColor}38`
                        : 'transparent',
                  }}
                />
              )}

              {el.kind === 'ellipse' && (
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    borderRadius: '50%',
                    border: `${Math.max(1.5, (el.strokeWidth || 2) * tab.zoom)}px solid ${
                      el.color || '#2563EB'
                    }`,
                  }}
                />
              )}

              {el.kind === 'arrow' &&
                (() => {
                  const p0 = el.points?.[0] || { x: el.x, y: el.y + el.height };
                  const p1 = el.points?.[1] || { x: el.x + el.width, y: el.y };
                  const x1 = (p0.x - el.x) * boxSize.w;
                  const y1 = (p0.y - el.y) * boxSize.h;
                  const x2 = (p1.x - el.x) * boxSize.w;
                  const y2 = (p1.y - el.y) * boxSize.h;
                  const ang = Math.atan2(y2 - y1, x2 - x1);
                  const headLen = Math.max(9, 11 * tab.zoom);
                  const hx1 = x2 - headLen * Math.cos(ang - Math.PI / 6);
                  const hy1 = y2 - headLen * Math.sin(ang - Math.PI / 6);
                  const hx2 = x2 - headLen * Math.cos(ang + Math.PI / 6);
                  const hy2 = y2 - headLen * Math.sin(ang + Math.PI / 6);
                  const sw = Math.max(2, (el.strokeWidth || 2.2) * tab.zoom);
                  const col = el.color || '#2563EB';
                  return (
                    <svg
                      width="100%"
                      height="100%"
                      style={{ overflow: 'visible', display: 'block' }}
                    >
                      <line
                        x1={x1}
                        y1={y1}
                        x2={x2}
                        y2={y2}
                        stroke={col}
                        strokeWidth={sw}
                        strokeLinecap="round"
                      />
                      <polyline
                        points={`${hx1},${hy1} ${x2},${y2} ${hx2},${hy2}`}
                        fill="none"
                        stroke={col}
                        strokeWidth={sw}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  );
                })()}

              {el.kind === 'note' && (
                <div
                  title={`${el.author || 'Nota'}: ${el.text || ''}`}
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: '6px 6px 6px 1px',
                    backgroundColor: el.color || '#F59E0B',
                    color: '#ffffff',
                    fontWeight: 800,
                    fontSize: 11,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: 'var(--shadow-sm)',
                  }}
                >
                  N
                </div>
              )}

              {el.kind === 'ink' && el.points && el.points.length > 1 && (
                <svg
                  width="100%"
                  height="100%"
                  viewBox={`${el.x * 1000} ${el.y * 1000} ${Math.max(1, el.width * 1000)} ${Math.max(
                    1,
                    el.height * 1000
                  )}`}
                  preserveAspectRatio="none"
                  style={{ overflow: 'visible' }}
                >
                  <polyline
                    fill="none"
                    stroke={el.color || '#2563EB'}
                    strokeWidth={(el.strokeWidth || 2.5) * 2.2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={el.points
                      .map((p) => `${p.x * 1000},${p.y * 1000}`)
                      .join(' ')}
                  />
                </svg>
              )}

              {/* Engineering Linear Dimension (Cota Escalar) */}
              {el.kind === 'dimension' && (
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {el.points && el.points.length >= 2 ? (
                    <svg
                      width="100%"
                      height="100%"
                      viewBox={`${el.x * 1000} ${el.y * 1000} ${Math.max(
                        1,
                        el.width * 1000
                      )} ${Math.max(1, el.height * 1000)}`}
                      preserveAspectRatio="none"
                      style={{ position: 'absolute', inset: 0, overflow: 'visible' }}
                    >
                      <line
                        x1={el.points[0].x * 1000}
                        y1={el.points[0].y * 1000}
                        x2={el.points[1].x * 1000}
                        y2={el.points[1].y * 1000}
                        stroke={el.color || '#1D4ED8'}
                        strokeWidth={Math.max(2, (el.strokeWidth || 2) * 1.4)}
                      />
                      <circle
                        cx={el.points[0].x * 1000}
                        cy={el.points[0].y * 1000}
                        r={4}
                        fill={el.color || '#1D4ED8'}
                      />
                      <circle
                        cx={el.points[1].x * 1000}
                        cy={el.points[1].y * 1000}
                        r={4}
                        fill={el.color || '#1D4ED8'}
                      />
                    </svg>
                  ) : null}
                  <div
                    style={{
                      position: 'relative',
                      background: '#ffffff',
                      border: `1.5px solid ${el.color || '#1D4ED8'}`,
                      color: el.color || '#1D4ED8',
                      borderRadius: 4,
                      padding: '1px 6px',
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 700,
                      fontSize: `${Math.max(9, 9.5 * tab.zoom)}px`,
                      whiteSpace: 'nowrap',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
                    }}
                  >
                    {el.text}
                  </div>
                </div>
              )}

              {/* Engineering Area Measurement Polygon Box */}
              {el.kind === 'area' && (
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    border: `1.8px dashed ${el.color || '#0D7A5F'}`,
                    backgroundColor: `${el.color || '#0D7A5F'}18`,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 4,
                  }}
                >
                  <span
                    style={{
                      background: '#ffffff',
                      border: `1px solid ${el.color || '#0D7A5F'}`,
                      color: el.color || '#0D7A5F',
                      borderRadius: 4,
                      padding: '2px 7px',
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 700,
                      fontSize: `${Math.max(9, 10 * tab.zoom)}px`,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {el.text}
                  </span>
                  {el.subText && (
                    <span
                      style={{
                        fontSize: `${Math.max(7.5, 8 * tab.zoom)}px`,
                        color: el.color || '#0D7A5F',
                        fontWeight: 600,
                        marginTop: 2,
                      }}
                    >
                      {el.subText}
                    </span>
                  )}
                </div>
              )}

              {/* Engineering Auto-Numbered Callout Pin */}
              {el.kind === 'callout' && (
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                  }}
                >
                  <div
                    style={{
                      width: Math.max(20, 20 * tab.zoom),
                      height: Math.max(20, 20 * tab.zoom),
                      borderRadius: '50%',
                      backgroundColor: el.color || '#2563EB',
                      color: '#ffffff',
                      fontWeight: 800,
                      fontSize: `${Math.max(9.5, 10 * tab.zoom)}px`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
                    }}
                  >
                    {el.calloutNumber || 1}
                  </div>
                  {el.text && (
                    <div
                      style={{
                        background: 'rgba(255,255,255,0.95)',
                        border: `1.2px solid ${el.color || '#2563EB'}`,
                        color: '#111318',
                        borderRadius: 4,
                        padding: '2px 6px',
                        fontSize: `${Math.max(8.5, 9 * tab.zoom)}px`,
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {el.text}
                    </div>
                  )}
                </div>
              )}

              {/* Accounting Reconciliation Audit Tickmark */}
              {el.kind === 'tickmark' && (
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    background: `${el.color || '#0D7A5F'}16`,
                    border: `1.5px solid ${el.color || '#0D7A5F'}`,
                    color: el.color || '#0D7A5F',
                    borderRadius: 99,
                    padding: '1px 7px',
                    fontSize: `${Math.max(8.5, 9.2 * tab.zoom)}px`,
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                  }}
                >
                  <span style={{ fontWeight: 900 }}>
                    {el.tickVariant === 'err'
                      ? '✗'
                      : el.tickVariant === 'warn'
                      ? '!'
                      : '✓'}
                  </span>
                  <span>{el.text}</span>
                </div>
              )}
              </div>
            </div>
          );
        })}

        {/* Live Draft Drawing Feedback */}
        {draftBox && (
          <div
            style={{
              position: 'absolute',
              left: `${draftBox.x * 100}%`,
              top: `${draftBox.y * 100}%`,
              width: `${draftBox.w * 100}%`,
              height: `${draftBox.h * 100}%`,
              border: '1.5px dashed var(--accent)',
              backgroundColor: 'var(--accent-soft)',
              pointerEvents: 'none',
            }}
          />
        )}
        {draftLine && (
          <>
            <svg
              width="100%"
              height="100%"
              viewBox="0 0 1000 1000"
              preserveAspectRatio="none"
              style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
            >
              <line
                x1={draftLine.x1 * 1000}
                y1={draftLine.y1 * 1000}
                x2={draftLine.x2 * 1000}
                y2={draftLine.y2 * 1000}
                stroke="#1D4ED8"
                strokeWidth={3}
                strokeDasharray="6 4"
              />
            </svg>
            <div
              style={{
                position: 'absolute',
                left: `${((draftLine.x1 + draftLine.x2) / 2) * 100}%`,
                top: `${((draftLine.y1 + draftLine.y2) / 2) * 100}%`,
                transform: 'translate(-50%, -120%)',
                background: '#1D4ED8',
                color: '#ffffff',
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                fontWeight: 700,
                padding: '2px 7px',
                borderRadius: 4,
                pointerEvents: 'none',
                whiteSpace: 'nowrap',
              }}
            >
              {draftLine.label}
            </div>
          </>
        )}
        {draftInk && draftInk.length > 1 && (
          <svg
            width="100%"
            height="100%"
            viewBox="0 0 1000 1000"
            preserveAspectRatio="none"
            style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
          >
            <polyline
              fill="none"
              stroke={settings.defaultInkColor}
              strokeWidth={settings.defaultInkWidth * 2}
              strokeLinecap="round"
              strokeLinejoin="round"
              points={draftInk.map((p) => `${p.x * 1000},${p.y * 1000}`).join(' ')}
            />
          </svg>
        )}

        {/* Live Watermark Preview */}
        {tab.watermark.enabled && tab.watermark.text && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none',
              overflow: 'hidden',
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 800,
                fontSize: `${tab.watermark.fontSizePt * tab.zoom}px`,
                color: tab.watermark.color,
                opacity: tab.watermark.opacity,
                transform: `rotate(${tab.watermark.rotation}deg)`,
                whiteSpace: 'nowrap',
              }}
            >
              {tab.watermark.text}
            </span>
          </div>
        )}

        {/* Live Header / Footer / Bates Preview */}
        {tab.headerFooter.enabled && (
          <>
            {(tab.headerFooter.headerLeft || tab.headerFooter.headerRight) && (
              <div
                style={{
                  position: 'absolute',
                  top: `${14 * tab.zoom}px`,
                  left: `${32 * tab.zoom}px`,
                  right: `${32 * tab.zoom}px`,
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: `${tab.headerFooter.fontSizePt * tab.zoom}px`,
                  color: tab.headerFooter.color,
                  pointerEvents: 'none',
                }}
              >
                <span>{tab.headerFooter.headerLeft}</span>
                <span>{tab.headerFooter.headerRight}</span>
              </div>
            )}
            <div
              style={{
                position: 'absolute',
                bottom: `${14 * tab.zoom}px`,
                left: 0,
                right: 0,
                textAlign: 'center',
                fontSize: `${tab.headerFooter.fontSizePt * tab.zoom}px`,
                color: tab.headerFooter.color,
                pointerEvents: 'none',
              }}
            >
              {tab.headerFooter.footerCenterPattern === 'page-of-total' &&
                `Página ${pageIndex + 1} de ${totalPages}`}
              {tab.headerFooter.footerCenterPattern === 'number-only' && `${pageIndex + 1}`}
              {tab.headerFooter.footerCenterPattern === 'bates' &&
                `${tab.headerFooter.batesPrefix}${String(
                  tab.headerFooter.batesStart + pageIndex
                ).padStart(5, '0')}`}
              {tab.headerFooter.footerCenterPattern === 'custom' &&
                tab.headerFooter.customFooter
                  .replace(/\{page\}/g, String(pageIndex + 1))
                  .replace(/\{total\}/g, String(totalPages))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export const PdfCanvasStage: React.FC<PdfCanvasStageProps> = (props) => {
  const { tab, compareTab, workspaceMode, onChangeZoom } = props;
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const lastScrolledPageRef = useRef<number>(tab.currentPageIndex);
  const isEditableMode = workspaceMode === 'edit';

  // Scroll into view when currentPageIndex changes via toolbar/sidebar
  useEffect(() => {
    const container = scrollRef.current;
    if (!container || tab.viewLayout === 'single') return;
    if (lastScrolledPageRef.current === tab.currentPageIndex) return;
    lastScrolledPageRef.current = tab.currentPageIndex;

    const pageNode = container.querySelector(
      `[data-page-index="${tab.currentPageIndex}"]`
    ) as HTMLElement | null;
    if (pageNode) {
      const cRect = container.getBoundingClientRect();
      const pRect = pageNode.getBoundingClientRect();
      if (pRect.top < cRect.top - 40 || pRect.top > cRect.bottom - 80) {
        pageNode.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }, [tab.currentPageIndex, tab.viewLayout]);

  // Ctrl + MouseWheel Smooth Zoom
  useEffect(() => {
    const container = scrollRef.current;
    if (!container || !onChangeZoom) return;

    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.08 : -0.08;
      const next = Math.max(0.4, Math.min(3.0, Math.round((tab.zoom + delta) * 100) / 100));
      if (next !== tab.zoom) {
        onChangeZoom(next);
      }
    };

    container.addEventListener('wheel', onWheel, { passive: false });
    return () => container.removeEventListener('wheel', onWheel);
  }, [tab.zoom, onChangeZoom]);

  const handleViewportScroll = () => {
    const container = scrollRef.current;
    if (!container || tab.viewLayout === 'single') return;
    const cRect = container.getBoundingClientRect();
    const midY = cRect.top + cRect.height * 0.35;
    const nodes = container.querySelectorAll('[data-page-index]');
    let bestIdx = tab.currentPageIndex;
    let bestDist = Infinity;

    nodes.forEach((node) => {
      const idx = Number(node.getAttribute('data-page-index'));
      if (Number.isNaN(idx)) return;
      const r = node.getBoundingClientRect();
      if (r.top <= midY && r.bottom >= midY) {
        bestIdx = idx;
        bestDist = 0;
      } else {
        const dist = Math.min(Math.abs(r.top - midY), Math.abs(r.bottom - midY));
        if (dist < bestDist) {
          bestDist = dist;
          bestIdx = idx;
        }
      }
    });

    if (bestIdx !== tab.currentPageIndex) {
      lastScrolledPageRef.current = bestIdx;
      props.onCurrentPageVisible(bestIdx);
    }
  };

  const handleViewportPanStart = (e: React.MouseEvent<HTMLDivElement>) => {
    if (props.activeTool !== 'pan' && e.button !== 1) return;
    const container = scrollRef.current;
    if (!container) return;
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const origLeft = container.scrollLeft;
    const origTop = container.scrollTop;
    container.style.cursor = 'grabbing';

    const onMove = (ev: MouseEvent) => {
      container.scrollLeft = origLeft - (ev.clientX - startX);
      container.scrollTop = origTop - (ev.clientY - startY);
    };
    const onUp = () => {
      container.style.cursor = '';
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const visiblePages =
    tab.viewLayout === 'single'
      ? tab.pages
          .map((p, idx) => ({ pageDesc: p, idx }))
          .filter((entry) => entry.idx === tab.currentPageIndex)
      : tab.pages.map((p, idx) => ({ pageDesc: p, idx }));

  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        minHeight: 0,
        display: 'flex',
        overflow: 'hidden',
      }}
    >
      <div
        ref={scrollRef}
        className={`canvas-viewport ${tab.viewLayout === 'dual' ? 'dual-grid' : ''}`}
        style={props.activeTool === 'pan' ? { cursor: 'grab' } : undefined}
        onScroll={handleViewportScroll}
        onMouseDown={handleViewportPanStart}
      >
        {visiblePages.map(({ pageDesc, idx }) => (
          <InteractivePageCard
            key={pageDesc.id}
            tab={tab}
            pageDesc={pageDesc}
            pageIndex={idx}
            totalPages={tab.pages.length}
            isEditableMode={isEditableMode}
            activeTool={props.activeTool}
            settings={props.settings}
            customFonts={props.customFonts}
            onUploadCustomFontForTarget={props.onUploadCustomFontForTarget}
            selectedElementId={props.selectedElementId}
            selectedNativeTextId={props.selectedNativeTextId}
            onSelectElement={props.onSelectElement}
            onSelectNativeText={props.onSelectNativeText}
            onCacheExtractedPageTexts={props.onCacheExtractedPageTexts}
            onUpdateNativeTextItem={props.onUpdateNativeTextItem}
            onResetNativeTextItem={props.onResetNativeTextItem}
            onAddOverlayElement={props.onAddOverlayElement}
            onIncrementCalloutNumber={props.onIncrementCalloutNumber}
            onUpdateOverlayElement={props.onUpdateOverlayElement}
            onDuplicateOverlayElement={props.onDuplicateOverlayElement}
            onReorderElementLayer={props.onReorderElementLayer}
            onDeleteOverlayElement={props.onDeleteOverlayElement}
            onSwitchToSelectTool={props.onSwitchToSelectTool}
            onActivateEditPdfText={props.onActivateEditPdfText}
          />
        ))}
      </div>

      {/* Optional Split-Screen Secondary Document Compare View */}
      {compareTab && (
        <div
          className="canvas-viewport"
          style={{ borderLeft: '2px solid var(--border-strong)' }}
        >
          <div
            style={{
              fontSize: 11.5,
              fontWeight: 700,
              color: 'var(--accent)',
              background: 'var(--bg-surface)',
              padding: '4px 12px',
              borderRadius: 99,
              border: '1px solid var(--border-subtle)',
            }}
          >
            Comparando con: {compareTab.fileName}
          </div>
          {compareTab.pages.map((pd, idx) => (
            <InteractivePageCard
              key={`cmp_${pd.id}`}
              tab={compareTab}
              pageDesc={pd}
              pageIndex={idx}
              totalPages={compareTab.pages.length}
              isEditableMode={false}
              activeTool="select"
              settings={props.settings}
              selectedElementId={null}
              selectedNativeTextId={null}
              onSelectElement={() => {}}
              onSelectNativeText={() => {}}
              onCacheExtractedPageTexts={() => {}}
              onUpdateNativeTextItem={() => {}}
              onResetNativeTextItem={() => {}}
              onAddOverlayElement={() => {}}
              onIncrementCalloutNumber={() => {}}
              onUpdateOverlayElement={() => {}}
              onDuplicateOverlayElement={() => {}}
              onReorderElementLayer={() => {}}
              onDeleteOverlayElement={() => {}}
              onSwitchToSelectTool={() => {}}
            />
          ))}
        </div>
      )}
    </div>
  );
};
