import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Copy,
  GripHorizontal,
  RotateCcw,
  Trash2,
  Wand2,
} from 'lucide-react';
import type {
  ActiveTool,
  AppSettings,
  FontFamilyChoice,
  NativePdfTextItem,
  PageDescriptor,
  PdfOverlayElement,
  PdfTabDocument,
  WorkspaceMode,
} from '../types/pdf';
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

interface PdfCanvasStageProps {
  tab: PdfTabDocument;
  compareTab: PdfTabDocument | null;
  workspaceMode: WorkspaceMode;
  activeTool: ActiveTool;
  settings: AppSettings;
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
}

function cssFontForChoice(choice?: FontFamilyChoice): string {
  if (choice === 'serif') return 'Georgia, "Times New Roman", serif';
  if (choice === 'mono') return 'var(--font-mono)';
  if (choice === 'script') return 'var(--font-script)';
  return 'var(--font-sans)';
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
}

const InteractivePageCard: React.FC<InteractivePageCardProps> = ({
  tab,
  pageDesc,
  pageIndex,
  totalPages,
  isEditableMode,
  activeTool,
  settings,
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

  // Live drawing preview state (shapes, highlights, ink, dimension lines)
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

  // Dragging an Overlay Element
  const startMoveOverlay = (e: React.MouseEvent, el: PdfOverlayElement) => {
    if (!isEditableMode || el.locked) return;
    if (editingOverlayId === el.id) return;
    e.stopPropagation();
    onSelectElement(el.id);
    onSelectNativeText(null);

    const rect = overlayRef.current?.getBoundingClientRect();
    if (!rect) return;
    const startClientX = e.clientX;
    const startClientY = e.clientY;
    const origX = el.x;
    const origY = el.y;
    const origPoints = el.points ? el.points.map((p) => ({ ...p })) : undefined;
    let moved = false;

    const onMove = (ev: MouseEvent) => {
      const dx = (ev.clientX - startClientX) / rect.width;
      const dy = (ev.clientY - startClientY) / rect.height;
      if (Math.abs(dx) > 0.001 || Math.abs(dy) > 0.001) moved = true;

      let nextX = Math.max(0, Math.min(1 - el.width, origX + dx));
      let nextY = Math.max(0, Math.min(1 - el.height, origY + dy));

      if (settings.snapGuides) {
        const centerX = nextX + el.width / 2;
        const centerY = nextY + el.height / 2;
        if (Math.abs(centerX - 0.5) < 0.012) {
          nextX = 0.5 - el.width / 2;
          setSnapV(0.5);
        } else {
          setSnapV(null);
        }
        if (Math.abs(centerY - 0.5) < 0.012) {
          nextY = 0.5 - el.height / 2;
          setSnapH(0.5);
        } else {
          setSnapH(null);
        }
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
      onUpdateOverlayElement(el.id, patch, false);
    };

    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      setSnapV(null);
      setSnapH(null);
      if (moved) {
        onUpdateOverlayElement(el.id, {}, true);
      }
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
    const ratio = ow / Math.max(0.01, oh);

    const onMove = (ev: MouseEvent) => {
      const dx = (ev.clientX - startClientX) / rect.width;
      const dy = (ev.clientY - startClientY) / rect.height;

      let nx = ox;
      let ny = oy;
      let nw = ow;
      let nh = oh;

      if (dir.includes('e')) nw = Math.max(0.025, Math.min(1 - ox, ow + dx));
      if (dir.includes('s')) nh = Math.max(0.016, Math.min(1 - oy, oh + dy));
      if (dir.includes('w')) {
        const maxLeftDelta = ow - 0.025;
        const clampedDx = Math.max(-ox, Math.min(maxLeftDelta, dx));
        nx = ox + clampedDx;
        nw = ow - clampedDx;
      }
      if (dir.includes('n')) {
        const maxTopDelta = oh - 0.016;
        const clampedDy = Math.max(-oy, Math.min(maxTopDelta, dy));
        ny = oy + clampedDy;
        nh = oh - clampedDy;
      }

      if (
        el.preserveAspect &&
        (dir === 'se' || dir === 'nw' || dir === 'ne' || dir === 'sw')
      ) {
        nh = Math.max(0.016, nw / ratio);
      }

      const patch: Partial<PdfOverlayElement> = { x: nx, y: ny, width: nw, height: nh };
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
    };

    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      onUpdateOverlayElement(el.id, {}, true);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // Dragging / Moving an Existing Native PDF Text Block!
  const startMoveNativeText = (e: React.MouseEvent, item: NativePdfTextItem) => {
    e.stopPropagation();
    onSelectNativeText(item.id);
    onSelectElement(null);

    const rect = overlayRef.current?.getBoundingClientRect();
    if (!rect) return;
    const startClientX = e.clientX;
    const startClientY = e.clientY;
    const ox = item.x;
    const oy = item.y;
    let moved = false;
    let latest = { ...item };

    const onMove = (ev: MouseEvent) => {
      const dx = (ev.clientX - startClientX) / rect.width;
      const dy = (ev.clientY - startClientY) / rect.height;
      if (Math.abs(dx) > 0.0015 || Math.abs(dy) > 0.0015) moved = true;
      if (!moved) return;

      const nx = Math.max(0, Math.min(1 - item.width, ox + dx));
      const ny = Math.max(0, Math.min(1 - item.height, oy + dy));
      latest = {
        ...latest,
        x: nx,
        y: ny,
        modified: true,
      };
      onUpdateNativeTextItem(latest, false);
    };

    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      if (moved) {
        onUpdateNativeTextItem(latest, true);
      }
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // Page Background Click / Drag-to-Create Tool Handler
  const handleStageMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
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

    // Engineering Auto-Numbered Callout Pin
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
        text: `Detalle Ing. #${num}`,
        color: '#C81E32',
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

    const boxTools: ActiveTool[] = [
      'highlight',
      'underline',
      'strikeout',
      'rect',
      'ellipse',
      'arrow',
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

  // Combine extracted native text items with edited versions
  const baseExtracted = tab.extractedPageTexts[pageDesc.id] || [];
  const mergedNativeItems: NativePdfTextItem[] =
    activeTool === 'edit-pdf-text' && isEditableMode
      ? baseExtracted.map((base) => tab.nativeTextEdits[base.id] || base)
      : Object.values(tab.nativeTextEdits).filter(
          (nt) => nt.pageId === pageDesc.id && (nt.modified || nt.deleted)
        );

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
        className="pdf-overlay-layer"
        style={{ cursor: cursorStyle }}
        onMouseDown={handleStageMouseDown}
        onDragOver={(e) => {
          if (Array.from(e.dataTransfer.types).includes('Files')) e.preventDefault();
        }}
        onDrop={handleDropImageOnPage}
      >
        {/* Smart Alignment Guides */}
        {snapV !== null && (
          <div className="snap-guide-v" style={{ left: `${snapV * 100}%` }} />
        )}
        {snapH !== null && (
          <div className="snap-guide-h" style={{ top: `${snapH * 100}%` }} />
        )}

        {/* 1. Original Position Cover Patches for Modified/Moved/Deleted Native PDF Texts */}
        {Object.values(tab.nativeTextEdits)
          .filter((nt) => nt.pageId === pageDesc.id && (nt.modified || nt.deleted))
          .map((nt) => (
            <div
              key={`patch_${nt.id}`}
              className="native-text-patch"
              style={{
                left: `calc(${nt.origX * 100}% - 2px)`,
                top: `calc(${nt.origY * 100}% - 1px)`,
                width: `calc(${nt.origWidth * 100}% + 4px)`,
                height: `calc(${nt.origHeight * 100}% + 2px)`,
                backgroundColor: nt.bgPatchColor || '#ffffff',
              }}
            />
          ))}

        {/* 2. Editable & Movable Native PDF Text Blocks */}
        {mergedNativeItems
          .filter((nt) => !nt.deleted)
          .map((nt) => {
            const isSelected = selectedNativeTextId === nt.id;
            const interactive = isEditableMode && activeTool === 'edit-pdf-text';
            const scaledFontPx = Math.max(8, nt.fontSizePt * tab.zoom);

            return (
              <div
                key={nt.id}
                className={`native-text-box ${nt.modified ? 'modified' : ''} ${
                  isSelected ? 'selected' : ''
                } ${!interactive ? 'readonly-modified' : ''}`}
                style={{
                  left: `${nt.x * 100}%`,
                  top: `${nt.y * 100}%`,
                  maxWidth: `${Math.max(5, (0.975 - nt.x) * 100)}%`,
                  minHeight: `${nt.height * 100}%`,
                }}
                onMouseDown={(e) => {
                  if (!interactive) return;
                  e.stopPropagation();
                  onSelectNativeText(nt.id);
                  onSelectElement(null);
                }}
              >
                {interactive && isSelected && (
                  <div
                    className="object-quickbar"
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      className="btn"
                      style={{ height: 24, padding: '0 7px', fontSize: 11, cursor: 'grab' }}
                      onMouseDown={(e) => startMoveNativeText(e, nt)}
                      title="Arrastra para mover con alineación magnética"
                    >
                      <GripHorizontal size={13} />
                      <span>Mover alineado</span>
                    </button>
                    {nt.modified && (
                      <button
                        type="button"
                        className="btn icon-only"
                        style={{ width: 24, height: 24 }}
                        onClick={() => onResetNativeTextItem(nt.id)}
                        title="Restaurar texto original"
                      >
                        <RotateCcw size={12} />
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn icon-only"
                      style={{ width: 24, height: 24, color: 'var(--danger)' }}
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
                  </div>
                )}

                {interactive ? (
                  <input
                    type="text"
                    className="native-text-editor"
                    value={nt.text}
                    onFocus={() => {
                      onSelectNativeText(nt.id);
                      onSelectElement(null);
                    }}
                    onMouseDown={(e) => {
                      if (!isSelected) {
                        startMoveNativeText(e, nt);
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
                      width: `${Math.min(
                        Math.max(48, (0.972 - nt.x) * boxSize.w),
                        Math.max(nt.text.length * scaledFontPx * 0.56 + 14, nt.width * boxSize.w)
                      )}px`,
                    }}
                  />
                ) : (
                  <span
                    style={{
                      fontFamily: cssFontForChoice(nt.fontFamily),
                      fontSize: `${scaledFontPx}px`,
                      fontWeight: nt.fontWeight,
                      fontStyle: nt.fontStyle,
                      color: nt.color,
                      whiteSpace: 'pre-wrap',
                      lineHeight: 1.15,
                    }}
                  >
                    {nt.text}
                  </span>
                )}
              </div>
            );
          })}

        {/* 3. Rich Movable & Resizable Overlay Elements */}
        {pageOverlays.map((el) => {
          const isSelected = isEditableMode && selectedElementId === el.id;
          const isInlineEditing = editingOverlayId === el.id;
          const fontPx = Math.max(8, (el.fontSizePt || 12) * tab.zoom);

          return (
            <div
              key={el.id}
              className={`overlay-item ${isSelected ? 'selected' : ''}`}
              style={{
                left: `${el.x * 100}%`,
                top: `${el.y * 100}%`,
                width: `${el.width * 100}%`,
                height: `${el.height * 100}%`,
                opacity: el.opacity ?? 1,
                zIndex: el.zIndex + 10,
                pointerEvents: isEditableMode ? 'auto' : 'none',
              }}
              onMouseDown={(e) => startMoveOverlay(e, el)}
              onDoubleClick={(e) => {
                e.stopPropagation();
                if (el.kind === 'text') setEditingOverlayId(el.id);
              }}
            >
              {/* Floating Quick Actions when Selected */}
              {isSelected && (
                <div
                  className="object-quickbar"
                  onMouseDown={(e) => e.stopPropagation()}
                >
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

              {/* 8 Resize Handles */}
              {isSelected &&
                (['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as ResizeHandleDir[]).map(
                  (dir) => (
                    <div
                      key={dir}
                      className={`resize-handle ${dir}`}
                      onMouseDown={(e) => startResizeOverlay(e, el, dir)}
                    />
                  )
                )}

              {/* Render Element Visual Content */}
              {el.kind === 'text' &&
                (isInlineEditing ? (
                  <textarea
                    autoFocus
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
                    border: `2.5px solid ${el.color || '#C81E32'}`,
                    borderRadius: 6,
                    backgroundColor: `${el.color || '#C81E32'}14`,
                    color: el.color || '#C81E32',
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
                      el.color || '#C81E32'
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
                      el.color || '#C81E32'
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
                      el.color || '#C81E32'
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
                      el.color || '#C81E32'
                    }`,
                  }}
                />
              )}

              {el.kind === 'arrow' && (
                <svg
                  width="100%"
                  height="100%"
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  style={{ overflow: 'visible' }}
                >
                  <line
                    x1="2"
                    y1="98"
                    x2="96"
                    y2="4"
                    stroke={el.color || '#C81E32'}
                    strokeWidth={Math.max(2, el.strokeWidth || 2.5)}
                  />
                  <polyline
                    points="78,4 97,3 96,22"
                    fill="none"
                    stroke={el.color || '#C81E32'}
                    strokeWidth={Math.max(2, el.strokeWidth || 2.5)}
                  />
                </svg>
              )}

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
                    stroke={el.color || '#C81E32'}
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
                      backgroundColor: el.color || '#C81E32',
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
                        border: `1.2px solid ${el.color || '#C81E32'}`,
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
  const { tab, compareTab, workspaceMode } = props;
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const isEditableMode = workspaceMode === 'edit';

  // Scroll into view when currentPageIndex changes via toolbar/sidebar
  useEffect(() => {
    const container = scrollRef.current;
    if (!container || tab.viewLayout === 'single') return;
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
