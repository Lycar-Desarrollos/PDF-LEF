import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download, RefreshCw, ShieldCheck, X } from 'lucide-react';
import type {
  ActiveTool,
  AppSettings,
  CustomFontEntry,
  DocumentHistorySnapshot,
  DocumentMetadata,
  FontFamilyChoice,
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
  getCustomFontsSnapshot,
  importCustomFontFile,
  loadSavedCustomFonts,
  removeCustomFont,
} from './utils/fontRegistry';
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
  isTauriDesktop,
  openPdfFilesWithDialog,
  readPdfFromLocalPath,
  registerDefaultPdfApp,
  savePdfBytesToDisk,
} from './utils/tauriBridge';
import {
  CURRENT_APP_VERSION,
  checkGlobalAppUpdate,
  triggerOneClickUpdate,
  type RemoteUpdateInfo,
} from './utils/updater';
import {
  createBlankPdfBytes,
  getPdfJsProxy,
  hasNativeTextMeaningfulDiff,
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
import { PrintModal } from './components/PrintModal';
import { CommandPalette, type CommandActionItem } from './components/CommandPalette';

function applyNativeTextEdit(t: PdfTabDocument, item: NativePdfTextItem): PdfTabDocument {
  const baseline = (t.extractedPageTexts?.[item.pageId] || []).find(
    (orig) => orig.id === item.id
  );
  if (baseline && !hasNativeTextMeaningfulDiff(item, baseline)) {
    const copy = { ...t.nativeTextEdits };
    delete copy[item.id];
    const stillModified = Object.keys(copy).length > 0 || t.elements.length > 0;
    return {
      ...t,
      isModified: stillModified,
      nativeTextEdits: copy,
    };
  }
  return {
    ...t,
    isModified: true,
    nativeTextEdits: { ...t.nativeTextEdits, [item.id]: { ...item, modified: true } },
  };
}

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
  const [inspectorOpen, setInspectorOpen] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 1020 : true
  );

  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [selectedNativeTextId, setSelectedNativeTextId] = useState<string | null>(null);

  const [savedSignatures, setSavedSignatures] = useState<SavedSignature[]>(() =>
    loadSavedSignatures()
  );
  const [savedLogos, setSavedLogos] = useState<SavedLogo[]>(() => loadSavedLogos());
  const [customFonts, setCustomFonts] = useState<CustomFontEntry[]>(() =>
    getCustomFontsSnapshot()
  );
  const [recentFiles, setRecentFiles] = useState<RecentFileEntry[]>(() =>
    loadRecentFiles()
  );

  // Modals & Global Internet Updater
  const [signatureModalOpen, setSignatureModalOpen] = useState(false);
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [toolModal, setToolModal] = useState<ToolModalKind>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [cmdPaletteOpen, setCmdPaletteOpen] = useState(false);
  const [toasts, setToasts] = useState<Array<{ id: string; text: string }>>([]);
  const [remoteUpdate, setRemoteUpdate] = useState<RemoteUpdateInfo | null>(null);
  const [updateBannerDismissed, setUpdateBannerDismissed] = useState(false);
  const [installingAutoUpdate, setInstallingAutoUpdate] = useState(false);

  // Hidden image input & internal object clipboard for cross-page Ctrl+C / Ctrl+V
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const replaceTargetIdRef = useRef<string | null>(null);
  const copiedElementRef = useRef<PdfOverlayElement | null>(null);
  const lastInternalPasteMsRef = useRef<number>(0);

  const notify = useCallback((text: string) => {
    const id = `t_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev, { id, text }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== id));
    }, 3400);
  }, []);

  useEffect(() => {
    loadSavedCustomFonts()
      .then((loaded) => setCustomFonts(loaded))
      .catch(() => {});
  }, []);

  const handleImportCustomFonts = useCallback(
    async (files: FileList, applyChoice?: (choice: FontFamilyChoice) => void) => {
      let lastAdded: CustomFontEntry | null = null;
      let importedCount = 0;
      for (const file of Array.from(files)) {
        try {
          const entry = await importCustomFontFile(file);
          lastAdded = entry;
          importedCount++;
        } catch (err) {
          notify(
            err instanceof Error
              ? err.message
              : `No se pudo cargar la fuente "${file.name}".`
          );
        }
      }
      if (importedCount > 0 && lastAdded) {
        setCustomFonts(getCustomFontsSnapshot());
        applyChoice?.(lastAdded.choice);
        notify(
          importedCount === 1
            ? `Tipografía "${lastAdded.name}" instalada y lista para usar.`
            : `${importedCount} tipografías instaladas y listas para usar.`
        );
      }
    },
    [notify]
  );

  const handleDeleteCustomFont = useCallback(
    async (idOrChoice: string) => {
      const next = await removeCustomFont(idOrChoice);
      setCustomFonts(next);
      notify('Tipografía personalizada eliminada.');
    },
    [notify]
  );

  useEffect(() => {
    applySettingsToDom(settings);
  }, [settings]);

  const hasUnsavedWorkRef = useRef(false);
  const installingUpdateRef = useRef(false);
  const lastUpdateCheckMsRef = useRef(0);

  useEffect(() => {
    hasUnsavedWorkRef.current = tabs.some((t) => t.isModified);
  }, [tabs]);

  useEffect(() => {
    installingUpdateRef.current = installingAutoUpdate;
  }, [installingAutoUpdate]);

  useEffect(() => {
    if (!settings.autoCheckUpdates) return;
    let cancelled = false;

    const checkAndPushApply = () => {
      if (cancelled || installingUpdateRef.current) return;
      lastUpdateCheckMsRef.current = Date.now();
      checkGlobalAppUpdate(CURRENT_APP_VERSION)
        .then((info) => {
          if (cancelled || installingUpdateRef.current) return;
          if (info.status === 'available' || info.announcement) {
            setRemoteUpdate(info);
            const shouldDirectApply =
              info.status === 'available' &&
              Boolean(info.downloadUrl) &&
              isTauriDesktop() &&
              !hasUnsavedWorkRef.current &&
              Boolean(info.autoInstall || settings.autoInstallUpdates);
            if (shouldDirectApply && info.downloadUrl) {
              installingUpdateRef.current = true;
              setInstallingAutoUpdate(true);
              triggerOneClickUpdate(info.downloadUrl)
                .then((res) => notify(res.message))
                .finally(() => {
                  installingUpdateRef.current = false;
                  if (!cancelled) setInstallingAutoUpdate(false);
                });
            }
          }
        })
        .catch(() => {});
    };

    const initialTimer = setTimeout(checkAndPushApply, 1200);
    // Live fleet heartbeat every 10 minutes so open PCs receive pushed updates automatically
    const heartbeatInterval = setInterval(checkAndPushApply, 10 * 60 * 1000);

    const onWindowWakeOrOnline = () => {
      if (Date.now() - lastUpdateCheckMsRef.current >= 3 * 60 * 1000) {
        checkAndPushApply();
      }
    };
    window.addEventListener('focus', onWindowWakeOrOnline);
    window.addEventListener('online', onWindowWakeOrOnline);

    return () => {
      cancelled = true;
      clearTimeout(initialTimer);
      clearInterval(heartbeatInterval);
      window.removeEventListener('focus', onWindowWakeOrOnline);
      window.removeEventListener('online', onWindowWakeOrOnline);
    };
  }, [settings.autoCheckUpdates, settings.autoInstallUpdates, notify]);

  const handleGlobalOneClickUpdate = useCallback(
    async (downloadUrl?: string) => {
      if (!downloadUrl) return;
      setInstallingAutoUpdate(true);
      try {
        const res = await triggerOneClickUpdate(downloadUrl);
        notify(res.message);
      } finally {
        setInstallingAutoUpdate(false);
      }
    },
    [notify]
  );

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
    ): Promise<PdfTabDocument | null> => {
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
        return doc;
      } catch {
        notify(`No se pudo abrir "${fileName}". Verifica que sea un PDF válido.`);
        return null;
      }
    },
    [settings, notify]
  );

  // Check if launched via double-clicking a .pdf file in Windows Explorer
  useEffect(() => {
    checkStartupOpenedPdfFromWindows().then((payload) => {
      if (payload) {
        openBytesAsNewTab(payload.fileName, payload.bytes, payload.filePath, 'edit');
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

  const handleOpenPdfForEditText = useCallback(async () => {
    const picked = await openPdfFilesWithDialog(false);
    if (picked.length === 0) return;
    const item = picked[0];
    const doc = await openBytesAsNewTab(item.fileName, item.bytes, item.filePath, 'edit', 0);
    if (doc) {
      setActiveTool('edit-pdf-text');
      notify('Arrastra cualquier texto para moverlo o haz clic sobre él para editarlo.');
    }
  }, [openBytesAsNewTab, notify]);

  const handleOpenRecentFile = useCallback(
    async (item: RecentFileEntry) => {
      const alreadyOpen = tabs.find(
        (t) => (item.filePath && t.filePath === item.filePath) || t.fileName === item.fileName
      );
      if (alreadyOpen) {
        setActiveTabId(alreadyOpen.id);
        setWorkspaceMode('edit');
        return;
      }

      if (item.filePath) {
        const payload = await readPdfFromLocalPath(item.filePath);
        if (payload) {
          await openBytesAsNewTab(
            payload.fileName || item.fileName,
            payload.bytes,
            payload.filePath || item.filePath,
            'edit',
            0
          );
          return;
        }
        notify(`"${item.fileName}" se movió o renombró. Selecciónalo desde tu equipo.`);
      }
      await handleOpenPdfDialog();
    },
    [tabs, openBytesAsNewTab, handleOpenPdfDialog, notify]
  );

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
        await openBytesAsNewTab('Imagenes_Importadas_Kova.pdf', converted, undefined, 'edit');
        notify(`${imgs.length} imagen(es) convertidas a PDF automáticamente.`);
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
    await openBytesAsNewTab('Nuevo_Documento_Kova.pdf', blankBytes, undefined, 'edit');
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

  const handlePrintActiveTab = useCallback(() => {
    if (!activeTab) {
      notify('Abre un documento PDF primero para imprimir sus hojas.');
      return;
    }
    setPrintModalOpen(true);
  }, [activeTab, notify]);

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

  const selectedElement = useMemo(
    () => activeTab?.elements.find((e) => e.id === selectedElementId) || null,
    [activeTab, selectedElementId]
  );

  const selectedNativeText = useMemo(() => {
    if (!activeTab || !selectedNativeTextId) return null;
    if (activeTab.nativeTextEdits[selectedNativeTextId]) {
      return activeTab.nativeTextEdits[selectedNativeTextId];
    }
    for (const list of Object.values(t_safe(activeTab.extractedPageTexts))) {
      const found = list.find((item) => item.id === selectedNativeTextId);
      if (found) return found;
    }
    return null;
  }, [activeTab, selectedNativeTextId]);

  const pasteCopiedElementOnCurrentPage = useCallback(() => {
    const src = copiedElementRef.current;
    if (!src || !activeTab || workspaceMode === 'home') return false;
    const curPage = activeTab.pages[activeTab.currentPageIndex];
    if (!curPage) return false;
    lastInternalPasteMsRef.current = Date.now();
    const samePage = curPage.id === src.pageId;
    const nx = samePage ? Math.min(1 - src.width, src.x + 0.02) : src.x;
    const ny = samePage ? Math.min(1 - src.height, src.y + 0.02) : src.y;
    const adx = nx - src.x;
    const ady = ny - src.y;
    const newId = `el_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const pasted: PdfOverlayElement = {
      ...src,
      id: newId,
      pageId: curPage.id,
      x: nx,
      y: ny,
      zIndex: activeTab.elements.length + 1,
      points: src.points
        ? src.points.map((pt) => ({
            x: Math.max(0, Math.min(1, pt.x + adx)),
            y: Math.max(0, Math.min(1, pt.y + ady)),
          }))
        : undefined,
    };
    mutateActiveTab(
      (t) => ({
        ...t,
        isModified: true,
        elements: [...t.elements, pasted],
      }),
      true
    );
    setWorkspaceMode('edit');
    setActiveTool('select');
    setSelectedElementId(newId);
    setSelectedNativeTextId(null);
    notify(
      samePage
        ? 'Objeto pegado en la página actual.'
        : `Objeto pegado en la misma posición (Página ${activeTab.currentPageIndex + 1}).`
    );
    return true;
  }, [activeTab, workspaceMode, mutateActiveTab, notify]);

  // Clipboard Ctrl+V Image Paste (or internal Kova object paste) onto active PDF page
  useEffect(() => {
    const onPaste = async (e: ClipboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (!activeTab || workspaceMode === 'home') return;
      const items = Array.from(e.clipboardData?.items || []);
      const imgItem = items.find((it) => it.type.startsWith('image/'));
      if (imgItem) {
        const blob = imgItem.getAsFile();
        if (!blob) return;
        e.preventDefault();
        copiedElementRef.current = null;
        const dataUrl = await fileToDataUrl(blob);
        await insertImageDataUrlOnActivePage(dataUrl, 'Captura pegada', 0.32);
        notify('Imagen del portapapeles pegada directamente en la página.');
        return;
      }
      if (copiedElementRef.current) {
        e.preventDefault();
        pasteCopiedElementOnCurrentPage();
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [activeTab, workspaceMode, insertImageDataUrlOnActivePage, pasteCopiedElementOnCurrentPage, notify]);

  const handlePlaceSignatureOnPage = useCallback(
    async (dataUrl: string, signerLabel: string) => {
      let targetTab = activeTab;
      if (!targetTab) {
        const picked = await openPdfFilesWithDialog(false);
        if (picked.length === 0) return;
        targetTab = await openBytesAsNewTab(
          picked[0].fileName,
          picked[0].bytes,
          picked[0].filePath,
          'edit',
          0
        );
      }
      if (!targetTab) return;
      const curPage = targetTab.pages[targetTab.currentPageIndex];
      if (!curPage) return;
      const newId = `sig_${Date.now()}`;
      const dateStr = settings.includeDateOnSignature
        ? `${signerLabel} · ${new Date().toLocaleDateString('es-ES')}`
        : '';
      const targetId = targetTab.id;

      setTabs((prev) =>
        prev.map((tab) => {
          if (tab.id !== targetId) return tab;
          return {
            ...tab,
            isModified: true,
            undoStack: [...tab.undoStack.slice(-29), createSnapshot(tab)],
            redoStack: [],
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
          };
        })
      );
      setWorkspaceMode('edit');
      setActiveTool('select');
      setSelectedElementId(newId);
      setSelectedNativeTextId(null);
      notify('Firma transparente colocada en la página. Arrástrala libremente.');
    },
    [activeTab, settings.includeDateOnSignature, openBytesAsNewTab, notify]
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

  const handleDuplicateOverlayElement = useCallback(
    (id: string) => {
      if (!activeTab) return;
      const orig = activeTab.elements.find((e) => e.id === id);
      if (!orig) return;
      const copyId = `el_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
      const nx = Math.min(1 - orig.width, orig.x + 0.022);
      const ny = Math.min(1 - orig.height, orig.y + 0.022);
      const adx = nx - orig.x;
      const ady = ny - orig.y;
      const cloned: PdfOverlayElement = {
        ...orig,
        id: copyId,
        x: nx,
        y: ny,
        zIndex: activeTab.elements.length + 1,
        points: orig.points
          ? orig.points.map((pt) => ({
              x: Math.max(0, Math.min(1, pt.x + adx)),
              y: Math.max(0, Math.min(1, pt.y + ady)),
            }))
          : undefined,
      };
      mutateActiveTab(
        (t) => ({ ...t, isModified: true, elements: [...t.elements, cloned] }),
        true
      );
      setSelectedElementId(copyId);
      setSelectedNativeTextId(null);
    },
    [activeTab, mutateActiveTab]
  );

  const handleReplicateElementAcrossPages = useCallback(
    (id: string) => {
      if (!activeTab || activeTab.pages.length < 2) return;
      const orig = activeTab.elements.find((e) => e.id === id);
      if (!orig) return;
      const now = Date.now();
      const clones: PdfOverlayElement[] = activeTab.pages
        .filter((p) => p.id !== orig.pageId)
        .map((p, idx) => ({
          ...orig,
          id: `rep_${now}_${idx}_${Math.random().toString(36).slice(2, 5)}`,
          pageId: p.id,
          zIndex: activeTab.elements.length + idx + 1,
          points: orig.points ? orig.points.map((pt) => ({ ...pt })) : undefined,
        }));
      if (clones.length === 0) return;
      mutateActiveTab(
        (t) => ({
          ...t,
          isModified: true,
          elements: [...t.elements, ...clones],
        }),
        true
      );
      notify(`Objeto aplicado en la misma posición en las ${activeTab.pages.length} páginas.`);
    },
    [activeTab, mutateActiveTab, notify]
  );

  const handleDuplicateNativeTextAsOverlay = useCallback(
    (nt: NativePdfTextItem) => {
      if (!activeTab) return;
      const newId = `ntclone_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
      const newEl: PdfOverlayElement = {
        id: newId,
        pageId: nt.pageId,
        kind: 'text',
        x: Math.min(0.92, nt.x + 0.018),
        y: Math.min(0.94, nt.y + 0.018),
        width: Math.max(0.08, Math.min(0.85, nt.width + 0.04)),
        height: Math.max(0.025, nt.height + 0.008),
        rotation: nt.rotation || 0,
        opacity: 1,
        zIndex: activeTab.elements.length + 1,
        text: nt.text,
        fontFamily: nt.fontFamily,
        fontSizePt: nt.fontSizePt,
        fontWeight: nt.fontWeight,
        fontStyle: nt.fontStyle,
        textAlign: 'left',
        color: nt.color,
        backgroundColor: 'transparent',
      };
      mutateActiveTab(
        (t) => ({
          ...t,
          isModified: true,
          elements: [...t.elements, newEl],
        }),
        true
      );
      setWorkspaceMode('edit');
      setActiveTool('select');
      setSelectedNativeTextId(null);
      setSelectedElementId(newId);
      notify('Texto duplicado como bloque libre movible.');
    },
    [activeTab, mutateActiveTab, notify]
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
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        handleCreateBlankPdf();
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

      // Cross-page Ctrl+C / Ctrl+V for any PDF object or native text
      if (
        (e.ctrlKey || e.metaKey) &&
        e.key.toLowerCase() === 'c' &&
        !window.getSelection()?.toString()
      ) {
        if (selectedElement) {
          e.preventDefault();
          copiedElementRef.current = {
            ...selectedElement,
            points: selectedElement.points
              ? selectedElement.points.map((pt) => ({ ...pt }))
              : undefined,
          };
          notify('Objeto copiado. Usa Ctrl+V en esta u otra página para pegarlo.');
          return;
        }
        if (selectedNativeText) {
          e.preventDefault();
          copiedElementRef.current = {
            id: `clip_${Date.now()}`,
            pageId: selectedNativeText.pageId,
            kind: 'text',
            x: selectedNativeText.x,
            y: selectedNativeText.y,
            width: Math.max(0.08, Math.min(0.85, selectedNativeText.width + 0.04)),
            height: Math.max(0.025, selectedNativeText.height + 0.008),
            rotation: selectedNativeText.rotation || 0,
            opacity: 1,
            zIndex: 10,
            text: selectedNativeText.text,
            fontFamily: selectedNativeText.fontFamily,
            fontSizePt: selectedNativeText.fontSizePt,
            fontWeight: selectedNativeText.fontWeight,
            fontStyle: selectedNativeText.fontStyle,
            textAlign: 'left',
            color: selectedNativeText.color,
            backgroundColor: 'transparent',
          };
          notify('Texto copiado como bloque. Usa Ctrl+V en cualquier página para pegarlo.');
          return;
        }
      }

      if (
        (e.ctrlKey || e.metaKey) &&
        e.key.toLowerCase() === 'v' &&
        copiedElementRef.current &&
        activeTab &&
        workspaceMode !== 'home'
      ) {
        // Fallback if OS clipboard is empty and browser does not emit a paste event
        setTimeout(() => {
          if (Date.now() - lastInternalPasteMsRef.current > 120 && copiedElementRef.current) {
            pasteCopiedElementOnCurrentPage();
          }
        }, 45);
      }

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
              elements: t.elements.map((el) => {
                if (el.id !== selectedElementId) return el;
                const nx = Math.max(0, Math.min(1 - el.width, el.x + dx));
                const ny = Math.max(0, Math.min(1 - el.height, el.y + dy));
                const adx = nx - el.x;
                const ady = ny - el.y;
                return {
                  ...el,
                  x: nx,
                  y: ny,
                  points: el.points
                    ? el.points.map((pt) => ({
                        x: Math.max(0, Math.min(1, pt.x + adx)),
                        y: Math.max(0, Math.min(1, pt.y + ady)),
                      }))
                    : undefined,
                };
              }),
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
              x: Math.max(0.015, Math.min(0.97 - Math.min(0.08, base.width), base.x + dx)),
              y: Math.max(0.015, Math.min(0.975 - base.height, base.y + dy)),
              modified: true,
            };
            return applyNativeTextEdit(t, moved);
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
        (selectedElementId || selectedNativeText)
      ) {
        e.preventDefault();
        if (selectedElementId) {
          handleDuplicateOverlayElement(selectedElementId);
        } else if (selectedNativeText) {
          handleDuplicateNativeTextAsOverlay(selectedNativeText);
        }
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
    workspaceMode,
    selectedElement,
    selectedNativeText,
    selectedElementId,
    selectedNativeTextId,
    mutateActiveTab,
    handleOpenPdfDialog,
    handleCreateBlankPdf,
    handleSaveExportPdf,
    handlePrintActiveTab,
    handleUndo,
    handleRedo,
    handleDuplicateOverlayElement,
    handleDuplicateNativeTextAsOverlay,
    handleDeleteOverlayElement,
    pasteCopiedElementOnCurrentPage,
    notify,
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
        id: 'new-blank-pdf',
        category: 'Archivo',
        label: 'Crear Nuevo PDF en Blanco',
        shortcut: 'Ctrl+N',
        run: handleCreateBlankPdf,
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
            handleOpenPdfForEditText();
          }
        },
      },
      {
        id: 'merge-pdfs',
        category: 'Páginas',
        label: 'Unir varios archivos PDF…',
        run: () => setToolModal('merge'),
      },
      {
        id: 'split-pdfs',
        category: 'Páginas',
        label: 'Dividir PDF o extraer rango de páginas…',
        run: () => setToolModal('split'),
      },
      {
        id: 'remove-pages',
        category: 'Páginas',
        label: 'Eliminar páginas seleccionadas del PDF…',
        run: () => setToolModal('remove-pages'),
      },
      {
        id: 'crop-pdf',
        category: 'Páginas',
        label: 'Recortar márgenes del PDF…',
        run: () => setToolModal('crop'),
      },
      {
        id: 'compress-pdf',
        category: 'Optimizar',
        label: 'Comprimir y reducir tamaño del PDF…',
        run: () => setToolModal('optimize'),
      },
      {
        id: 'pdf-to-word',
        category: 'Convertir',
        label: 'Convertir PDF a Microsoft Word (.docx)',
        run: () => setToolModal('pdf-to-word'),
      },
      {
        id: 'export-csv',
        category: 'Convertir',
        label: 'Convertir tablas del PDF a Excel (.csv)',
        run: () => setToolModal('export-csv'),
      },
      {
        id: 'pdf-to-images',
        category: 'Convertir',
        label: 'Exportar PDF a imágenes PNG/JPG (.zip)',
        run: () => setToolModal('pdf-to-images'),
      },
      {
        id: 'images-to-pdf',
        category: 'Convertir',
        label: 'Convertir imágenes JPG/PNG a PDF…',
        run: () => setToolModal('images-to-pdf'),
      },
      {
        id: 'sign-doc',
        category: 'Firmas',
        label: 'Dibujar o Insertar Firma Transparente',
        run: () => setSignatureModalOpen(true),
      },
      {
        id: 'watermark',
        category: 'Seguridad',
        label: 'Aplicar marca de agua al documento…',
        run: () => setToolModal('watermark'),
      },
      {
        id: 'numbering',
        category: 'Páginas',
        label: 'Numerar páginas y folio Bates…',
        run: () => setToolModal('numbering'),
      },
      {
        id: 'organize-pages',
        category: 'Páginas',
        label: 'Mesa de Luz: Reordenar y rotar páginas',
        run: () => {
          if (activeTab) setWorkspaceMode('organize');
        },
      },
      {
        id: 'default-windows-app',
        category: 'Windows',
        label: 'Establecer Kova PDF como App Predeterminada en Windows',
        run: handleSetDefaultWindowsApp,
      },
      {
        id: 'save-pdf',
        category: 'Archivo',
        label: 'Guardar / Exportar PDF Final',
        shortcut: 'Ctrl+S',
        run: handleSaveExportPdf,
      },
      {
        id: 'print-pdf',
        category: 'Archivo',
        label: 'Imprimir Documento PDF (Hoja actual / Todas / Rango)',
        shortcut: 'Ctrl+P',
        run: handlePrintActiveTab,
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
      handleCreateBlankPdf,
      handleOpenPdfForEditText,
      handleSetDefaultWindowsApp,
      handleSaveExportPdf,
      handlePrintActiveTab,
      handleUpdateSettings,
    ]
  );

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

      {remoteUpdate &&
        !updateBannerDismissed &&
        (remoteUpdate.status === 'available' || Boolean(remoteUpdate.announcement)) && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              padding: '7px 16px',
              background: 'linear-gradient(90deg, #1E3A8A 0%, #2563EB 100%)',
              color: '#FFFFFF',
              fontSize: 12.5,
              borderBottom: '1px solid rgba(255,255,255,0.16)',
              zIndex: 40,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
              <RefreshCw
                size={14}
                className={installingAutoUpdate ? 'spin-icon' : ''}
                style={{ flexShrink: 0 }}
              />
              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {remoteUpdate.status === 'available' ? (
                  installingAutoUpdate ? (
                    <>
                      <strong>Aplicando actualización directa {remoteUpdate.latestVersion}…</strong>
                      {' · Sin asistentes ni desconfigurar tus firmas, ajustes o lector predeterminado.'}
                    </>
                  ) : (
                    <>
                      <strong>
                        {remoteUpdate.isRollback
                          ? `Restauración de versión ${remoteUpdate.latestVersion} lista`
                          : `Actualización directa ${remoteUpdate.latestVersion} disponible`}
                      </strong>
                      {remoteUpdate.announcement
                        ? ` · ${remoteUpdate.announcement}`
                        : ' · Se aplica directo sin asistentes ni perder tus firmas o configuraciones.'}
                    </>
                  )
                ) : (
                  <strong>{remoteUpdate.announcement}</strong>
                )}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              {remoteUpdate.status === 'available' && remoteUpdate.downloadUrl && (
                <button
                  type="button"
                  disabled={installingAutoUpdate}
                  onClick={() => handleGlobalOneClickUpdate(remoteUpdate.downloadUrl)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '4px 12px',
                    borderRadius: 6,
                    border: 'none',
                    background: '#FFFFFF',
                    color: '#1E3A8A',
                    fontWeight: 700,
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  <Download size={13} />
                  <span>
                    {installingAutoUpdate ? 'Aplicando directo…' : 'Aplicar directo ahora'}
                  </span>
                </button>
              )}
              {!remoteUpdate.mandatory && (
                <button
                  type="button"
                  onClick={() => setUpdateBannerDismissed(true)}
                  aria-label="Cerrar aviso"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'rgba(255,255,255,0.85)',
                    cursor: 'pointer',
                    padding: 3,
                    display: 'inline-flex',
                  }}
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
        )}

      {/* Active Workspace: Home Hub vs Studio Document View */}
      {workspaceMode === 'home' || !activeTab ? (
        <HomeHub
          recentFiles={recentFiles}
          savedLogosCount={savedLogos.length}
          onOpenPdfDialog={handleOpenPdfDialog}
          onOpenPdfForEditText={handleOpenPdfForEditText}
          onOpenRecentFile={handleOpenRecentFile}
          onDropFiles={handleDropFilesOnHome}
          onCreateBlankPdf={handleCreateBlankPdf}
          onOpenToolModal={(kind) => setToolModal(kind)}
          onOpenSignatureVault={() => setSignatureModalOpen(true)}
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
            inspectorOpen={inspectorOpen}
            onToggleInspector={() => setInspectorOpen((v) => !v)}
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
                onReversePages={() =>
                  mutateActiveTab(
                    (t) => ({
                      ...t,
                      isModified: true,
                      pages: [...t.pages].reverse(),
                    }),
                    true
                  )
                }
                onRotatePages={(indices, delta) =>
                  mutateActiveTab((t) => {
                    const nextCache = { ...t.extractedPageTexts };
                    indices.forEach((idx) => {
                      const pid = t.pages[idx]?.id;
                      if (pid) delete nextCache[pid];
                    });
                    return {
                      ...t,
                      isModified: true,
                      extractedPageTexts: nextCache,
                      pages: t.pages.map((p, i) =>
                        indices.includes(i)
                          ? { ...p, rotation: (((p.rotation + delta) % 360) + 360) % 360 }
                          : p
                      ),
                    };
                  }, true)
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
                onOpenCropModal={() => setToolModal('crop')}
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
                  onReorderPages={(from, to) =>
                    mutateActiveTab((t) => {
                      if (from < 0 || to < 0 || from >= t.pages.length || to >= t.pages.length || from === to) {
                        return t;
                      }
                      const next = [...t.pages];
                      const [moved] = next.splice(from, 1);
                      next.splice(to, 0, moved);
                      return {
                        ...t,
                        isModified: true,
                        pages: next,
                        currentPageIndex: to,
                      };
                    }, true)
                  }
                  onRotatePage={(idx) =>
                    mutateActiveTab((t) => {
                      const nextCache = { ...t.extractedPageTexts };
                      const pid = t.pages[idx]?.id;
                      if (pid) delete nextCache[pid];
                      return {
                        ...t,
                        isModified: true,
                        extractedPageTexts: nextCache,
                        pages: t.pages.map((p, i) =>
                          i === idx ? { ...p, rotation: (p.rotation + 90) % 360 } : p
                        ),
                      };
                    }, true)
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
                  customFonts={customFonts}
                  onUploadCustomFontForTarget={handleImportCustomFonts}
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
                    mutateActiveTab((t) => applyNativeTextEdit(t, item), pushUndo)
                  }
                  onResetNativeTextItem={(id) => {
                    mutateActiveTab((t) => {
                      const copy = { ...t.nativeTextEdits };
                      delete copy[id];
                      return {
                        ...t,
                        isModified: Object.keys(copy).length > 0 || t.elements.length > 0,
                        nativeTextEdits: copy,
                      };
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
                  onActivateEditPdfText={() => {
                    setWorkspaceMode('edit');
                    setActiveTool('edit-pdf-text');
                    setSelectedElementId(null);
                  }}
                  onChangeZoom={(z) => mutateActiveTab((t) => ({ ...t, zoom: z }))}
                />

                {workspaceMode === 'edit' && inspectorOpen && (
                  <ObjectInspector
                    tab={activeTab}
                    customFonts={customFonts}
                    onUploadCustomFontForTarget={handleImportCustomFonts}
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
                    onReplicateElementAcrossPages={handleReplicateElementAcrossPages}
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
                      mutateActiveTab((t) => applyNativeTextEdit(t, item), pushUndo)
                    }
                    onDuplicateNativeTextAsOverlay={handleDuplicateNativeTextAsOverlay}
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
                    onOpenToolModal={(k) => setToolModal(k)}
                    onCloseInspector={() => setInspectorOpen(false)}
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
          <div className="status-bar-left">
            {settings.strictOfflineIndicator && (
              <span className="offline-pill">
                <ShieldCheck size={13} />
                <span>100% Local Offline · Privacidad Verificada</span>
              </span>
            )}
            {activeTab && workspaceMode !== 'home' && (
              <span className="status-bar-doc">
                {activeTab.fileName} · Página {activeTab.currentPageIndex + 1} de{' '}
                {activeTab.pages.length} · Zoom {Math.round(activeTab.zoom * 100)}%
              </span>
            )}
          </div>

          <div className="status-bar-right">
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
            <span>Kova PDF v{CURRENT_APP_VERSION} · Kova Studio</span>
          </div>
        </footer>
      )}

      {/* Modals */}
      {signatureModalOpen && (
        <SignatureModal
          savedSignatures={savedSignatures}
          hasActivePage={Boolean(activeTab)}
          onSaveNewSignature={(sig) => {
            const next = [sig, ...savedSignatures];
            setSavedSignatures(next);
            saveSignaturesList(next);
            if (!activeTab) {
              notify(`Firma "${sig.name}" guardada en tu Bóveda Local.`);
            }
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
          key={`${toolModal}-${activeTab?.id || 'empty'}`}
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
          onPlaceLogoOnPage={async (logo) => {
            if (activeTab) {
              await insertImageDataUrlOnActivePage(logo.dataUrl, logo.name, 0.19);
              notify(`Logo "${logo.name}" estampado en la página. Arrástralo libremente.`);
              return;
            }
            const picked = await openPdfFilesWithDialog(false);
            if (picked.length === 0) return;
            const doc = await openBytesAsNewTab(
              picked[0].fileName,
              picked[0].bytes,
              picked[0].filePath,
              'edit',
              0
            );
            if (!doc) return;
            const curPage = doc.pages[0];
            if (!curPage) return;
            const dims = await getImageDimensions(logo.dataUrl);
            const aspect = dims.width / Math.max(1, dims.height);
            const w = 0.19;
            const h = Math.min(0.48, (w / aspect) * (curPage.widthPt / Math.max(1, curPage.heightPt)));
            const newId = `img_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
            setTabs((prev) =>
              prev.map((t) =>
                t.id === doc.id
                  ? {
                      ...t,
                      isModified: true,
                      undoStack: [...t.undoStack.slice(-29), createSnapshot(t)],
                      elements: [
                        ...t.elements,
                        {
                          id: newId,
                          pageId: curPage.id,
                          kind: 'image',
                          x: 0.08,
                          y: 0.05,
                          width: w,
                          height: h,
                          rotation: 0,
                          opacity: 1,
                          zIndex: t.elements.length + 1,
                          dataUrl: logo.dataUrl,
                          naturalWidth: dims.width,
                          naturalHeight: dims.height,
                          preserveAspect: true,
                          text: logo.name,
                        },
                      ],
                    }
                  : t
              )
            );
            setSelectedElementId(newId);
            notify(`Logo "${logo.name}" estampado en "${doc.fileName}".`);
          }}
          onInsertAccountingSummaryOnPage={handleInsertAccountingSummaryOnPage}
          onOpenGeneratedPdfInTab={(name, bytes) =>
            openBytesAsNewTab(name, bytes, undefined, 'edit')
          }
          onOpenPdfForModal={async (name, bytes) => {
            await openBytesAsNewTab(name, bytes, undefined, 'edit');
          }}
          onDeletePagesFromModal={(indices) =>
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
          onApplyCrop={(marginsMm, scope) =>
            mutateActiveTab((t) => {
              const mmToPt = 72 / 25.4;
              return {
                ...t,
                isModified: true,
                pages: t.pages.map((p, idx) => {
                  if (scope === 'current' && idx !== t.currentPageIndex) return p;
                  const topN = Math.min(0.4, (marginsMm.top * mmToPt) / Math.max(1, p.heightPt));
                  const bottomN = Math.min(
                    0.4,
                    (marginsMm.bottom * mmToPt) / Math.max(1, p.heightPt)
                  );
                  const leftN = Math.min(0.4, (marginsMm.left * mmToPt) / Math.max(1, p.widthPt));
                  const rightN = Math.min(
                    0.4,
                    (marginsMm.right * mmToPt) / Math.max(1, p.widthPt)
                  );
                  const isZero = topN === 0 && rightN === 0 && bottomN === 0 && leftN === 0;
                  return {
                    ...p,
                    crop: isZero
                      ? undefined
                      : { top: topN, right: rightN, bottom: bottomN, left: leftN },
                  };
                }),
              };
            }, true)
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

      {printModalOpen && activeTab && (
        <PrintModal
          key={activeTab.id}
          tab={activeTab}
          onSavePdfCopy={handleSaveExportPdf}
          onNotify={notify}
          onClose={() => setPrintModalOpen(false)}
        />
      )}

      {settingsOpen && (
        <SettingsModal
          settings={settings}
          customFonts={customFonts}
          onImportCustomFonts={handleImportCustomFonts}
          onDeleteCustomFont={handleDeleteCustomFont}
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

      {remoteUpdate?.status === 'available' && remoteUpdate.mandatory && (
        <div className="modal-backdrop">
          <div className="modal-window" style={{ maxWidth: 480, padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <img
                src="/brand/logo-mark.svg"
                alt="Kova PDF"
                style={{ width: 38, height: 38 }}
              />
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>
                  Actualización obligatoria disponible ({remoteUpdate.latestVersion})
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  Versión actual instalada: {remoteUpdate.currentVersion}
                </div>
              </div>
            </div>
            <div
              style={{
                fontSize: 13,
                lineHeight: 1.55,
                color: 'var(--text-secondary)',
                padding: '12px 14px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                marginBottom: 18,
                whiteSpace: 'pre-wrap',
              }}
            >
              {remoteUpdate.notes ||
                'Esta actualización incluye mejoras esenciales de seguridad, precisión tipográfica y estabilidad para todos los equipos.'}
            </div>
            <button
              type="button"
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center', height: 40, fontSize: 13.5 }}
              disabled={installingAutoUpdate}
              onClick={() => handleGlobalOneClickUpdate(remoteUpdate.downloadUrl)}
            >
              <Download size={15} />
              <span>
                {installingAutoUpdate
                  ? 'Descargando e instalando automáticamente…'
                  : `Actualizar a ${remoteUpdate.latestVersion} ahora`}
              </span>
            </button>
          </div>
        </div>
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

function t_safe<T>(record: Record<string, T> | undefined): Record<string, T> {
  return record || {};
}

export default App;
