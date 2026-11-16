import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Building2,
  Calculator,
  Check,
  Copy,
  Crop,
  Download,
  FileDown,
  FilePlus,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  ImagePlus,
  Plus,
  RotateCcw,
  ScanText,
  Scissors,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import type {
  DocumentMetadata,
  HeaderFooterConfig,
  PageDescriptor,
  PdfTabDocument,
  SavedLogo,
  ToolModalKind,
  WatermarkConfig,
} from '../types/pdf';
import {
  convertImagesToPdfBytes,
  fileToDataUrl,
  getImageDimensions,
  removeSignatureBackground,
} from '../utils/imageUtils';
import {
  extractStructuredPageLines,
  extractTabTablesToCsv,
  renderPageToCanvas,
} from '../utils/pdfEngine';
import {
  compressPdfDocument,
  exportTabPagesToImagesZip,
  exportTabToDocxBlob,
  exportTabToPlainText,
  extractSelectedPagesAsPdf,
  mergeMultiplePdfBuffers,
  parsePageRangeSpec,
  splitPdfIntoZip,
  type CompressionLevel,
} from '../utils/pdfExporter';
import {
  downloadBlobInBrowser,
  openPdfFilesWithDialog,
  savePdfBytesToDisk,
} from '../utils/tauriBridge';

interface ToolsModalProps {
  kind: Exclude<ToolModalKind, null>;
  activeTab: PdfTabDocument | null;
  defaultExportDpi: 150 | 300 | 600;
  defaultTaxRatePct: number;
  currencySymbol: string;
  savedLogos: SavedLogo[];
  onSaveLogo: (logo: SavedLogo) => void;
  onDeleteLogo: (id: string) => void;
  onPlaceLogoOnPage: (logo: SavedLogo) => void;
  onInsertAccountingSummaryOnPage: (summaryText: string) => void;
  onOpenGeneratedPdfInTab: (fileName: string, bytes: Uint8Array) => void;
  onOpenPdfForModal: (fileName: string, bytes: Uint8Array) => Promise<void>;
  onDeletePagesFromModal: (indices: number[]) => void;
  onApplyCrop: (
    marginsMm: { top: number; right: number; bottom: number; left: number },
    scope: 'all' | 'current'
  ) => void;
  onUpdateWatermark: (wm: WatermarkConfig) => void;
  onUpdateHeaderFooter: (hf: HeaderFooterConfig) => void;
  onUpdateMetadata: (meta: DocumentMetadata, cleanNow?: boolean) => void;
  onNotify: (msg: string) => void;
  onClose: () => void;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

const RemovePageThumb: React.FC<{
  tab: PdfTabDocument;
  pageDesc: PageDescriptor;
  markedForDelete: boolean;
}> = ({ tab, pageDesc, markedForDelete }) => {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const bytes = tab.sourceBuffers[pageDesc.sourceId];
    renderPageToCanvas(pageDesc.sourceId, bytes, pageDesc, c, 0.2, false).catch(() => {});
  }, [tab.sourceBuffers, pageDesc]);

  return (
    <div
      style={{
        height: 120,
        background: '#ffffff',
        borderRadius: 6,
        border: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 4,
        position: 'relative',
        overflow: 'hidden',
        opacity: markedForDelete ? 0.45 : 1,
      }}
    >
      <canvas ref={ref} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
      {markedForDelete && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(220, 38, 38, 0.18)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span
            style={{
              background: '#dc2626',
              color: '#ffffff',
              fontSize: 10.5,
              fontWeight: 700,
              padding: '3px 8px',
              borderRadius: 99,
              boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
            }}
          >
            ✕ Eliminar
          </span>
        </div>
      )}
    </div>
  );
};

export const ToolsModal: React.FC<ToolsModalProps> = ({
  kind,
  activeTab,
  defaultExportDpi,
  defaultTaxRatePct,
  currencySymbol,
  savedLogos,
  onSaveLogo,
  onDeleteLogo,
  onPlaceLogoOnPage,
  onInsertAccountingSummaryOnPage,
  onOpenGeneratedPdfInTab,
  onOpenPdfForModal,
  onDeletePagesFromModal,
  onApplyCrop,
  onUpdateWatermark,
  onUpdateHeaderFooter,
  onUpdateMetadata,
  onNotify,
  onClose,
}) => {
  const [busy, setBusy] = useState(false);
  const [dropHover, setDropHover] = useState(false);

  // Merge state
  const [mergeList, setMergeList] = useState<
    Array<{ id: string; fileName: string; bytes: Uint8Array }>
  >(() =>
    activeTab && Object.values(activeTab.sourceBuffers)[0]
      ? [
          {
            id: 'cur_0',
            fileName: activeTab.fileName,
            bytes: Object.values(activeTab.sourceBuffers)[0],
          },
        ]
      : []
  );

  // Split state
  const [splitMode, setSplitMode] = useState<'range' | 'every-n'>('range');
  const [rangeSpec, setRangeSpec] = useState('1-2');
  const [splitEveryN, setSplitEveryN] = useState(1);

  // Remove pages state
  const [deleteIndices, setDeleteIndices] = useState<number[]>([]);
  const [deleteRangeInput, setDeleteRangeInput] = useState('');

  // Crop margins state (in mm)
  const [cropScope, setCropScope] = useState<'all' | 'current'>('all');
  const [cropMm, setCropMm] = useState<{ top: number; right: number; bottom: number; left: number }>(
    () => {
      const curPage = activeTab?.pages[activeTab.currentPageIndex];
      if (curPage?.crop) {
        const ptToMm = 25.4 / 72;
        return {
          top: Math.round(curPage.crop.top * curPage.heightPt * ptToMm),
          right: Math.round(curPage.crop.right * curPage.widthPt * ptToMm),
          bottom: Math.round(curPage.crop.bottom * curPage.heightPt * ptToMm),
          left: Math.round(curPage.crop.left * curPage.widthPt * ptToMm),
        };
      }
      return { top: 10, right: 10, bottom: 10, left: 10 };
    }
  );

  // Optimize / Compress state
  const [compLevel, setCompLevel] = useState<CompressionLevel>('balanced');
  const [flattenReadOnly, setFlattenReadOnly] = useState(false);
  const [compResult, setCompResult] = useState<{
    bytes: Uint8Array;
    originalBytes: number;
    compressedBytes: number;
  } | null>(null);

  // PDF to Word (.docx / .txt) state
  const [wordFormat, setWordFormat] = useState<'docx' | 'txt'>('docx');
  const [wordStats, setWordStats] = useState<{ pages: number; lines: number; tables: number }>({
    pages: 0,
    lines: 0,
    tables: 0,
  });

  // Watermark state
  const [wm, setWm] = useState<WatermarkConfig>(
    activeTab?.watermark || {
      enabled: true,
      text: 'CONFIDENCIAL',
      color: '#C81E32',
      opacity: 0.16,
      fontSizePt: 48,
      rotation: -35,
      tiled: false,
    }
  );

  // Numbering / Bates state
  const [hf, setHf] = useState<HeaderFooterConfig>(
    activeTab?.headerFooter || {
      enabled: true,
      headerLeft: '',
      headerRight: '',
      footerCenterPattern: 'page-of-total',
      batesPrefix: 'KOVA-',
      batesStart: 1,
      customFooter: 'Página {page} de {total}',
      fontSizePt: 9.5,
      color: '#525866',
    }
  );

  // Images -> PDF state
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [pagePreset, setPagePreset] = useState<'a4' | 'letter' | 'fit'>('a4');
  const [imgOrientation, setImgOrientation] = useState<'auto' | 'portrait' | 'landscape'>('auto');
  const [imgMarginPt, setImgMarginPt] = useState<number>(28);

  // PDF -> Images state
  const [imgDpi, setImgDpi] = useState<150 | 300 | 600>(defaultExportDpi);
  const [imgFormat, setImgFormat] = useState<'png' | 'jpeg'>('png');

  // OCR state
  const [ocrLang, setOcrLang] = useState<'spa' | 'eng'>('spa');
  const [ocrPageIdx, setOcrPageIdx] = useState(activeTab?.currentPageIndex || 0);
  const [ocrProgress, setOcrProgress] = useState<string>('');
  const [ocrText, setOcrText] = useState<string>('');

  // Metadata state
  const [meta, setMeta] = useState<DocumentMetadata>(
    activeTab?.metadata || {
      title: '',
      author: '',
      subject: '',
      keywords: '',
      creator: 'Kova PDF',
      producer: 'Kova PDF Native Engine',
    }
  );

  // Company Logo Vault state
  const [logoLabel, setLogoLabel] = useState('Logo Corporativo');
  const [stripWhiteBg, setStripWhiteBg] = useState(false);

  // Accounting Tape & Tax Calculator state
  const [calcItems, setCalcItems] = useState<
    Array<{ id: string; concept: string; amount: string }>
  >([
    { id: 'c1', concept: 'Partida / Servicio Principal', amount: '18500.00' },
    { id: 'c2', concept: 'Suministro / Materiales', amount: '6450.00' },
  ]);
  const [taxRate, setTaxRate] = useState<number>(defaultTaxRatePct || 16);
  const [applyRetentionIsr, setApplyRetentionIsr] = useState(false);

  // PDF -> Excel CSV state
  const [csvScope, setCsvScope] = useState<'current' | 'all'>('all');
  const [csvPreview, setCsvPreview] = useState<string>('');
  const [csvRowCount, setCsvRowCount] = useState<number>(0);

  useEffect(() => {
    if (kind !== 'export-csv' || !activeTab) return;
    let cancelled = false;
    extractTabTablesToCsv(activeTab, csvScope)
      .then((csvText) => {
        if (!cancelled) {
          setCsvPreview(csvText.replace(/^\uFEFF/, ''));
          setCsvRowCount(csvText.split(/\r?\n/).filter(Boolean).length);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [kind, activeTab, csvScope]);

  useEffect(() => {
    if (kind !== 'pdf-to-word' || !activeTab) return;
    let cancelled = false;
    extractStructuredPageLines(activeTab)
      .then((pages) => {
        if (cancelled) return;
        let lines = 0;
        let tables = 0;
        for (const pageLines of pages) {
          lines += pageLines.length;
          let inTbl = false;
          for (const ln of pageLines) {
            if (ln.cells.length >= 2) {
              if (!inTbl) {
                tables += 1;
                inTbl = true;
              }
            } else {
              inTbl = false;
            }
          }
        }
        setWordStats({ pages: pages.length, lines, tables });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [kind, activeTab]);

  const handlePickPdfInsideModal = async () => {
    const picked = await openPdfFilesWithDialog(false);
    if (picked.length > 0) {
      await onOpenPdfForModal(picked[0].fileName, picked[0].bytes);
    }
  };

  const handleDropPdfInsideModal = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDropHover(false);
    const file = Array.from(e.dataTransfer.files || []).find(
      (f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
    );
    if (!file) {
      onNotify('Selecciona un archivo con formato .PDF válido.');
      return;
    }
    const buf = await file.arrayBuffer();
    await onOpenPdfForModal(file.name, new Uint8Array(buf));
  };

  const renderSelectPdfPrompt = (subtitle: string) => (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDropHover(true);
      }}
      onDragLeave={() => setDropHover(false)}
      onDrop={handleDropPdfInsideModal}
      style={{
        padding: '32px 24px',
        textAlign: 'center',
        border: `1.5px dashed ${dropHover ? 'var(--accent)' : 'var(--border-strong)'}`,
        background: dropHover ? 'var(--accent-soft)' : 'var(--bg-surface-subtle)',
        borderRadius: 'var(--radius-lg)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <img src="/brand/pdf-doc-icon.svg" alt="PDF" style={{ width: 46, height: 46 }} />
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
        Selecciona o arrastra un documento PDF aquí
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', maxWidth: 420 }}>
        {subtitle}
      </div>
      <button type="button" className="btn btn-primary" onClick={handlePickPdfInsideModal}>
        <FolderOpen size={15} />
        <span>Elegir archivo PDF de este equipo…</span>
      </button>
    </div>
  );

  const handleUploadNewLogo = async (file: File) => {
    setBusy(true);
    try {
      let dataUrl = await fileToDataUrl(file);
      if (stripWhiteBg) {
        dataUrl = await removeSignatureBackground(dataUrl, undefined, 236);
      }
      const dims = await getImageDimensions(dataUrl);
      const saved: SavedLogo = {
        id: `logo_${Date.now()}`,
        name: logoLabel.trim() || file.name.replace(/\.[^.]+$/, ''),
        dataUrl,
        naturalWidth: dims.width,
        naturalHeight: dims.height,
        createdAt: new Date().toLocaleDateString('es-ES'),
      };
      onSaveLogo(saved);
      onNotify(`Logo "${saved.name}" guardado en tu Bóveda Local.`);
    } catch {
      onNotify('No se pudo procesar el archivo de imagen.');
    } finally {
      setBusy(false);
    }
  };

  // Accounting calculations
  const subtotal = calcItems.reduce((acc, item) => {
    const val = parseFloat(item.amount.replace(/,/g, '')) || 0;
    return acc + val;
  }, 0);
  const ivaAmount = subtotal * (taxRate / 100);
  const retIsr = applyRetentionIsr ? subtotal * 0.1 : 0;
  const grandTotal = subtotal + ivaAmount - retIsr;

  const formatMoney = (n: number) =>
    `${currencySymbol}${n.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const buildAccountingStampSummary = () => {
    const lines = [
      'CEDULA DE REVISION CONTABLE · KOVA PDF',
      '----------------------------------------',
      ...calcItems.map(
        (it) =>
          `${it.concept.slice(0, 24).padEnd(25, ' ')} ${formatMoney(
            parseFloat(it.amount.replace(/,/g, '')) || 0
          )}`
      ),
      '----------------------------------------',
      `SUBTOTAL:                 ${formatMoney(subtotal)}`,
      `IVA (${taxRate}%):                 ${formatMoney(ivaAmount)}`,
    ];
    if (applyRetentionIsr) {
      lines.push(`RET. ISR (10%):          -${formatMoney(retIsr)}`);
    }
    lines.push(`TOTAL VERIFICADO:         ${formatMoney(grandTotal)}`);
    return lines.join('\n');
  };

  const handleDownloadCsv = () => {
    if (!csvPreview || !activeTab) return;
    const bom = '\uFEFF';
    const blob = new Blob([bom + csvPreview], { type: 'text/csv;charset=utf-8;' });
    const base = activeTab.fileName.replace(/\.pdf$/i, '');
    downloadBlobInBrowser(blob, `${base}_Tablas_Excel.csv`);
    onNotify(`Archivo Excel CSV exportado (${csvRowCount} filas detectadas).`);
    onClose();
  };

  const handleAddPdfsToMerge = async () => {
    const picked = await openPdfFilesWithDialog(true);
    if (picked.length === 0) return;
    setMergeList((prev) => [
      ...prev,
      ...picked.map((p, i) => ({
        id: `m_${Date.now()}_${i}`,
        fileName: p.fileName,
        bytes: p.bytes,
      })),
    ]);
  };

  const handleRunMerge = async () => {
    if (mergeList.length < 2) {
      onNotify('Agrega al menos 2 archivos PDF para unirlos.');
      return;
    }
    setBusy(true);
    try {
      const mergedBytes = await mergeMultiplePdfBuffers(mergeList);
      onOpenGeneratedPdfInTab('Documento_Combinado_Kova.pdf', mergedBytes);
      onNotify('PDFs combinados correctamente en una nueva pestaña.');
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const handleRunSplit = async () => {
    if (!activeTab) return;
    setBusy(true);
    try {
      const base = activeTab.fileName.replace(/\.pdf$/i, '');
      if (splitMode === 'every-n') {
        const zipBlob = await splitPdfIntoZip(activeTab, Math.max(1, splitEveryN));
        downloadBlobInBrowser(zipBlob, `${base}_dividido.zip`);
        onNotify('PDF dividido en archivos individuales dentro del paquete ZIP.');
        onClose();
        return;
      }
      const indices = parsePageRangeSpec(rangeSpec, activeTab.pages.length);
      if (indices.length === 0) {
        onNotify('Rango de páginas no válido.');
        return;
      }
      const extracted = await extractSelectedPagesAsPdf(activeTab, indices);
      onOpenGeneratedPdfInTab(`${base}_extraido.pdf`, extracted);
      onNotify(`Se extrajeron ${indices.length} página(s) en una pestaña nueva.`);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const handleRunRemovePages = () => {
    if (!activeTab) return;
    if (deleteIndices.length === 0) {
      onNotify('Selecciona al menos una página para eliminar.');
      return;
    }
    if (deleteIndices.length >= activeTab.pages.length) {
      onNotify('El documento debe conservar al menos 1 página.');
      return;
    }
    onDeletePagesFromModal(deleteIndices);
    onNotify(`Se eliminaron ${deleteIndices.length} página(s) del documento.`);
    onClose();
  };

  const handleRunCrop = () => {
    if (!activeTab) return;
    onApplyCrop(cropMm, cropScope);
    onNotify(
      cropScope === 'all'
        ? 'Recorte de márgenes aplicado a todas las páginas.'
        : `Recorte aplicado a la página ${activeTab.currentPageIndex + 1}.`
    );
    onClose();
  };

  const handleRunCompress = async () => {
    if (!activeTab) return;
    setBusy(true);
    try {
      const res = await compressPdfDocument(activeTab, compLevel, flattenReadOnly);
      setCompResult(res);
      onNotify('Compresión completada localmente.');
    } catch {
      onNotify('Ocurrió un problema al comprimir el documento.');
    } finally {
      setBusy(false);
    }
  };

  const handleRunPdfToWord = async () => {
    if (!activeTab) return;
    setBusy(true);
    try {
      const base = activeTab.fileName.replace(/\.pdf$/i, '');
      if (wordFormat === 'docx') {
        const docxBlob = await exportTabToDocxBlob(activeTab);
        downloadBlobInBrowser(docxBlob, `${base}_Editable.docx`);
        onNotify('Documento Word (.docx) generado con estructura y tablas editables.');
      } else {
        const txt = await exportTabToPlainText(activeTab);
        const blob = new Blob([txt], { type: 'text/plain;charset=utf-8' });
        downloadBlobInBrowser(blob, `${base}_Texto.txt`);
        onNotify('Archivo de texto (.txt) exportado correctamente.');
      }
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const handleRunImagesToPdf = async () => {
    if (imageFiles.length === 0) return;
    setBusy(true);
    try {
      const pdfBytes = await convertImagesToPdfBytes(
        imageFiles,
        pagePreset,
        imgMarginPt,
        imgOrientation
      );
      onOpenGeneratedPdfInTab('Imagenes_Convertidas_Kova.pdf', pdfBytes);
      onNotify(`${imageFiles.length} imagen(es) convertidas a PDF.`);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const handleRunPdfToImages = async () => {
    if (!activeTab) return;
    setBusy(true);
    try {
      const zipBlob = await exportTabPagesToImagesZip(activeTab, imgDpi, imgFormat);
      const base = activeTab.fileName.replace(/\.pdf$/i, '');
      downloadBlobInBrowser(zipBlob, `${base}_imagenes_${imgDpi}dpi.zip`);
      onNotify(`Páginas exportadas en archivo ZIP (${imgDpi} DPI).`);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const handleRunOcr = async () => {
    if (!activeTab) return;
    const pd = activeTab.pages[ocrPageIdx];
    if (!pd) return;
    setBusy(true);
    setOcrProgress('Renderizando página en alta nitidez…');
    try {
      const canvas = document.createElement('canvas');
      const srcBytes = activeTab.sourceBuffers[pd.sourceId];
      await renderPageToCanvas(pd.sourceId, srcBytes, pd, canvas, 2.2, false);

      setOcrProgress('Ejecutando motor OCR local…');
      const Tesseract = await import('tesseract.js');
      const result = await Tesseract.recognize(canvas, ocrLang, {
        logger: (m) => {
          if (m.status) {
            const pct = typeof m.progress === 'number' ? ` (${Math.round(m.progress * 100)}%)` : '';
            setOcrProgress(`${m.status}${pct}`);
          }
        },
      });
      setOcrText(result.data.text || '(No se detectaron caracteres en esta página)');
      setOcrProgress('Reconocimiento completado.');
    } catch {
      setOcrProgress(
        'En entorno sin red para descargar diccionario inicial, usa búsqueda nativa de texto.'
      );
    } finally {
      setBusy(false);
    }
  };

  const titles: Record<Exclude<ToolModalKind, null>, string> = {
    logos: 'Bóveda Local de Logos Empresariales y Membretes',
    calculator: 'Calculadora Contable de Cinta, IVA y Retenciones',
    'export-csv': 'PDF a Microsoft Excel (.csv)',
    'pdf-to-word': 'Convertir PDF a Microsoft Word Editable (.docx)',
    merge: 'Unir y Combinar Archivos PDF',
    split: 'Dividir PDF o Extraer Páginas',
    'remove-pages': 'Eliminar Páginas del PDF',
    crop: 'Recortar Márgenes del PDF',
    optimize: 'Comprimir y Optimizar Peso del PDF',
    watermark: 'Estudio de Marca de Agua',
    numbering: 'Numerar Páginas, Encabezados y Folio Bates',
    'images-to-pdf': 'Convertir Imágenes (JPG, PNG, WebP) a PDF',
    'pdf-to-images': 'Exportar PDF a Imágenes de Alta Nitidez (.zip)',
    ocr: 'Reconocimiento Óptico de Texto (OCR Local)',
    metadata: 'Inspector de Propiedades y Privacidad',
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-window" style={{ maxWidth: 720 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <Sparkles size={17} style={{ color: 'var(--accent)' }} />
            <span>{titles[kind]}</span>
          </div>
          <button type="button" className="btn icon-only" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="modal-body">
          {/* COMPANY LOGO VAULT */}
          {kind === 'logos' && (
            <div>
              <div
                className="setting-card"
                style={{ flexDirection: 'column', alignItems: 'stretch', gap: 10 }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div className="setting-card-title">Subir nuevo logotipo institucional</div>
                    <div className="setting-card-desc">
                      Guarda el logotipo de tu organización una sola vez y estámpalo limpio en cualquier PDF en 1 clic.
                    </div>
                  </div>
                  <Building2 size={20} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <input
                    type="text"
                    className="prop-input"
                    style={{ flex: 1, minWidth: 180 }}
                    placeholder="Nombre del logo (ej. Grupo Corporativo)"
                    value={logoLabel}
                    onChange={(e) => setLogoLabel(e.target.value)}
                  />
                  <label
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: 12,
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={stripWhiteBg}
                      onChange={(e) => setStripWhiteBg(e.target.checked)}
                    />
                    <span>Quitar fondo blanco</span>
                  </label>
                  <label className="btn btn-primary" style={{ cursor: 'pointer' }}>
                    <ImagePlus size={14} />
                    <span>Subir Logo (PNG/JPG/SVG)…</span>
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        e.target.value = '';
                        if (f) handleUploadNewLogo(f);
                      }}
                    />
                  </label>
                </div>
              </div>

              <div
                style={{
                  fontSize: 11.5,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: 'var(--text-muted)',
                  margin: '14px 0 8px',
                }}
              >
                Logos Guardados en este Equipo ({savedLogos.length})
              </div>

              {savedLogos.length === 0 ? (
                <div
                  style={{
                    padding: 26,
                    textAlign: 'center',
                    border: '1.5px dashed var(--border-strong)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--text-muted)',
                    fontSize: 12.5,
                  }}
                >
                  Aún no has guardado logos empresariales. Sube tu logotipo arriba para tenerlo siempre disponible sin conexión.
                </div>
              ) : (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))',
                    gap: 10,
                  }}
                >
                  {savedLogos.map((lg) => (
                    <div
                      key={lg.id}
                      style={{
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-md)',
                        padding: 10,
                        background: 'var(--bg-surface-subtle)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                      }}
                    >
                      <div
                        style={{
                          height: 74,
                          background: '#ffffff',
                          borderRadius: 6,
                          border: '1px solid var(--border-subtle)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: 6,
                        }}
                      >
                        <img
                          src={lg.dataUrl}
                          alt={lg.name}
                          style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                        />
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {lg.name}
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          type="button"
                          className="btn btn-primary"
                          style={{ flex: 1, height: 28, fontSize: 11.5 }}
                          disabled={!activeTab}
                          onClick={() => {
                            onPlaceLogoOnPage(lg);
                            onClose();
                          }}
                        >
                          Colocar en PDF
                        </button>
                        <button
                          type="button"
                          className="btn icon-only"
                          style={{ width: 28, height: 28, color: 'var(--danger)' }}
                          onClick={() => onDeleteLogo(lg.id)}
                          title="Eliminar logo guardado"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ACCOUNTING TAPE & IVA CALCULATOR */}
          {kind === 'calculator' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
                  Suma partidas de facturas, presupuestos o estados de cuenta y estampa la cédula en el PDF:
                </span>
                <button
                  type="button"
                  className="btn btn-subtle"
                  onClick={() =>
                    setCalcItems((prev) => [
                      ...prev,
                      { id: `c_${Date.now()}`, concept: `Concepto ${prev.length + 1}`, amount: '0.00' },
                    ])
                  }
                >
                  <Plus size={14} />
                  <span>Agregar partida</span>
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
                {calcItems.map((row, idx) => (
                  <div key={row.id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontSize: 11.5, color: 'var(--text-muted)', width: 18 }}>
                      {idx + 1}.
                    </span>
                    <input
                      type="text"
                      className="prop-input"
                      style={{ flex: 1 }}
                      value={row.concept}
                      onChange={(e) =>
                        setCalcItems((prev) =>
                          prev.map((it) => (it.id === row.id ? { ...it, concept: e.target.value } : it))
                        )
                      }
                    />
                    <input
                      type="number"
                      step="0.01"
                      className="prop-input"
                      style={{ width: 135, textAlign: 'right', fontFamily: 'var(--font-mono)' }}
                      value={row.amount}
                      onChange={(e) =>
                        setCalcItems((prev) =>
                          prev.map((it) => (it.id === row.id ? { ...it, amount: e.target.value } : it))
                        )
                      }
                    />
                    <button
                      type="button"
                      className="btn icon-only"
                      style={{ color: 'var(--danger)' }}
                      disabled={calcItems.length <= 1}
                      onClick={() =>
                        setCalcItems((prev) => prev.filter((it) => it.id !== row.id))
                      }
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>

              <div className="setting-card" style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span className="prop-label">Tasa IVA (%):</span>
                    <input
                      type="number"
                      className="prop-input"
                      style={{ width: 72 }}
                      value={taxRate}
                      onChange={(e) => setTaxRate(Number(e.target.value) || 0)}
                    />
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={applyRetentionIsr}
                      onChange={(e) => setApplyRetentionIsr(e.target.checked)}
                    />
                    <span>Aplicar Retención ISR (10%)</span>
                  </label>
                </div>

                <button
                  type="button"
                  className="btn btn-subtle"
                  onClick={() => {
                    navigator.clipboard.writeText(buildAccountingStampSummary());
                    onNotify('Cédula contable copiada al portapapeles.');
                  }}
                >
                  <Copy size={13.5} />
                  <span>Copiar desglose</span>
                </button>
              </div>

              <div
                style={{
                  background: 'var(--bg-surface-subtle)',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 'var(--radius-md)',
                  padding: '12px 16px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 12.5,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>SUBTOTAL:</span>
                  <strong>{formatMoney(subtotal)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>IVA ({taxRate}%):</span>
                  <strong>{formatMoney(ivaAmount)}</strong>
                </div>
                {applyRetentionIsr && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--warning)' }}>
                    <span>RETENCIÓN ISR (10%):</span>
                    <strong>-{formatMoney(retIsr)}</strong>
                  </div>
                )}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    borderTop: '1px solid var(--border-strong)',
                    paddingTop: 6,
                    marginTop: 4,
                    fontSize: 14,
                    color: 'var(--accent)',
                  }}
                >
                  <strong>TOTAL NETO VERIFICADO:</strong>
                  <strong>{formatMoney(grandTotal)}</strong>
                </div>
              </div>
            </div>
          )}

          {/* PDF TO WORD (.DOCX / .TXT) */}
          {kind === 'pdf-to-word' && (
            <div>
              {!activeTab ? (
                renderSelectPdfPrompt(
                  'Convierte cualquier contrato, reporte o cotización PDF en un documento Microsoft Word (.docx) 100% editable sin subir archivos a internet.'
                )
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div className="setting-card">
                    <div>
                      <div className="setting-card-title">{activeTab.fileName}</div>
                      <div className="setting-card-desc">
                        {wordStats.pages} página(s) · {wordStats.lines} renglones estructurados ·{' '}
                        {wordStats.tables} bloque(s) tabulares detectados (incluye tus ediciones en vivo).
                      </div>
                    </div>
                    <FileText size={20} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <button
                      type="button"
                      className={`action-card ${wordFormat === 'docx' ? 'active' : ''}`}
                      style={{
                        padding: 14,
                        borderColor:
                          wordFormat === 'docx' ? 'var(--accent)' : 'var(--border-subtle)',
                        background:
                          wordFormat === 'docx' ? 'var(--accent-soft)' : 'var(--bg-surface-subtle)',
                      }}
                      onClick={() => setWordFormat('docx')}
                    >
                      <div className="action-card-title">Microsoft Word (.docx)</div>
                      <div className="action-card-desc">
                        Conserva encabezados, negritas, tablas editables reales y saltos de página para Word o LibreOffice.
                      </div>
                    </button>

                    <button
                      type="button"
                      className={`action-card ${wordFormat === 'txt' ? 'active' : ''}`}
                      style={{
                        padding: 14,
                        borderColor:
                          wordFormat === 'txt' ? 'var(--accent)' : 'var(--border-subtle)',
                        background:
                          wordFormat === 'txt' ? 'var(--accent-soft)' : 'var(--bg-surface-subtle)',
                      }}
                      onClick={() => setWordFormat('txt')}
                    >
                      <div className="action-card-title">Texto Limpio (.txt)</div>
                      <div className="action-card-desc">
                        Extrae todo el contenido textual limpio en orden de lectura natural listo para copiar o archivar.
                      </div>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* PDF TABLES TO EXCEL CSV */}
          {kind === 'export-csv' && (
            <div>
              {!activeTab ? (
                renderSelectPdfPrompt(
                  'Extrae al instante tablas de facturas, presupuestos o estados de cuenta PDF a un archivo compatible con Microsoft Excel.'
                )
              ) : (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
                      Filas tabulares detectadas automáticamente: <strong>{csvRowCount}</strong>
                    </span>
                    <select
                      className="prop-select"
                      value={csvScope}
                      onChange={(e) => setCsvScope(e.target.value as 'current' | 'all')}
                    >
                      <option value="all">Todas las páginas del PDF ({activeTab.pages.length})</option>
                      <option value="current">Solo página actual (Pág. {activeTab.currentPageIndex + 1})</option>
                    </select>
                  </div>

                  <textarea
                    readOnly
                    spellCheck={false}
                    className="prop-input"
                    style={{
                      width: '100%',
                      height: 210,
                      padding: 10,
                      fontFamily: 'var(--font-mono)',
                      fontSize: 11.5,
                      lineHeight: 1.45,
                      resize: 'vertical',
                    }}
                    value={csvPreview || 'Analizando estructura de columnas del PDF…'}
                  />
                </div>
              )}
            </div>
          )}

          {/* MERGE */}
          {kind === 'merge' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
                  Ordena los documentos de arriba hacia abajo antes de combinarlos en un solo PDF:
                </span>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleAddPdfsToMerge}
                >
                  <FilePlus size={14} />
                  <span>Agregar PDFs…</span>
                </button>
              </div>

              {mergeList.length === 0 ? (
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDropHover(true);
                  }}
                  onDragLeave={() => setDropHover(false)}
                  onDrop={async (e) => {
                    e.preventDefault();
                    setDropHover(false);
                    const pdfs = Array.from(e.dataTransfer.files || []).filter(
                      (f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
                    );
                    const items: Array<{ id: string; fileName: string; bytes: Uint8Array }> = [];
                    for (let i = 0; i < pdfs.length; i++) {
                      const buf = await pdfs[i].arrayBuffer();
                      items.push({
                        id: `drop_${Date.now()}_${i}`,
                        fileName: pdfs[i].name,
                        bytes: new Uint8Array(buf),
                      });
                    }
                    if (items.length > 0) setMergeList((prev) => [...prev, ...items]);
                  }}
                  style={{
                    padding: 28,
                    textAlign: 'center',
                    border: `1.5px dashed ${dropHover ? 'var(--accent)' : 'var(--border-strong)'}`,
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--text-muted)',
                    fontSize: 12.5,
                  }}
                >
                  Arrastra aquí dos o más archivos PDF o haz clic en "Agregar PDFs…" arriba.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {mergeList.map((item, idx) => (
                    <div
                      key={item.id}
                      className="setting-card"
                      style={{ marginBottom: 0, padding: '10px 14px' }}
                    >
                      <span style={{ fontSize: 12.5, fontWeight: 600 }}>
                        {idx + 1}. {item.fileName}{' '}
                        <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: 11 }}>
                          ({formatSize(item.bytes.byteLength)})
                        </span>
                      </span>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button
                          type="button"
                          className="btn icon-only"
                          disabled={idx === 0}
                          onClick={() => {
                            const copy = [...mergeList];
                            [copy[idx - 1], copy[idx]] = [copy[idx], copy[idx - 1]];
                            setMergeList(copy);
                          }}
                        >
                          <ArrowUp size={13} />
                        </button>
                        <button
                          type="button"
                          className="btn icon-only"
                          disabled={idx === mergeList.length - 1}
                          onClick={() => {
                            const copy = [...mergeList];
                            [copy[idx + 1], copy[idx]] = [copy[idx], copy[idx + 1]];
                            setMergeList(copy);
                          }}
                        >
                          <ArrowDown size={13} />
                        </button>
                        <button
                          type="button"
                          className="btn icon-only"
                          style={{ color: 'var(--danger)' }}
                          onClick={() =>
                            setMergeList((prev) => prev.filter((x) => x.id !== item.id))
                          }
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* SPLIT */}
          {kind === 'split' && (
            <div>
              {!activeTab ? (
                renderSelectPdfPrompt(
                  'Extrae un rango personalizado de páginas o divide un PDF extenso en archivos individuales empaquetados en ZIP.'
                )
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
                    Documento actual: <strong>{activeTab.fileName}</strong> ({activeTab.pages.length}{' '}
                    páginas).
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <button
                      type="button"
                      className="action-card"
                      style={{
                        padding: 14,
                        borderColor:
                          splitMode === 'range' ? 'var(--accent)' : 'var(--border-subtle)',
                        background:
                          splitMode === 'range' ? 'var(--accent-soft)' : 'var(--bg-surface-subtle)',
                      }}
                      onClick={() => setSplitMode('range')}
                    >
                      <div className="action-card-title">Extraer rango en un PDF</div>
                      <div className="action-card-desc">
                        Genera un nuevo PDF únicamente con las páginas indicadas (ej. 1-3, 5).
                      </div>
                    </button>

                    <button
                      type="button"
                      className="action-card"
                      style={{
                        padding: 14,
                        borderColor:
                          splitMode === 'every-n' ? 'var(--accent)' : 'var(--border-subtle)',
                        background:
                          splitMode === 'every-n'
                            ? 'var(--accent-soft)'
                            : 'var(--bg-surface-subtle)',
                      }}
                      onClick={() => setSplitMode('every-n')}
                    >
                      <div className="action-card-title">Separar en PDFs individuales (.zip)</div>
                      <div className="action-card-desc">
                        Divide cada N páginas en archivos PDF independientes listos para descargar.
                      </div>
                    </button>
                  </div>

                  {splitMode === 'range' ? (
                    <div>
                      <div className="prop-label" style={{ marginBottom: 6 }}>
                        Páginas o rangos separados por coma:
                      </div>
                      <input
                        type="text"
                        className="prop-input"
                        style={{ width: '100%', height: 38, fontSize: 14 }}
                        placeholder="Ejemplo: 1-3, 5, 8-12"
                        value={rangeSpec}
                        onChange={(e) => setRangeSpec(e.target.value)}
                      />
                    </div>
                  ) : (
                    <div className="prop-row">
                      <span className="prop-label">Cantidad de páginas por cada archivo PDF:</span>
                      <input
                        type="number"
                        min={1}
                        max={Math.max(1, activeTab.pages.length)}
                        className="prop-input"
                        style={{ width: 96 }}
                        value={splitEveryN}
                        onChange={(e) => setSplitEveryN(Math.max(1, Number(e.target.value) || 1))}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* REMOVE PAGES */}
          {kind === 'remove-pages' && (
            <div>
              {!activeTab ? (
                renderSelectPdfPrompt(
                  'Selecciona visualmente qué páginas deseas quitar de tu PDF con vista previa inmediata.'
                )
              ) : activeTab.pages.length <= 1 ? (
                <div className="setting-card">
                  <div>
                    <div className="setting-card-title">Este PDF solo contiene 1 página</div>
                    <div className="setting-card-desc">
                      Abre un documento de 2 o más páginas para eliminar hojas específicas.
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: 8,
                    }}
                  >
                    <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
                      Haz clic sobre las páginas que deseas eliminar ({deleteIndices.length} de{' '}
                      {activeTab.pages.length} marcadas):
                    </span>
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="btn btn-subtle"
                        style={{ height: 26, fontSize: 11.5 }}
                        onClick={() =>
                          setDeleteIndices(
                            activeTab.pages
                              .map((_, i) => i)
                              .filter((i) => (i + 1) % 2 === 0)
                              .slice(0, activeTab.pages.length - 1)
                          )
                        }
                      >
                        Pares
                      </button>
                      <button
                        type="button"
                        className="btn btn-subtle"
                        style={{ height: 26, fontSize: 11.5 }}
                        onClick={() =>
                          setDeleteIndices([activeTab.pages.length - 1])
                        }
                      >
                        Última pág.
                      </button>
                      <button
                        type="button"
                        className="btn btn-subtle"
                        style={{ height: 26, fontSize: 11.5 }}
                        onClick={() => {
                          setDeleteIndices([]);
                          setDeleteRangeInput('');
                        }}
                      >
                        Limpiar
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span className="prop-label" style={{ whiteSpace: 'nowrap' }}>
                      O escribe rango a borrar:
                    </span>
                    <input
                      type="text"
                      className="prop-input"
                      style={{ flex: 1 }}
                      placeholder="Ej. 2, 4-6"
                      value={deleteRangeInput}
                      onChange={(e) => {
                        const val = e.target.value;
                        setDeleteRangeInput(val);
                        const parsed = parsePageRangeSpec(val, activeTab.pages.length);
                        if (parsed.length < activeTab.pages.length) {
                          setDeleteIndices(parsed);
                        }
                      }}
                    />
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(122px, 1fr))',
                      gap: 10,
                      maxHeight: 300,
                      overflowY: 'auto',
                      padding: 4,
                    }}
                  >
                    {activeTab.pages.map((pd, idx) => {
                      const marked = deleteIndices.includes(idx);
                      return (
                        <button
                          key={pd.id}
                          type="button"
                          onClick={() =>
                            setDeleteIndices((prev) =>
                              prev.includes(idx)
                                ? prev.filter((x) => x !== idx)
                                : [...prev, idx].sort((a, b) => a - b)
                            )
                          }
                          style={{
                            border: `1.5px solid ${marked ? '#dc2626' : 'var(--border-subtle)'}`,
                            background: marked ? 'rgba(220,38,38,0.06)' : 'var(--bg-surface-subtle)',
                            borderRadius: 'var(--radius-md)',
                            padding: 8,
                            cursor: 'pointer',
                            textAlign: 'center',
                          }}
                        >
                          <RemovePageThumb
                            tab={activeTab}
                            pageDesc={pd}
                            markedForDelete={marked}
                          />
                          <div
                            style={{
                              fontSize: 11.5,
                              fontWeight: 600,
                              marginTop: 6,
                              color: marked ? '#dc2626' : 'var(--text-primary)',
                            }}
                          >
                            Página {idx + 1}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* CROP MARGINS */}
          {kind === 'crop' && (
            <div>
              {!activeTab ? (
                renderSelectPdfPrompt(
                  'Recorta bordes blancos sobrantes o marcas de impresión de tu PDF con precisión milimétrica.'
                )
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div className="setting-card">
                    <div>
                      <div className="setting-card-title">Ámbito del recorte de márgenes</div>
                      <div className="setting-card-desc">
                        Ajusta los milímetros a recortar en cada borde. Se previsualiza en el lienzo y se aplica al exportar.
                      </div>
                    </div>
                    <select
                      className="prop-select"
                      value={cropScope}
                      onChange={(e) => setCropScope(e.target.value as 'all' | 'current')}
                    >
                      <option value="all">Todas las páginas ({activeTab.pages.length})</option>
                      <option value="current">
                        Solo página actual (Pág. {activeTab.currentPageIndex + 1})
                      </option>
                    </select>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div className="prop-row">
                      <span className="prop-label">Margen Superior (mm)</span>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        className="prop-input"
                        style={{ width: 90 }}
                        value={cropMm.top}
                        onChange={(e) =>
                          setCropMm({ ...cropMm, top: Math.max(0, Number(e.target.value) || 0) })
                        }
                      />
                    </div>
                    <div className="prop-row">
                      <span className="prop-label">Margen Inferior (mm)</span>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        className="prop-input"
                        style={{ width: 90 }}
                        value={cropMm.bottom}
                        onChange={(e) =>
                          setCropMm({ ...cropMm, bottom: Math.max(0, Number(e.target.value) || 0) })
                        }
                      />
                    </div>
                    <div className="prop-row">
                      <span className="prop-label">Margen Izquierdo (mm)</span>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        className="prop-input"
                        style={{ width: 90 }}
                        value={cropMm.left}
                        onChange={(e) =>
                          setCropMm({ ...cropMm, left: Math.max(0, Number(e.target.value) || 0) })
                        }
                      />
                    </div>
                    <div className="prop-row">
                      <span className="prop-label">Margen Derecho (mm)</span>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        className="prop-input"
                        style={{ width: 90 }}
                        value={cropMm.right}
                        onChange={(e) =>
                          setCropMm({ ...cropMm, right: Math.max(0, Number(e.target.value) || 0) })
                        }
                      />
                    </div>
                  </div>

                  <div>
                    <button
                      type="button"
                      className="btn btn-subtle"
                      onClick={() => setCropMm({ top: 0, right: 0, bottom: 0, left: 0 })}
                    >
                      <RotateCcw size={13.5} />
                      <span>Restablecer márgenes a 0 mm</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* OPTIMIZE / COMPRESS PDF */}
          {kind === 'optimize' && (
            <div>
              {!activeTab ? (
                renderSelectPdfPrompt(
                  'Reduce el peso de archivos PDF pesados para enviarlos por correo o portales oficiales manteniendo nitidez.'
                )
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                    {(
                      [
                        {
                          id: 'lossless',
                          title: 'Sin Pérdida Vectorial',
                          desc: 'Limpia flujos internos y objetos huérfanos manteniendo 100% calidad vectorial.',
                        },
                        {
                          id: 'balanced',
                          title: 'Recomendada (144 DPI)',
                          desc: 'Equilibrio óptimo de peso reducido y alta legibilidad para correo y trámites.',
                        },
                        {
                          id: 'extreme',
                          title: 'Extrema (102 DPI)',
                          desc: 'Máxima reducción de tamaño para portales con límite estricto de megabytes.',
                        },
                      ] as Array<{ id: CompressionLevel; title: string; desc: string }>
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        className="action-card"
                        style={{
                          padding: 13,
                          borderColor:
                            compLevel === opt.id ? 'var(--accent)' : 'var(--border-subtle)',
                          background:
                            compLevel === opt.id
                              ? 'var(--accent-soft)'
                              : 'var(--bg-surface-subtle)',
                        }}
                        onClick={() => {
                          setCompLevel(opt.id);
                          setCompResult(null);
                        }}
                      >
                        <div className="action-card-title" style={{ fontSize: 13 }}>
                          {opt.title}
                        </div>
                        <div className="action-card-desc" style={{ fontSize: 11.5 }}>
                          {opt.desc}
                        </div>
                      </button>
                    ))}
                  </div>

                  <div className="setting-card">
                    <div>
                      <div className="setting-card-title">
                        Aplanar documento como solo lectura (Flatten PDF)
                      </div>
                      <div className="setting-card-desc">
                        Fusiona firmas, sellos y textos editados en una sola capa fija imposible de alterar por terceros.
                      </div>
                    </div>
                    <button
                      type="button"
                      className={`switch ${flattenReadOnly ? 'on' : ''}`}
                      onClick={() => {
                        setFlattenReadOnly((v) => !v);
                        setCompResult(null);
                      }}
                    />
                  </div>

                  {compResult && (
                    <div
                      style={{
                        padding: '14px 16px',
                        borderRadius: 'var(--radius-md)',
                        background: 'var(--success-soft)',
                        border: '1px solid rgba(13, 122, 95, 0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: 10,
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--success)' }}>
                          PDF optimizado: {formatSize(compResult.originalBytes)} →{' '}
                          {formatSize(compResult.compressedBytes)}
                          {compResult.compressedBytes < compResult.originalBytes
                            ? ` (−${Math.round(
                                (1 - compResult.compressedBytes / compResult.originalBytes) * 100
                              )}%)`
                            : ' (Estructura compactada)'}
                        </div>
                        <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                          Procesado 100% en tu equipo sin conexión externa.
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          type="button"
                          className="btn btn-subtle"
                          onClick={() => {
                            const base = activeTab.fileName.replace(/\.pdf$/i, '');
                            onOpenGeneratedPdfInTab(
                              `${base}_comprimido.pdf`,
                              compResult.bytes
                            );
                            onClose();
                          }}
                        >
                          Abrir en pestaña
                        </button>
                        <button
                          type="button"
                          className="btn btn-primary"
                          onClick={async () => {
                            const base = activeTab.fileName.replace(/\.pdf$/i, '');
                            await savePdfBytesToDisk(
                              compResult.bytes,
                              `${base}_comprimido.pdf`
                            );
                            onClose();
                          }}
                        >
                          <Download size={14} />
                          <span>Guardar PDF</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* WATERMARK */}
          {kind === 'watermark' && (
            <div>
              {!activeTab ? (
                renderSelectPdfPrompt(
                  'Aplica marcas de agua diagonales o en mosaico con control exacto de opacidad, rotación y tipografía.'
                )
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div className="setting-card">
                    <div>
                      <div className="setting-card-title">Activar marca de agua en el documento</div>
                      <div className="setting-card-desc">
                        Se previsualiza en tiempo real y se estampa al guardar el PDF.
                      </div>
                    </div>
                    <button
                      type="button"
                      className={`switch ${wm.enabled ? 'on' : ''}`}
                      onClick={() => setWm((prev) => ({ ...prev, enabled: !prev.enabled }))}
                    />
                  </div>

                  <div className="prop-row">
                    <span className="prop-label">Texto de la marca</span>
                    <input
                      type="text"
                      className="prop-input"
                      style={{ width: 280 }}
                      value={wm.text}
                      onChange={(e) => setWm({ ...wm, text: e.target.value, enabled: true })}
                    />
                  </div>

                  <div className="prop-row">
                    <span className="prop-label">Color y Transparencia ({Math.round(wm.opacity * 100)}%)</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <input
                        type="color"
                        value={wm.color}
                        onChange={(e) => setWm({ ...wm, color: e.target.value })}
                      />
                      <input
                        type="range"
                        min={0.05}
                        max={0.65}
                        step={0.02}
                        value={wm.opacity}
                        onChange={(e) => setWm({ ...wm, opacity: Number(e.target.value) })}
                      />
                    </div>
                  </div>

                  <div className="prop-row">
                    <span className="prop-label">Tamaño ({wm.fontSizePt} pt) e Inclinación ({wm.rotation}°)</span>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input
                        type="number"
                        className="prop-input"
                        style={{ width: 78 }}
                        value={wm.fontSizePt}
                        onChange={(e) =>
                          setWm({ ...wm, fontSizePt: Number(e.target.value) || 44 })
                        }
                      />
                      <input
                        type="number"
                        className="prop-input"
                        style={{ width: 78 }}
                        value={wm.rotation}
                        onChange={(e) => setWm({ ...wm, rotation: Number(e.target.value) || 0 })}
                      />
                    </div>
                  </div>

                  <div className="prop-row">
                    <span className="prop-label">Repetir en mosaico por toda la hoja</span>
                    <button
                      type="button"
                      className={`switch ${wm.tiled ? 'on' : ''}`}
                      onClick={() => setWm((prev) => ({ ...prev, tiled: !prev.tiled }))}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* NUMBERING / BATES */}
          {kind === 'numbering' && (
            <div>
              {!activeTab ? (
                renderSelectPdfPrompt(
                  'Numera automáticamente todas las páginas o agrega folios consecutivos Bates y encabezados corporativos.'
                )
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div className="setting-card">
                    <div>
                      <div className="setting-card-title">Mostrar encabezados y numeración</div>
                      <div className="setting-card-desc">
                        Numera automáticamente todas las páginas al guardar.
                      </div>
                    </div>
                    <button
                      type="button"
                      className={`switch ${hf.enabled ? 'on' : ''}`}
                      onClick={() => setHf((p) => ({ ...p, enabled: !p.enabled }))}
                    />
                  </div>

                  <div className="prop-row">
                    <span className="prop-label">Encabezado izquierdo</span>
                    <input
                      type="text"
                      className="prop-input"
                      style={{ width: 260 }}
                      placeholder="Ej. Dirección Corporativa"
                      value={hf.headerLeft}
                      onChange={(e) => setHf({ ...hf, headerLeft: e.target.value, enabled: true })}
                    />
                  </div>

                  <div className="prop-row">
                    <span className="prop-label">Encabezado derecho</span>
                    <input
                      type="text"
                      className="prop-input"
                      style={{ width: 260 }}
                      placeholder="Ej. Expediente Oficial"
                      value={hf.headerRight}
                      onChange={(e) => setHf({ ...hf, headerRight: e.target.value, enabled: true })}
                    />
                  </div>

                  <div className="prop-row">
                    <span className="prop-label">Formato de pie de página</span>
                    <select
                      className="prop-select"
                      style={{ width: 260 }}
                      value={hf.footerCenterPattern}
                      onChange={(e) =>
                        setHf({
                          ...hf,
                          footerCenterPattern: e.target.value as HeaderFooterConfig['footerCenterPattern'],
                          enabled: true,
                        })
                      }
                    >
                      <option value="page-of-total">Página 1 de N</option>
                      <option value="number-only">Solo número (1, 2, 3…)</option>
                      <option value="bates">Folio Legal Bates (KOVA-00001)</option>
                      <option value="custom">Texto personalizado</option>
                    </select>
                  </div>

                  {hf.footerCenterPattern === 'bates' && (
                    <div className="prop-row">
                      <span className="prop-label">Prefijo y folio inicial</span>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <input
                          type="text"
                          className="prop-input"
                          style={{ width: 120 }}
                          value={hf.batesPrefix}
                          onChange={(e) => setHf({ ...hf, batesPrefix: e.target.value })}
                        />
                        <input
                          type="number"
                          className="prop-input"
                          style={{ width: 90 }}
                          value={hf.batesStart}
                          onChange={(e) =>
                            setHf({ ...hf, batesStart: Number(e.target.value) || 1 })
                          }
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* IMAGES TO PDF */}
          {kind === 'images-to-pdf' && (
            <div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 8,
                  marginBottom: 14,
                }}
              >
                <label className="btn btn-primary" style={{ cursor: 'pointer' }}>
                  <ImagePlus size={14} />
                  <span>Seleccionar imágenes…</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    style={{ display: 'none' }}
                    onChange={(e) =>
                      setImageFiles((prev) => [
                        ...prev,
                        ...Array.from(e.target.files || []),
                      ])
                    }
                  />
                </label>

                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <select
                    className="prop-select"
                    value={pagePreset}
                    onChange={(e) => setPagePreset(e.target.value as 'a4' | 'letter' | 'fit')}
                  >
                    <option value="a4">Hoja A4</option>
                    <option value="letter">Hoja Carta (Letter)</option>
                    <option value="fit">Tamaño exacto de imagen</option>
                  </select>

                  {pagePreset !== 'fit' && (
                    <>
                      <select
                        className="prop-select"
                        value={imgOrientation}
                        onChange={(e) =>
                          setImgOrientation(e.target.value as 'auto' | 'portrait' | 'landscape')
                        }
                      >
                        <option value="auto">Orientación Automática</option>
                        <option value="portrait">Vertical</option>
                        <option value="landscape">Horizontal</option>
                      </select>
                      <select
                        className="prop-select"
                        value={imgMarginPt}
                        onChange={(e) => setImgMarginPt(Number(e.target.value))}
                      >
                        <option value={0}>Sin margen</option>
                        <option value={28}>Margen limpio</option>
                        <option value={52}>Margen amplio</option>
                      </select>
                    </>
                  )}
                </div>
              </div>

              {imageFiles.length === 0 ? (
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDropHover(true);
                  }}
                  onDragLeave={() => setDropHover(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDropHover(false);
                    const imgs = Array.from(e.dataTransfer.files || []).filter((f) =>
                      f.type.startsWith('image/')
                    );
                    if (imgs.length > 0) setImageFiles((prev) => [...prev, ...imgs]);
                  }}
                  style={{
                    padding: 28,
                    textAlign: 'center',
                    border: `1.5px dashed ${dropHover ? 'var(--accent)' : 'var(--border-strong)'}`,
                    borderRadius: 'var(--radius-md)',
                    fontSize: 12.5,
                    color: 'var(--text-muted)',
                  }}
                >
                  Arrastra o selecciona una o varias imágenes PNG, JPG o WebP para generar un PDF impecable.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 4 }}>
                    {imageFiles.length} imagen(es) listas para convertir:
                  </div>
                  {imageFiles.map((f, i) => (
                    <div
                      key={`${f.name}_${i}`}
                      className="setting-card"
                      style={{ marginBottom: 0, padding: '8px 12px' }}
                    >
                      <span style={{ fontSize: 12 }}>
                        {i + 1}. {f.name} ({formatSize(f.size)})
                      </span>
                      <button
                        type="button"
                        className="btn icon-only"
                        style={{ color: 'var(--danger)', width: 24, height: 24 }}
                        onClick={() =>
                          setImageFiles((prev) => prev.filter((_, idx) => idx !== i))
                        }
                      >
                        <Trash2 size={12.5} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* PDF TO IMAGES */}
          {kind === 'pdf-to-images' && (
            <div>
              {!activeTab ? (
                renderSelectPdfPrompt(
                  'Exporta todas las páginas de tu PDF como imágenes PNG sin pérdida o JPG de alta definición en un paquete ZIP.'
                )
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div className="prop-row">
                    <span className="prop-label">Resolución de imagen (Nitidez)</span>
                    <select
                      className="prop-select"
                      value={imgDpi}
                      onChange={(e) => setImgDpi(Number(e.target.value) as 150 | 300 | 600)}
                    >
                      <option value={150}>150 DPI (Rápido / Web)</option>
                      <option value={300}>300 DPI (Alta Calidad Impresión)</option>
                      <option value={600}>600 DPI (Ultra Nitidez)</option>
                    </select>
                  </div>
                  <div className="prop-row">
                    <span className="prop-label">Formato de salida</span>
                    <select
                      className="prop-select"
                      value={imgFormat}
                      onChange={(e) => setImgFormat(e.target.value as 'png' | 'jpeg')}
                    >
                      <option value="png">PNG sin pérdida</option>
                      <option value="jpeg">JPG ligero</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* OCR */}
          {kind === 'ocr' && (
            <div>
              {!activeTab ? (
                renderSelectPdfPrompt(
                  'Reconoce texto ópticamente en páginas escaneadas o fotografías dentro de un PDF.'
                )
              ) : (
                <div>
                  <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                    <select
                      className="prop-select"
                      value={ocrPageIdx}
                      onChange={(e) => setOcrPageIdx(Number(e.target.value))}
                    >
                      {activeTab.pages.map((_, idx) => (
                        <option key={idx} value={idx}>
                          Página {idx + 1}
                        </option>
                      ))}
                    </select>
                    <select
                      className="prop-select"
                      value={ocrLang}
                      onChange={(e) => setOcrLang(e.target.value as 'spa' | 'eng')}
                    >
                      <option value="spa">Español</option>
                      <option value="eng">Inglés</option>
                    </select>
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={busy}
                      onClick={handleRunOcr}
                    >
                      <ScanText size={14} />
                      <span>Iniciar OCR</span>
                    </button>
                  </div>

                  {ocrProgress && (
                    <div style={{ fontSize: 11.5, color: 'var(--accent)', marginBottom: 8 }}>
                      {ocrProgress}
                    </div>
                  )}

                  <textarea
                    className="prop-input"
                    spellCheck={false}
                    style={{ width: '100%', height: 170, padding: 10, resize: 'vertical' }}
                    placeholder="El texto reconocido aparecerá aquí listo para copiar…"
                    value={ocrText}
                    onChange={(e) => setOcrText(e.target.value)}
                  />

                  {ocrText && (
                    <button
                      type="button"
                      className="btn btn-subtle"
                      style={{ marginTop: 8 }}
                      onClick={() => {
                        navigator.clipboard.writeText(ocrText);
                        onNotify('Texto copiado al portapapeles.');
                      }}
                    >
                      <Copy size={13.5} />
                      <span>Copiar texto</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* METADATA & PRIVACY */}
          {kind === 'metadata' && (
            <div>
              {!activeTab ? (
                renderSelectPdfPrompt(
                  'Inspecciona o limpia metadatos ocultos de autoría antes de compartir documentos confidenciales.'
                )
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div className="prop-row">
                    <span className="prop-label">Título</span>
                    <input
                      type="text"
                      className="prop-input"
                      style={{ width: 340 }}
                      value={meta.title}
                      onChange={(e) => setMeta({ ...meta, title: e.target.value })}
                    />
                  </div>
                  <div className="prop-row">
                    <span className="prop-label">Autor / Empresa</span>
                    <input
                      type="text"
                      className="prop-input"
                      style={{ width: 340 }}
                      value={meta.author}
                      onChange={(e) => setMeta({ ...meta, author: e.target.value })}
                    />
                  </div>
                  <div className="prop-row">
                    <span className="prop-label">Asunto</span>
                    <input
                      type="text"
                      className="prop-input"
                      style={{ width: 340 }}
                      value={meta.subject}
                      onChange={(e) => setMeta({ ...meta, subject: e.target.value })}
                    />
                  </div>
                  <div className="prop-row">
                    <span className="prop-label">Palabras clave</span>
                    <input
                      type="text"
                      className="prop-input"
                      style={{ width: 340 }}
                      value={meta.keywords}
                      onChange={(e) => setMeta({ ...meta, keywords: e.target.value })}
                    />
                  </div>

                  <div className="setting-card" style={{ marginTop: 6 }}>
                    <div>
                      <div className="setting-card-title">Limpieza Total de Privacidad</div>
                      <div className="setting-card-desc">
                        Borra autor, organización y metadatos ocultos de este documento de inmediato.
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn btn-subtle"
                      onClick={() => {
                        const cleaned: DocumentMetadata = {
                          title: '',
                          author: '',
                          subject: '',
                          keywords: '',
                          creator: 'Kova PDF',
                          producer: 'Kova PDF Native Engine',
                        };
                        setMeta(cleaned);
                        onUpdateMetadata(cleaned, true);
                        onNotify('Metadatos privados eliminados.');
                      }}
                    >
                      <ShieldCheck size={14} />
                      <span>Limpiar Rastro</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-subtle" onClick={onClose}>
            Cerrar
          </button>

          {kind === 'calculator' && activeTab && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                onInsertAccountingSummaryOnPage(buildAccountingStampSummary());
                onClose();
              }}
            >
              <Calculator size={14} />
              <span>Insertar Cédula Contable en el PDF</span>
            </button>
          )}

          {kind === 'pdf-to-word' && activeTab && (
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy}
              onClick={handleRunPdfToWord}
            >
              <Download size={14} />
              <span>
                {wordFormat === 'docx'
                  ? 'Descargar Word Editable (.docx)'
                  : 'Descargar Texto (.txt)'}
              </span>
            </button>
          )}

          {kind === 'export-csv' && activeTab && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleDownloadCsv}
            >
              <FileSpreadsheet size={14} />
              <span>Descargar Tabla Excel (.csv)</span>
            </button>
          )}

          {kind === 'merge' && (
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy || mergeList.length < 2}
              onClick={handleRunMerge}
            >
              <Check size={14} />
              <span>Combinar {mergeList.length} PDFs</span>
            </button>
          )}

          {kind === 'split' && activeTab && (
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy}
              onClick={handleRunSplit}
            >
              <Scissors size={14} />
              <span>
                {splitMode === 'every-n'
                  ? 'Dividir y Descargar (.zip)'
                  : 'Extraer Rango'}
              </span>
            </button>
          )}

          {kind === 'remove-pages' && activeTab && activeTab.pages.length > 1 && (
            <button
              type="button"
              className="btn btn-primary"
              style={{ background: '#dc2626' }}
              disabled={
                deleteIndices.length === 0 ||
                deleteIndices.length >= activeTab.pages.length
              }
              onClick={handleRunRemovePages}
            >
              <Trash2 size={14} />
              <span>Eliminar {deleteIndices.length} página(s)</span>
            </button>
          )}

          {kind === 'crop' && activeTab && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleRunCrop}
            >
              <Crop size={14} />
              <span>Aplicar Recorte</span>
            </button>
          )}

          {kind === 'optimize' && activeTab && (
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy}
              onClick={handleRunCompress}
            >
              <FileDown size={14} />
              <span>{busy ? 'Comprimiendo…' : 'Comprimir PDF Ahora'}</span>
            </button>
          )}

          {kind === 'watermark' && activeTab && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                onUpdateWatermark(wm);
                onNotify('Marca de agua aplicada al documento.');
                onClose();
              }}
            >
              <Check size={14} />
              <span>Aplicar Marca de Agua</span>
            </button>
          )}

          {kind === 'numbering' && activeTab && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                onUpdateHeaderFooter(hf);
                onNotify('Numeración y encabezados actualizados.');
                onClose();
              }}
            >
              <Check size={14} />
              <span>Aplicar Numeración</span>
            </button>
          )}

          {kind === 'images-to-pdf' && (
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy || imageFiles.length === 0}
              onClick={handleRunImagesToPdf}
            >
              <Check size={14} />
              <span>Crear PDF</span>
            </button>
          )}

          {kind === 'pdf-to-images' && activeTab && (
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy}
              onClick={handleRunPdfToImages}
            >
              <Download size={14} />
              <span>Descargar ZIP ({imgDpi} DPI)</span>
            </button>
          )}

          {kind === 'metadata' && activeTab && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                onUpdateMetadata(meta);
                onNotify('Propiedades del PDF actualizadas.');
                onClose();
              }}
            >
              <Check size={14} />
              <span>Guardar Propiedades</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
