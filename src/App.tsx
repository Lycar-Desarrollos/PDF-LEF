import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import type {
  ActiveTool,
  AppSettings,
  DocumentHistorySnapshot,
  DocumentMetadata,
  HeaderFooterConfig,
  NativePdfTextItem,
  PageDescriptor,
  PaperFilter,
  PdfOverlayElement,
  PdfTabDocument,
  RecentFileEntry,
  SavedLogo,
  SavedSignature,
  ToolModalKind,
  ViewLayout,
  WatermarkConfig,
  WorkspaceMode,
} from './types/pdf';
import {
  applySettingsToDom,
  clearRecentFiles,
  loadRecentFiles,
  loadSavedLogos,
  loadSavedSignatures,
  loadSettings,
  recordRecentFile,
  saveLogosList,
  saveSettings,
  saveSignaturesList,
  togglePinRecentFile,
} from './utils/storage';
import {
  checkStartupOpenedPdfFromWindows,
  openPdfFilesWithDialog,
  registerDefaultPdfApp,
  savePdfBytesToDisk,
} from './utils/tauriBridge';
import {
  createBlankPdfBytes,
  generateShowcaseSamplePdf,
  getPdfJsProxy,
  loadPdfIntoTabDocument,
} from './utils/pdfEngine';
import {
  compileTabToPdfBytes,
  extractSelectedPagesAsPdf,
} from './utils/pdfExporter';
import {
  convertImagesToPdfBytes,
  fileToDataUrl,
  getImageDimensions,
} from './utils/imageUtils';
import { TitleBar } from './components/TitleBar';
import { RibbonToolbar } from './components/RibbonToolbar';
import { HomeHub } from './components/HomeHub';
import { LeftSidebar } from './components/LeftSidebar';
import { PdfCanvasStage } from './components/PdfCanvasStage';
import { ObjectInspector } from './components/ObjectInspector';
import { PageOrganizer } from './components/PageOrganizer';
import { SignatureModal } from './components/SignatureModal';
import { ToolsModal } from './components/ToolsModal';
import { SettingsModal } from './components/SettingsModal';
import { CommandPalette, type CommandActionItem } from './components/CommandPalette';

function createSnapshot(tab: PdfTabDocument): DocumentHistorySnapshot {
  return {
    pages: tab.pages.map((p) => ({ ...p, crop: p.crop ? { ...p.crop } : undefined })),
    elements: tab.elements.map((el) => ({
      ...el,
      points: el.points ? el.points.map((pt) => ({ ...pt })) : undefined,
    })),
    nativeTextEdits: Object.fromEntries(
      Object.entries(tab.nativeTextEdits).map(([k, v]) => [k, { ...v }])
    ),
    watermark: { ...tab.watermark },
    headerFooter: { ...tab.headerFooter },
  };
}

export const App: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());
  const [tabs, setTabs] = useState<PdfTabDocument[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [splitCompareTabId, setSplitCompareTabId] = useState<string | null>(null);
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>('home');
  const [activeTool, setActiveTool] = useState<ActiveTool>('select');
  const [leftPanel, setLeftPanel] = useState<
    'thumbnails' | 'outline' | 'search' | 'layers' | 'closed'
  >(() => loadSettings().defaultLeftPanel);

  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [selectedNativeTextId, setSelectedNativeTextId] = useState<string | null>(null);

  const [savedSignatures, setSavedSignatures] = useState<SavedSignature[]>(() =>
    loadSavedSignatures()
  );
  const [savedLogos, setSavedLogos] = useState<SavedLogo[]>(() => loadSavedLogos());
  const [recentFiles, setRecentFiles] = useState<RecentFileEntry[]>(() =>
    loadRecentFiles()
  );

  // Modals
  const [signatureModalOpen, setSignatureModalOpen] = useState(false);
  const [toolModal, setToolModal] = useState<ToolModalKind>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [cmdPaletteOpen, setCmdPaletteOpen] = useState(false);
  const [toasts, setToasts] = useState<Array<{ id: string; text: string }>>([]);

  // Hidden image input for inserting or replacing an image on the active page
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const replaceTargetIdRef = useRef<string | null>(null);

  const notify = useCallback((text: string) => {
    const id = `t_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev, { id, text }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== id));
    }, 3400);
  }, []);

  useEffect(() => {
    applySettingsToDom(settings);
  }, [settings]);

  const handleUpdateSettings = useCallback((next: AppSettings) => {
    setSettings(next);
    saveSettings(next);
  }, []);

  const activeTab = useMemo(
    () => tabs.find((t) => t.id === activeTabId) || null,
    [tabs, activeTabId]
  );

  const compareTab = useMemo(
    () =>
      splitCompareTabId
        ? tabs.find((t) => t.id === splitCompareTabId && t.id !== activeTabId) || null
        : null,
    [tabs, splitCompareTabId, activeTabId]
  );

  const openBytesAsNewTab = useCallback(
    async (
      fileName: string,
      bytes: Uint8Array,
      filePath?: string,
      initialMode: WorkspaceMode = 'edit',
      initialPage = 0
    ) => {
      try {
        const doc = await loadPdfIntoTabDocument(fileName, bytes, settings, filePath);
        doc.currentPageIndex = Math.max(0, Math.min(doc.pages.length - 1, initialPage));
        setTabs((prev) => [...prev, doc]);
        setActiveTabId(doc.id);
        setWorkspaceMode(initialMode);
        setSelectedElementId(null);
        setSelectedNativeTextId(null);
        const updatedRecents = recordRecentFile({
          fileName,
          filePath,
          fileSize: bytes.byteLength,
          pageCount: doc.pages.length,
        });
        setRecentFiles(updatedRecents);
      } catch {
        notify(`No se pudo abrir "${fileName}". Verifica que sea un PDF válido.`);
      }
    },
    [settings, notify]
  );

  // Check if launched via double-clicking a .pdf file in Windows Explorer
  useEffect(() => {
    checkStartupOpenedPdfFromWindows().then((payload) => {
      if (payload) {
        openBytesAsNewTab(payload.fileName, payload.bytes, payload.filePath, 'reader');
      }
    });
  }, [openBytesAsNewTab]);

  const mutateActiveTab = useCallback(
    (
      updater: (tab: PdfTabDocument) => PdfTabDocument,
      recordUndo = false
    ) => {
      if (!activeTabId) return;
      setTabs((prev) =>
        prev.map((tab) => {
          if (tab.id !== activeTabId) return tab;
          const undoStack = recordUndo
            ? [...tab.undoStack.slice(-29), createSnapshot(tab)]
            : tab.undoStack;
          const updated = updater({
            ...tab,
            undoStack,
            redoStack: recordUndo ? [] : tab.redoStack,
          });
          return updated;
        })
      );
    },
    [activeTabId]
  );

  const handleUndo = useCallback(() => {
    if (!activeTab || activeTab.undoStack.length === 0) return;
    const prevSnap = activeTab.undoStack[activeTab.undoStack.length - 1];
    const currentSnap = createSnapshot(activeTab);
    mutateActiveTab((tab) => ({
      ...tab,
      pages: prevSnap.pages,
      elements: prevSnap.elements,
      nativeTextEdits: prevSnap.nativeTextEdits,
      watermark: prevSnap.watermark,
      headerFooter: prevSnap.headerFooter,
      currentPageIndex: Math.min(tab.currentPageIndex, prevSnap.pages.length - 1),
      undoStack: tab.undoStack.slice(0, -1),
      redoStack: [...tab.redoStack, currentSnap],
      isModified: true,
    }));
  }, [activeTab, mutateActiveTab]);

  const handleRedo = useCallback(() => {
    if (!activeTab || activeTab.redoStack.length === 0) return;
    const nextSnap = activeTab.redoStack[activeTab.redoStack.length - 1];
    const currentSnap = createSnapshot(activeTab);
    mutateActiveTab((tab) => ({
      ...tab,
      pages: nextSnap.pages,
      elements: nextSnap.elements,
      nativeTextEdits: nextSnap.nativeTextEdits,
      watermark: nextSnap.watermark,
      headerFooter: nextSnap.headerFooter,
      currentPageIndex: Math.min(tab.currentPageIndex, nextSnap.pages.length - 1),
      undoStack: [...tab.undoStack, currentSnap],
      redoStack: tab.redoStack.slice(0, -1),
      isModified: true,
    }));
  }, [activeTab, mutateActiveTab]);

  const handleOpenPdfDialog = useCallback(async () => {
    const picked = await openPdfFilesWithDialog(true);
    for (const item of picked) {
      await openBytesAsNewTab(item.fileName, item.bytes, item.filePath, 'edit');
    }
  }, [openBytesAsNewTab]);

  const handleDropFilesOnHome = useCallback(
    async (files: File[]) => {
      const pdfs = files.filter(
        (f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
      );
      const imgs = files.filter((f) => f.type.startsWith('image/'));

      for (const pdf of pdfs) {
        const buf = await pdf.arrayBuffer();
        await openBytesAsNewTab(pdf.name, new Uint8Array(buf), undefined, 'edit');
      }
      if (imgs.length > 0) {
        const converted = await convertImagesToPdfBytes(imgs, 'a4', 28);
        await openBytesAsNewTab('Imagenes_Importadas.pdf', converted, undefined, 'edit');
        notify(`${imgs.length} imagen(es) convertidas a PDF automáticamente.`);
      }
    },
    [openBytesAsNewTab, notify]
  );

  const handleLoadShowcaseDemo = useCallback(async () => {
    const demoBytes = await generateShowcaseSamplePdf();
    await openBytesAsNewTab(
      'Acuerdo_Ejecutivo_PDF_LEF.pdf',
      demoBytes,
      undefined,
      'edit',
      0
    );
    setActiveTool('edit-pdf-text');
    notify(
      'Haz clic en cualquier texto de la hoja para editarlo o arrástralo con alineación magnética.'
    );
  }, [openBytesAsNewTab, notify]);

  const handleLoadSamplePdf = useCallback(
    async (sampleName: string) => {
      try {
        const response = await fetch(`/pruebas/${sampleName}`);
        if (!response.ok) throw new Error('Archivo no encontrado');
        const buf = await response.arrayBuffer();
        await openBytesAsNewTab(sampleName, new Uint8Array(buf), undefined, 'edit', 0);
        setActiveTool('edit-pdf-text');
        notify(`Documento cargado: ${sampleName}. Clic en cualquier texto para editarlo.`);
      } catch {
        notify(`Error al cargar el archivo de prueba ${sampleName}`);
      }
    },
    [openBytesAsNewTab, notify]
  );

  const handleSetDefaultWindowsApp = useCallback(async () => {
    const res = await registerDefaultPdfApp();
    notify(res.message);
  }, [notify]);

  const handleCreateBlankPdf = useCallback(async () => {
    const blankBytes = await createBlankPdfBytes();
    await openBytesAsNewTab('Nuevo_Documento_LEF.pdf', blankBytes, undefined, 'edit');
    setActiveTool('add-text');
  }, [openBytesAsNewTab]);

  const handleSaveExportPdf = useCallback(async () => {
    if (!activeTab) return;
    try {
      const outBytes = await compileTabToPdfBytes(activeTab, {
        cleanMetadata: settings.autoCleanMetadataOnExport,
      });
      const res = await savePdfBytesToDisk(outBytes, activeTab.fileName);
      if (res.saved) {
        mutateActiveTab((t) => ({
          ...t,
          fileName: res.fileName,
          filePath: res.filePath || t.filePath,
          isModified: false,
        }));
        notify(`Guardado correctamente: ${res.fileName}`);
      }
    } catch {
      notify('Ocurrió un problema al compilar el PDF.');
    }
  }, [activeTab, settings.autoCleanMetadataOnExport, mutateActiveTab, notify]);

  const handlePrintActiveTab = useCallback(async () => {
    if (!activeTab) return;
    try {
      const outBytes = await compileTabToPdfBytes(activeTab);
      const copy = new Uint8Array(outBytes.byteLength);
      copy.set(outBytes);
      const blob = new Blob([copy.buffer], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const win = window.open(url, '_blank');
      if (win) {
        win.addEventListener('load', () => win.print());
      } else {
        window.print();
      }
    } catch {
      window.print();
    }
  }, [activeTab]);

  // Helper to insert any image DataURL onto the active page
  const insertImageDataUrlOnActivePage = useCallback(
    async (dataUrl: string, label: string, defaultWidthNorm = 0.28) => {
      if (!activeTab) return;
      const curPage = activeTab.pages[activeTab.currentPageIndex];
      if (!curPage) return;
      const dims = await getImageDimensions(dataUrl);
      const aspect = dims.width / Math.max(1, dims.height);
      const w = defaultWidthNorm;
      const h = Math.min(0.48, (w / aspect) * (curPage.widthPt / Math.max(1, curPage.heightPt)));
      const newId = `img_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;

      const newImgEl: PdfOverlayElement = {
        id: newId,
        pageId: curPage.id,
        kind: 'image',
        x: defaultWidthNorm < 0.22 ? 0.08 : 0.34,
        y: defaultWidthNorm < 0.22 ? 0.05 : 0.26,
        width: w,
        height: h,
        rotation: 0,
        opacity: 1,
        zIndex: activeTab.elements.length + 1,
        dataUrl,
        naturalWidth: dims.width,
        naturalHeight: dims.height,
        preserveAspect: true,
        text: label,
      };

      mutateActiveTab(
        (tab) => ({
          ...tab,
          isModified: true,
          elements: [...tab.elements, newImgEl],
        }),
        true
      );
      setWorkspaceMode('edit');
      setActiveTool('select');
      setSelectedElementId(newId);
      setSelectedNativeTextId(null);
    },
    [activeTab, mutateActiveTab]
  );

  // Image Insertion & Replacement Handler
  const handleTriggerAddImage = useCallback(() => {
    replaceTargetIdRef.current = null;
    imageInputRef.current?.click();
  }, []);

  const handleTriggerReplaceImage = useCallback((elementId: string) => {
    replaceTargetIdRef.current = elementId;
    imageInputRef.current?.click();
  }, []);

  const handleImageFilePicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !activeTab) return;

    const dataUrl = await fileToDataUrl(file);
    const dims = await getImageDimensions(dataUrl);

    if (replaceTargetIdRef.current) {
      const targetId = replaceTargetIdRef.current;
      replaceTargetIdRef.current = null;
      mutateActiveTab(
        (tab) => ({
          ...tab,
          isModified: true,
          elements: tab.elements.map((el) =>
            el.id === targetId
              ? {
                  ...el,
                  dataUrl,
                  naturalWidth: dims.width,
                  naturalHeight: dims.height,
                  text: file.name,
                }
              : el
          ),
        }),
        true
      );
      notify('Imagen actualizada.');
      return;
    }

    await insertImageDataUrlOnActivePage(dataUrl, file.name, 0.32);
    notify('Imagen insertada: arrástrala o usa las esquinas para ajustar su tamaño.');
  };

  // Clipboard Ctrl+V Image Paste directly onto active PDF page!
  useEffect(() => {
    const onPaste = async (e: ClipboardEvent) => {
      if (!activeTab || workspaceMode === 'home') return;
      const items = Array.from(e.clipboardData?.items || []);
      const imgItem = items.find((it) => it.type.startsWith('image/'));
      if (!imgItem) return;
      const blob = imgItem.getAsFile();
      if (!blob) return;
      e.preventDefault();
      const dataUrl = await fileToDataUrl(blob);
      await insertImageDataUrlOnActivePage(dataUrl, 'Captura pegada', 0.32);
      notify('Imagen del portapapeles pegada directamente en la página.');
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [activeTab, workspaceMode, insertImageDataUrlOnActivePage, notify]);

  // Place Signature, Logo, Stamp, Engineering Title Block, or Admin Received Stamp
  const handlePlaceSignatureOnPage = useCallback(
    (dataUrl: string, signerLabel: string) => {
      if (!activeTab) return;
      const curPage = activeTab.pages[activeTab.currentPageIndex];
      if (!curPage) return;
      const newId = `sig_${Date.now()}`;
      const dateStr = settings.includeDateOnSignature
        ? `${signerLabel} · ${new Date().toLocaleDateString('es-ES')}`
        : '';

      mutateActiveTab(
        (tab) => ({
          ...tab,
          isModified: true,
          elements: [
            ...tab.elements,
            {
              id: newId,
              pageId: curPage.id,
              kind: 'signature',
              x: 0.12,
              y: 0.72,
              width: 0.26,
              height: 0.085,
              rotation: 0,
              opacity: 1,
              zIndex: tab.elements.length + 1,
              dataUrl,
              preserveAspect: true,
              text: signerLabel,
              subText: dateStr,
            },
          ],
        }),
        true
      );
      setWorkspaceMode('edit');
      setActiveTool('select');
      setSelectedElementId(newId);
      notify('Firma transparente colocada en la página.');
    },
    [activeTab, settings.includeDateOnSignature, mutateActiveTab, notify]
  );

  const handlePlaceQuickStamp = useCallback(
    (presetText: string, color: string) => {
      if (!activeTab) return;
      const curPage = activeTab.pages[activeTab.currentPageIndex];
      if (!curPage) return;
      const newId = `st_${Date.now()}`;
      mutateActiveTab(
        (tab) => ({
          ...tab,
          isModified: true,
          elements: [
            ...tab.elements,
            {
              id: newId,
              pageId: curPage.id,
              kind: 'stamp',
              x: 0.62,
              y: 0.12,
              width: 0.28,
              height: 0.068,
              rotation: 0,
              opacity: 0.94,
              zIndex: tab.elements.length + 1,
              text: presetText,
              subText: settings.includeDateOnStamps
                ? `${settings.companyName} · ${new Date().toLocaleDateString('es-ES')}`
                : '',
              color,
            },
          ],
        }),
        true
      );
      setWorkspaceMode('edit');
      setActiveTool('select');
      setSelectedElementId(newId);
      notify(`Sello "${presetText}" insertado.`);
    },
    [activeTab, settings.includeDateOnStamps, settings.companyName, mutateActiveTab, notify]
  );

  const handleInsertAccountingSummaryOnPage = useCallback(
    (summaryText: string) => {
      if (!activeTab) return;
      const curPage = activeTab.pages[activeTab.currentPageIndex];
      if (!curPage) return;
      const newId = `acc_${Date.now()}`;
      mutateActiveTab(
        (tab) => ({
          ...tab,
          isModified: true,
          elements: [
            ...tab.elements,
            {
              id: newId,
              pageId: curPage.id,
              kind: 'text',
              x: 0.5,
              y: 0.68,
              width: 0.43,
              height: 0.16,
              rotation: 0,
              opacity: 0.98,
              zIndex: tab.elements.length + 1,
              text: summaryText,
              fontFamily: 'mono',
              fontSizePt: 8.5,
              fontWeight: 'bold',
              fontStyle: 'normal',
              textAlign: 'left',
              color: '#0D7A5F',
              backgroundColor: '#F0FDF4',
              borderColor: '#0D7A5F',
            },
          ],
        }),
        true
      );
      setWorkspaceMode('edit');
      setActiveTool('select');
      setSelectedElementId(newId);
      notify('Cédula Contable de IVA insertada en el PDF.');
    },
    [activeTab, mutateActiveTab, notify]
  );

  // Overlay & Native Text CRUD
  const handleDuplicateOverlayElement = useCallback(
    (id: string) => {
      if (!activeTab) return;
      const orig = activeTab.elements.find((e) => e.id === id);
      if (!orig) return;
      const copyId = `el_${Date.now()}`;
      const cloned: PdfOverlayElement = {
        ...orig,
        id: copyId,
        x: Math.min(0.92, orig.x + 0.025),
        y: Math.min(0.92, orig.y + 0.025),
        zIndex: activeTab.elements.length + 1,
      };
      mutateActiveTab(
        (t) => ({ ...t, isModified: true, elements: [...t.elements, cloned] }),
        true
      );
      setSelectedElementId(copyId);
    },
    [activeTab, mutateActiveTab]
  );

  const handleDeleteOverlayElement = useCallback(
    (id: string) => {
      mutateActiveTab(
        (t) => ({
          ...t,
          isModified: true,
          elements: t.elements.filter((el) => el.id !== id),
        }),
        true
      );
      if (selectedElementId === id) setSelectedElementId(null);
    },
    [mutateActiveTab, selectedElementId]
  );

  // Page Organizer Operations
  const handleAppendExternalPdfToActiveTab = useCallback(async () => {
    if (!activeTab) return;
    const picked = await openPdfFilesWithDialog(true);
    if (picked.length === 0) return;

    const newBuffers: Record<string, Uint8Array> = {};
    const appendedPages: PageDescriptor[] = [];

    for (const item of picked) {
      const srcId = `src_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      newBuffers[srcId] = item.bytes;
      const proxy = await getPdfJsProxy(srcId, item.bytes);
      for (let i = 0; i < proxy.numPages; i++) {
        const p = await proxy.getPage(i + 1);
        const vp = p.getViewport({ scale: 1 });
        appendedPages.push({
          id: `page_${srcId}_${i}`,
          sourceId: srcId,
          sourcePageIndex: i,
          rotation: 0,
          widthPt: vp.width,
          heightPt: vp.height,
        });
      }
    }

    mutateActiveTab(
      (t) => ({
        ...t,
        isModified: true,
        sourceBuffers: { ...t.sourceBuffers, ...newBuffers },
        pages: [...t.pages, ...appendedPages],
      }),
      true
    );
    notify(`Se anexaron ${appendedPages.length} página(s) al documento.`);
  }, [activeTab, mutateActiveTab, notify]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      const isTyping = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCmdPaletteOpen((v) => !v);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === ',') {
        e.preventDefault();
        setSettingsOpen((v) => !v);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        handleOpenPdfDialog();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSaveExportPdf();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f' && activeTab) {
        e.preventDefault();
        setLeftPanel('search');
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p' && activeTab) {
        e.preventDefault();
        handlePrintActiveTab();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+') && activeTab) {
        e.preventDefault();
        mutateActiveTab((t) => ({
          ...t,
          zoom: Math.min(3.0, Math.round((t.zoom + 0.1) * 100) / 100),
        }));
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === '-' && activeTab) {
        e.preventDefault();
        mutateActiveTab((t) => ({
          ...t,
          zoom: Math.max(0.4, Math.round((t.zoom - 0.1) * 100) / 100),
        }));
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === '0' && activeTab) {
        e.preventDefault();
        mutateActiveTab((t) => ({ ...t, zoom: 1.0 }));
        return;
      }

      if (isTyping) return;

      if (
        ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) &&
        activeTab &&
        (selectedElementId || selectedNativeTextId)
      ) {
        e.preventDefault();
        const step = e.shiftKey ? 0.008 : 0.0016;
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;

        if (selectedElementId) {
          mutateActiveTab(
            (t) => ({
              ...t,
              isModified: true,
              elements: t.elements.map((el) =>
                el.id === selectedElementId
                  ? {
                      ...el,
                      x: Math.max(0, Math.min(1 - el.width, el.x + dx)),
                      y: Math.max(0, Math.min(1 - el.height, el.y + dy)),
                    }
                  : el
              ),
            }),
            true
          );
        } else if (selectedNativeTextId) {
          mutateActiveTab((t) => {
            let base = t.nativeTextEdits[selectedNativeTextId];
            if (!base) {
              for (const list of Object.values(t.extractedPageTexts)) {
                const found = list.find((it) => it.id === selectedNativeTextId);
                if (found) {
                  base = found;
                  break;
                }
              }
            }
            if (!base) return t;
            const moved: NativePdfTextItem = {
              ...base,
              x: Math.max(0.02, Math.min(0.95 - Math.min(0.5, base.width), base.x + dx)),
              y: Math.max(0.02, Math.min(0.97 - base.height, base.y + dy)),
              modified: true,
            };
            return {
              ...t,
              isModified: true,
              nativeTextEdits: { ...t.nativeTextEdits, [moved.id]: moved },
            };
          }, true);
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      } else if (
        (e.ctrlKey || e.metaKey) &&
        e.key.toLowerCase() === 'd' &&
        selectedElementId
      ) {
        e.preventDefault();
        handleDuplicateOverlayElement(selectedElementId);
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedElementId) {
        e.preventDefault();
        handleDeleteOverlayElement(selectedElementId);
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedNativeTextId) {
        e.preventDefault();
        mutateActiveTab((t) => {
          let base = t.nativeTextEdits[selectedNativeTextId];
          if (!base) {
            for (const list of Object.values(t.extractedPageTexts)) {
              const found = list.find((it) => it.id === selectedNativeTextId);
              if (found) {
                base = found;
                break;
              }
            }
          }
          if (!base) return t;
          const deletedItem: NativePdfTextItem = {
            ...base,
            deleted: true,
            modified: true,
          };
          return {
            ...t,
            isModified: true,
            nativeTextEdits: { ...t.nativeTextEdits, [deletedItem.id]: deletedItem },
          };
        }, true);
        setSelectedNativeTextId(null);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    activeTab,
    selectedElementId,
    selectedNativeTextId,
    mutateActiveTab,
    handleOpenPdfDialog,
    handleSaveExportPdf,
    handlePrintActiveTab,
    handleUndo,
    handleRedo,
    handleDuplicateOverlayElement,
    handleDeleteOverlayElement,
  ]);

  // Command Palette Actions
  const commandActions = useMemo<CommandActionItem[]>(
    () => [
      {
        id: 'open-pdf',
        category: 'Archivo',
        label: 'Abrir archivo PDF local…',
        shortcut: 'Ctrl+O',
        run: handleOpenPdfDialog,
      },
      {
        id: 'demo-pdf',
        category: 'Inicio',
        label: 'Abrir Documento Ejemplo Editable',
        run: handleLoadShowcaseDemo,
      },
      {
        id: 'default-windows-app',
        category: 'Windows',
        label: 'Establecer PDF-LEF como App Predeterminada de PDF en Windows',
        run: handleSetDefaultWindowsApp,
      },
      {
        id: 'edit-native-text',
        category: 'Edición',
        label: 'Editar o Mover Textos Existentes del PDF',
        run: () => {
          if (activeTab) {
            setWorkspaceMode('edit');
            setActiveTool('edit-pdf-text');
          } else {
            handleLoadShowcaseDemo();
          }
        },
      },
      {
        id: 'insert-image',
        category: 'Imágenes',
        label: 'Subir Imagen o Fotografía Limpia en la Página',
        run: () => {
          if (activeTab) handleTriggerAddImage();
          else notify('Abre primero un PDF para insertar una imagen.');
        },
      },
      {
        id: 'logo-vault',
        category: 'Logos',
        label: 'Abrir Mis Logos Guardados',
        run: () => setToolModal('logos'),
      },
      {
        id: 'sign-doc',
        category: 'Firmas',
        label: 'Dibujar o Insertar Firma Transparente',
        run: () => {
          if (activeTab) setSignatureModalOpen(true);
          else notify('Abre primero un PDF para colocar tu firma.');
        },
      },
      {
        id: 'export-csv',
        category: 'Exportar',
        label: 'Extraer Tablas del PDF a Excel (.csv)',
        run: () => setToolModal('export-csv'),
      },
      {
        id: 'organize-pages',
        category: 'Páginas',
        label: 'Organizar Páginas (Reordenar, rotar y extraer)',
        run: () => {
          if (activeTab) setWorkspaceMode('organize');
        },
      },
      {
        id: 'merge-pdfs',
        category: 'Herramientas',
        label: 'Unir varios archivos PDF…',
        run: () => setToolModal('merge'),
      },
      {
        id: 'save-pdf',
        category: 'Archivo',
        label: 'Guardar / Exportar PDF Final',
        shortcut: 'Ctrl+S',
        run: handleSaveExportPdf,
      },
      {
        id: 'toggle-theme',
        category: 'Estilo',
        label: 'Alternar Modo Claro / Modo Oscuro',
        run: () =>
          handleUpdateSettings({
            ...settings,
            theme: settings.theme === 'dark' ? 'light' : 'dark',
          }),
      },
      {
        id: 'open-settings',
        category: 'Ajustes',
        label: 'Abrir Configuración y Preferencias',
        shortcut: 'Ctrl+,',
        run: () => setSettingsOpen(true),
      },
    ],
    [
      activeTab,
      settings,
      handleOpenPdfDialog,
      handleLoadShowcaseDemo,
      handleSetDefaultWindowsApp,
      handleTriggerAddImage,
      handleSaveExportPdf,
      handleUpdateSettings,
      notify,
    ]
  );

  const selectedElement = useMemo(
    () => activeTab?.elements.find((e) => e.id === selectedElementId) || null,
    [activeTab, selectedElementId]
  );

  const selectedNativeText = useMemo(() => {
    if (!activeTab || !selectedNativeTextId) return null;
    if (activeTab.nativeTextEdits[selectedNativeTextId]) {
      return activeTab.nativeTextEdits[selectedNativeTextId];
    }
    for (const list of Object.values(activeTab.extractedPageTexts)) {
      const found = list.find((item) => item.id === selectedNativeTextId);
      if (found) return found;
    }
    return null;
  }, [activeTab, selectedNativeTextId]);

  return (
    <div className="app-shell">
      {/* Hidden Image Picker */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleImageFilePicked}
      />

      {/* Native Windows 11 TitleBar + Multi-Tab Strip */}
      <TitleBar
        tabs={tabs}
        activeTabId={activeTabId}
        workspaceMode={workspaceMode}
        settings={settings}
        onSelectHome={() => setWorkspaceMode('home')}
        onSelectTab={(id) => {
          setActiveTabId(id);
          if (workspaceMode === 'home') setWorkspaceMode('edit');
        }}
        onCloseTab={(id, e) => {
          e.stopPropagation();
          const target = tabs.find((t) => t.id === id);
          if (
            target?.isModified &&
            settings.confirmCloseUnsaved &&
            !window.confirm(`"${target.fileName}" tiene cambios sin guardar. ¿Cerrar igualmente?`)
          ) {
            return;
          }
          const remaining = tabs.filter((t) => t.id !== id);
          setTabs(remaining);
          if (activeTabId === id) {
            if (remaining.length > 0) {
              setActiveTabId(remaining[remaining.length - 1].id);
            } else {
              setActiveTabId(null);
              setWorkspaceMode('home');
            }
          }
        }}
        onOpenNewPdf={handleOpenPdfDialog}
        onOpenCommandPalette={() => setCmdPaletteOpen(true)}
        onToggleThemeQuick={() =>
          handleUpdateSettings({
            ...settings,
            theme: settings.theme === 'dark' ? 'light' : 'dark',
          })
        }
        onOpenSettings={() => setSettingsOpen(true)}
      />

      {/* Active Workspace: Home Hub vs Studio Document View */}
      {workspaceMode === 'home' || !activeTab ? (
        <HomeHub
          recentFiles={recentFiles}
          savedLogosCount={savedLogos.length}
          onOpenPdfDialog={handleOpenPdfDialog}
          onDropFiles={handleDropFilesOnHome}
          onLoadShowcaseDemo={handleLoadShowcaseDemo}
          onLoadSamplePdf={handleLoadSamplePdf}
          onCreateBlankPdf={handleCreateBlankPdf}
          onOpenToolModal={(kind) => setToolModal(kind)}
          onOpenSignatureVault={() => {
            handleLoadShowcaseDemo().then(() => setSignatureModalOpen(true));
          }}
          onSetDefaultWindowsApp={handleSetDefaultWindowsApp}
          onTogglePinRecent={(id) => setRecentFiles(togglePinRecentFile(id))}
          onClearRecents={() => setRecentFiles(clearRecentFiles())}
        />
      ) : (
        <>
          <RibbonToolbar
            tab={activeTab}
            workspaceMode={workspaceMode}
            activeTool={activeTool}
            splitCompareTabId={splitCompareTabId}
            availableTabsCount={tabs.length}
            onChangeMode={(m) => {
              setWorkspaceMode(m);
              if (m === 'edit' && activeTool === 'pan') setActiveTool('select');
            }}
            onSelectTool={(tool) => {
              setActiveTool(tool);
              if (tool === 'edit-pdf-text') {
                setSelectedElementId(null);
              } else {
                setSelectedNativeTextId(null);
              }
            }}
            onTriggerAddImage={handleTriggerAddImage}
            onOpenLogoVault={() => setToolModal('logos')}
            onOpenSignatureVault={() => setSignatureModalOpen(true)}
            onPlaceQuickStamp={handlePlaceQuickStamp}
            onUndo={handleUndo}
            onRedo={handleRedo}
            onNavigatePage={(idx) =>
              mutateActiveTab((t) => ({
                ...t,
                currentPageIndex: Math.max(0, Math.min(t.pages.length - 1, idx)),
              }))
            }
            onChangeZoom={(z) => mutateActiveTab((t) => ({ ...t, zoom: z }))}
            onChangeLayout={(layout: ViewLayout) =>
              mutateActiveTab((t) => ({ ...t, viewLayout: layout }))
            }
            onChangePaperFilter={(pf: PaperFilter) =>
              mutateActiveTab((t) => ({ ...t, paperFilter: pf }))
            }
            onToggleSplitCompare={() => {
              if (splitCompareTabId) {
                setSplitCompareTabId(null);
              } else {
                const other = tabs.find((t) => t.id !== activeTab.id);
                if (other) setSplitCompareTabId(other.id);
              }
            }}
            onOpenToolModal={(k) => setToolModal(k)}
            onSetDefaultWindowsApp={handleSetDefaultWindowsApp}
            onPrintDocument={handlePrintActiveTab}
            onSaveExportPdf={handleSaveExportPdf}
          />

          <div className="workspace-body">
            {workspaceMode === 'organize' ? (
              <PageOrganizer
                tab={activeTab}
                onReorderPages={(from, to) =>
                  mutateActiveTab((t) => {
                    const next = [...t.pages];
                    const [moved] = next.splice(from, 1);
                    next.splice(to, 0, moved);
                    return { ...t, isModified: true, pages: next };
                  }, true)
                }
                onRotatePages={(indices, delta) =>
                  mutateActiveTab(
                    (t) => ({
                      ...t,
                      isModified: true,
                      pages: t.pages.map((p, i) =>
                        indices.includes(i)
                          ? { ...p, rotation: (((p.rotation + delta) % 360) + 360) % 360 }
                          : p
                      ),
                    }),
                    true
                  )
                }
                onDuplicatePages={(indices) =>
                  mutateActiveTab((t) => {
                    const next: PageDescriptor[] = [];
                    t.pages.forEach((p, i) => {
                      next.push(p);
                      if (indices.includes(i)) {
                        next.push({
                          ...p,
                          id: `page_dup_${Date.now()}_${i}`,
                        });
                      }
                    });
                    return { ...t, isModified: true, pages: next };
                  }, true)
                }
                onDeletePages={(indices) =>
                  mutateActiveTab((t) => {
                    const filtered = t.pages.filter((_, i) => !indices.includes(i));
                    if (filtered.length === 0) return t;
                    return {
                      ...t,
                      isModified: true,
                      pages: filtered,
                      currentPageIndex: Math.min(t.currentPageIndex, filtered.length - 1),
                    };
                  }, true)
                }
                onInsertBlankPage={(afterIdx) =>
                  mutateActiveTab((t) => {
                    const next = [...t.pages];
                    next.splice(afterIdx + 1, 0, {
                      id: `blank_${Date.now()}`,
                      sourceId: 'blank',
                      sourcePageIndex: 0,
                      rotation: 0,
                      widthPt: 595.28,
                      heightPt: 841.89,
                    });
                    return { ...t, isModified: true, pages: next };
                  }, true)
                }
                onAppendExternalPdf={handleAppendExternalPdfToActiveTab}
                onExtractPagesToNewTab={async (indices) => {
                  const bytes = await extractSelectedPagesAsPdf(activeTab, indices);
                  const base = activeTab.fileName.replace(/\.pdf$/i, '');
                  await openBytesAsNewTab(`${base}_seleccion.pdf`, bytes, undefined, 'edit');
                  notify('Páginas extraídas en una pestaña nueva.');
                }}
                onOpenPageInEditor={(idx) => {
                  mutateActiveTab((t) => ({ ...t, currentPageIndex: idx }));
                  setWorkspaceMode('edit');
                }}
              />
            ) : (
              <>
                <LeftSidebar
                  tab={activeTab}
                  openPanel={leftPanel}
                  selectedElementId={selectedElementId}
                  selectedNativeTextId={selectedNativeTextId}
                  onChangePanel={setLeftPanel}
                  onSelectPage={(idx) =>
                    mutateActiveTab((t) => ({ ...t, currentPageIndex: idx }))
                  }
                  onRotatePage={(idx) =>
                    mutateActiveTab(
                      (t) => ({
                        ...t,
                        isModified: true,
                        pages: t.pages.map((p, i) =>
                          i === idx ? { ...p, rotation: (p.rotation + 90) % 360 } : p
                        ),
                      }),
                      true
                    )
                  }
                  onDeletePage={(idx) =>
                    mutateActiveTab((t) => {
                      if (t.pages.length <= 1) return t;
                      const next = t.pages.filter((_, i) => i !== idx);
                      return {
                        ...t,
                        isModified: true,
                        pages: next,
                        currentPageIndex: Math.min(t.currentPageIndex, next.length - 1),
                      };
                    }, true)
                  }
                  onSelectOverlayElement={(id, pageIdx) => {
                    mutateActiveTab((t) => ({ ...t, currentPageIndex: pageIdx }));
                    setWorkspaceMode('edit');
                    setActiveTool('select');
                    setSelectedElementId(id);
                    setSelectedNativeTextId(null);
                  }}
                  onDeleteOverlayElement={handleDeleteOverlayElement}
                  onSelectNativeTextEdit={(id, pageIdx) => {
                    mutateActiveTab((t) => ({ ...t, currentPageIndex: pageIdx }));
                    setWorkspaceMode('edit');
                    setActiveTool('edit-pdf-text');
                    setSelectedNativeTextId(id);
                    setSelectedElementId(null);
                  }}
                  onResetNativeTextEdit={(id) =>
                    mutateActiveTab((t) => {
                      const copy = { ...t.nativeTextEdits };
                      delete copy[id];
                      return { ...t, isModified: true, nativeTextEdits: copy };
                    }, true)
                  }
                />

                <PdfCanvasStage
                  tab={activeTab}
                  compareTab={compareTab}
                  workspaceMode={workspaceMode}
                  activeTool={activeTool}
                  settings={settings}
                  selectedElementId={selectedElementId}
                  selectedNativeTextId={selectedNativeTextId}
                  onSelectElement={setSelectedElementId}
                  onSelectNativeText={setSelectedNativeTextId}
                  onCurrentPageVisible={(idx) =>
                    mutateActiveTab((t) => ({ ...t, currentPageIndex: idx }))
                  }
                  onCacheExtractedPageTexts={(pageId, items) =>
                    mutateActiveTab((t) => ({
                      ...t,
                      extractedPageTexts: { ...t.extractedPageTexts, [pageId]: items },
                    }))
                  }
                  onUpdateNativeTextItem={(item: NativePdfTextItem, pushUndo = false) =>
                    mutateActiveTab(
                      (t) => ({
                        ...t,
                        isModified: true,
                        nativeTextEdits: { ...t.nativeTextEdits, [item.id]: item },
                      }),
                      pushUndo
                    )
                  }
                  onResetNativeTextItem={(id) => {
                    mutateActiveTab((t) => {
                      const copy = { ...t.nativeTextEdits };
                      delete copy[id];
                      return { ...t, isModified: true, nativeTextEdits: copy };
                    }, true);
                    setSelectedNativeTextId(null);
                  }}
                  onAddOverlayElement={(el) =>
                    mutateActiveTab(
                      (t) => ({
                        ...t,
                        isModified: true,
                        elements: [...t.elements, el],
                      }),
                      true
                    )
                  }
                  onIncrementCalloutNumber={() =>
                    mutateActiveTab((t) => ({
                      ...t,
                      nextCalloutNumber: (t.nextCalloutNumber || 1) + 1,
                    }))
                  }
                  onUpdateOverlayElement={(id, patch, pushUndo = false) =>
                    mutateActiveTab(
                      (t) => ({
                        ...t,
                        isModified: true,
                        elements: t.elements.map((el) =>
                          el.id === id ? { ...el, ...patch } : el
                        ),
                      }),
                      pushUndo
                    )
                  }
                  onDuplicateOverlayElement={handleDuplicateOverlayElement}
                  onReorderElementLayer={(id, dir) =>
                    mutateActiveTab((t) => {
                      const maxZ = Math.max(1, ...t.elements.map((e) => e.zIndex));
                      const minZ = Math.min(0, ...t.elements.map((e) => e.zIndex));
                      return {
                        ...t,
                        isModified: true,
                        elements: t.elements.map((e) =>
                          e.id === id
                            ? { ...e, zIndex: dir === 'front' ? maxZ + 1 : minZ - 1 }
                            : e
                        ),
                      };
                    }, true)
                  }
                  onDeleteOverlayElement={handleDeleteOverlayElement}
                  onSwitchToSelectTool={() => setActiveTool('select')}
                  onChangeZoom={(z) => mutateActiveTab((t) => ({ ...t, zoom: z }))}
                />

                {workspaceMode === 'edit' && (
                  <ObjectInspector
                    tab={activeTab}
                    selectedElement={selectedElement}
                    selectedNativeText={selectedNativeText}
                    onUpdateElement={(id, patch, pushUndo = true) =>
                      mutateActiveTab(
                        (t) => ({
                          ...t,
                          isModified: true,
                          elements: t.elements.map((el) =>
                            el.id === id ? { ...el, ...patch } : el
                          ),
                        }),
                        pushUndo
                      )
                    }
                    onDuplicateElement={handleDuplicateOverlayElement}
                    onReorderLayer={(id, dir) =>
                      mutateActiveTab((t) => {
                        const maxZ = Math.max(1, ...t.elements.map((e) => e.zIndex));
                        const minZ = Math.min(0, ...t.elements.map((e) => e.zIndex));
                        return {
                          ...t,
                          isModified: true,
                          elements: t.elements.map((e) =>
                            e.id === id
                              ? { ...e, zIndex: dir === 'front' ? maxZ + 1 : minZ - 1 }
                              : e
                          ),
                        };
                      }, true)
                    }
                    onDeleteElement={handleDeleteOverlayElement}
                    onReplaceImage={handleTriggerReplaceImage}
                    onUpdateNativeText={(item, pushUndo = true) =>
                      mutateActiveTab(
                        (t) => ({
                          ...t,
                          isModified: true,
                          nativeTextEdits: { ...t.nativeTextEdits, [item.id]: item },
                        }),
                        pushUndo
                      )
                    }
                    onResetNativeText={(id) => {
                      mutateActiveTab((t) => {
                        const copy = { ...t.nativeTextEdits };
                        delete copy[id];
                        return { ...t, isModified: true, nativeTextEdits: copy };
                      }, true);
                      setSelectedNativeTextId(null);
                    }}
                    onActivatePdfTextEditTool={() => setActiveTool('edit-pdf-text')}
                    onTriggerInsertImage={handleTriggerAddImage}
                  />
                )}
              </>
            )}
          </div>
        </>
      )}

      {/* Status Bar */}
      {settings.showStatusBar && (
        <footer className="status-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {settings.strictOfflineIndicator && (
              <span className="offline-pill">
                <ShieldCheck size={13} />
                <span>100% Local Offline · Privacidad Verificada</span>
              </span>
            )}
            {activeTab && workspaceMode !== 'home' && (
              <span>
                {activeTab.fileName} · Página {activeTab.currentPageIndex + 1} de{' '}
                {activeTab.pages.length} · Zoom {Math.round(activeTab.zoom * 100)}%
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {activeTab && workspaceMode !== 'home' && (
              <span>
                {Math.round(
                  (activeTab.pages[activeTab.currentPageIndex]?.widthPt || 595) * 0.3528
                )}{' '}
                ×{' '}
                {Math.round(
                  (activeTab.pages[activeTab.currentPageIndex]?.heightPt || 842) * 0.3528
                )}{' '}
                mm
              </span>
            )}
            <span>PDF-LEF v1.0 · Edición Nativa Windows</span>
          </div>
        </footer>
      )}

      {/* Modals */}
      {signatureModalOpen && (
        <SignatureModal
          savedSignatures={savedSignatures}
          onSaveNewSignature={(sig) => {
            const next = [sig, ...savedSignatures];
            setSavedSignatures(next);
            saveSignaturesList(next);
          }}
          onDeleteSavedSignature={(id) => {
            const next = savedSignatures.filter((s) => s.id !== id);
            setSavedSignatures(next);
            saveSignaturesList(next);
          }}
          onPlaceSignatureOnPage={handlePlaceSignatureOnPage}
          onClose={() => setSignatureModalOpen(false)}
        />
      )}

      {toolModal && (
        <ToolsModal
          kind={toolModal}
          activeTab={activeTab}
          defaultExportDpi={settings.exportImageDpi}
          defaultTaxRatePct={settings.defaultTaxRatePct}
          currencySymbol={settings.currencySymbol}
          savedLogos={savedLogos}
          onSaveLogo={(logo) => {
            const next = [logo, ...savedLogos];
            setSavedLogos(next);
            saveLogosList(next);
          }}
          onDeleteLogo={(id) => {
            const next = savedLogos.filter((l) => l.id !== id);
            setSavedLogos(next);
            saveLogosList(next);
          }}
          onPlaceLogoOnPage={(logo) => {
            insertImageDataUrlOnActivePage(logo.dataUrl, logo.name, 0.19);
            notify(`Logo "${logo.name}" estampado en la página.`);
          }}
          onInsertAccountingSummaryOnPage={handleInsertAccountingSummaryOnPage}
          onOpenGeneratedPdfInTab={(name, bytes) =>
            openBytesAsNewTab(name, bytes, undefined, 'edit')
          }
          onUpdateWatermark={(wm: WatermarkConfig) =>
            mutateActiveTab((t) => ({ ...t, isModified: true, watermark: wm }), true)
          }
          onUpdateHeaderFooter={(hf: HeaderFooterConfig) =>
            mutateActiveTab((t) => ({ ...t, isModified: true, headerFooter: hf }), true)
          }
          onUpdateMetadata={(meta: DocumentMetadata) =>
            mutateActiveTab((t) => ({ ...t, isModified: true, metadata: meta }))
          }
          onNotify={notify}
          onClose={() => setToolModal(null)}
        />
      )}

      {settingsOpen && (
        <SettingsModal
          settings={settings}
          onChangeSettings={handleUpdateSettings}
          onNotify={notify}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {cmdPaletteOpen && (
        <CommandPalette
          actions={commandActions}
          onClose={() => setCmdPaletteOpen(false)}
        />
      )}

      {/* Toast Feedback */}
      {toasts.length > 0 && (
        <div className="toast-stack">
          {toasts.map((t) => (
            <div key={t.id} className="toast-item">
              <span>{t.text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default App;
