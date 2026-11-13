import React, { useEffect, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Building2,
  Calculator,
  Check,
  Copy,
  Download,
  FilePlus,
  FileSpreadsheet,
  ImagePlus,
  Plus,
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
import { extractTabTablesToCsv, renderPageToCanvas } from '../utils/pdfEngine';
import {
  exportTabPagesToImagesZip,
  extractSelectedPagesAsPdf,
  mergeMultiplePdfBuffers,
  parsePageRangeSpec,
} from '../utils/pdfExporter';
import { downloadBlobInBrowser, openPdfFilesWithDialog } from '../utils/tauriBridge';

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
  onUpdateWatermark: (wm: WatermarkConfig) => void;
  onUpdateHeaderFooter: (hf: HeaderFooterConfig) => void;
  onUpdateMetadata: (meta: DocumentMetadata, cleanNow?: boolean) => void;
  onNotify: (msg: string) => void;
  onClose: () => void;
}

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
  onUpdateWatermark,
  onUpdateHeaderFooter,
  onUpdateMetadata,
  onNotify,
  onClose,
}) => {
  const [busy, setBusy] = useState(false);

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
  const [rangeSpec, setRangeSpec] = useState('1-2');

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
      batesPrefix: 'LEF-',
      batesStart: 1,
      customFooter: 'Página {page} de {total}',
      fontSizePt: 9.5,
      color: '#525866',
    }
  );

  // Images -> PDF state
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [pagePreset, setPagePreset] = useState<'a4' | 'letter' | 'fit'>('a4');

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
      creator: 'PDF-LEF',
      producer: 'PDF-LEF Native Engine',
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
      'CEDULA DE REVISION CONTABLE · PDF-LEF',
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
    // UTF-8 BOM ensures Microsoft Excel on Windows opens accents & columns cleanly
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
      onOpenGeneratedPdfInTab('Documento_Combinado_LEF.pdf', mergedBytes);
      onNotify('PDFs combinados correctamente en una nueva pestaña.');
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const handleRunSplit = async () => {
    if (!activeTab) return;
    const indices = parsePageRangeSpec(rangeSpec, activeTab.pages.length);
    if (indices.length === 0) {
      onNotify('Rango de páginas no válido.');
      return;
    }
    setBusy(true);
    try {
      const extracted = await extractSelectedPagesAsPdf(activeTab, indices);
      const base = activeTab.fileName.replace(/\.pdf$/i, '');
      onOpenGeneratedPdfInTab(`${base}_extraido.pdf`, extracted);
      onNotify(`Se extrajeron ${indices.length} página(s) en una pestaña nueva.`);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const handleRunImagesToPdf = async () => {
    if (imageFiles.length === 0) return;
    setBusy(true);
    try {
      const pdfBytes = await convertImagesToPdfBytes(imageFiles, pagePreset, 28);
      onOpenGeneratedPdfInTab('Imagenes_Convertidas_LEF.pdf', pdfBytes);
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
    'export-csv': 'Extraer Tablas del PDF a Microsoft Excel (.csv)',
    merge: 'Unir y Combinar Archivos PDF',
    split: 'Dividir o Extraer Páginas por Rango',
    watermark: 'Estudio de Marca de Agua Comercial',
    numbering: 'Encabezados, Pies de Página y Numeración Bates',
    'images-to-pdf': 'Convertir Imágenes (PNG, JPG, WebP) a PDF',
    'pdf-to-images': 'Exportar Páginas del PDF a Imágenes HD (.zip)',
    ocr: 'Reconocimiento Óptico de Texto (OCR Local)',
    optimize: 'Optimizar y Reducir Tamaño',
    metadata: 'Inspector de Propiedades y Privacidad',
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-window" style={{ maxWidth: 680 }} onClick={(e) => e.stopPropagation()}>
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
                      Guarda el logo de tu empresa, constructora o despacho una sola vez y estámpalo en cualquier PDF en 1 clic.
                    </div>
                  </div>
                  <Building2 size={20} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <input
                    type="text"
                    className="prop-input"
                    style={{ flex: 1, minWidth: 180 }}
                    placeholder="Nombre del logo (ej. Lycar Desarrollos)"
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

          {/* PDF TABLES TO EXCEL CSV */}
          {kind === 'export-csv' && (
            <div>
              {!activeTab ? (
                <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  Abre primero un estado de cuenta, factura o presupuesto PDF para extraer sus tablas a Excel.
                </p>
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
                  Ordena los documentos de arriba hacia abajo antes de combinarlos:
                </span>
                <button
                  type="button"
                  className="btn btn-subtle"
                  onClick={handleAddPdfsToMerge}
                >
                  <FilePlus size={14} />
                  <span>Agregar PDFs…</span>
                </button>
              </div>

              {mergeList.length === 0 ? (
                <div
                  style={{
                    padding: 28,
                    textAlign: 'center',
                    border: '1.5px dashed var(--border-strong)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--text-muted)',
                    fontSize: 12.5,
                  }}
                >
                  Haz clic en "Agregar PDFs…" para seleccionar dos o más archivos de tu equipo.
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
                        {idx + 1}. {item.fileName}
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
                <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  Primero abre un documento PDF para poder dividir o extraer sus páginas.
                </p>
              ) : (
                <>
                  <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 0 }}>
                    Documento actual: <strong>{activeTab.fileName}</strong> ({activeTab.pages.length}{' '}
                    páginas). Especifica los números o rangos separados por coma:
                  </p>
                  <input
                    type="text"
                    className="prop-input"
                    style={{ width: '100%', height: 38, fontSize: 14 }}
                    placeholder="Ejemplo: 1-3, 5, 8-12"
                    value={rangeSpec}
                    onChange={(e) => setRangeSpec(e.target.value)}
                  />
                </>
              )}
            </div>
          )}

          {/* WATERMARK */}
          {kind === 'watermark' && (
            <div>
              {!activeTab ? (
                <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  Abre un PDF primero para aplicarle una marca de agua en vivo.
                </p>
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
                <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  Abre primero un PDF para configurar su numeración y encabezados.
                </p>
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
                      placeholder="Ej. Lycar Desarrollos"
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
                      placeholder="Ej. Uso Interno"
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
                      <option value="bates">Folio Legal Bates (LEF-00001)</option>
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
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
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

                <select
                  className="prop-select"
                  value={pagePreset}
                  onChange={(e) => setPagePreset(e.target.value as 'a4' | 'letter' | 'fit')}
                >
                  <option value="a4">Hoja A4 con margen limpio</option>
                  <option value="letter">Hoja Carta (Letter)</option>
                  <option value="fit">Ajustar al tamaño exacto de cada foto</option>
                </select>
              </div>

              {imageFiles.length === 0 ? (
                <div
                  style={{
                    padding: 24,
                    textAlign: 'center',
                    border: '1.5px dashed var(--border-strong)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: 12.5,
                    color: 'var(--text-muted)',
                  }}
                >
                  Selecciona una o varias imágenes PNG, JPG o WebP para generar un PDF impecable.
                </div>
              ) : (
                <div style={{ fontSize: 12.5 }}>
                  <strong>{imageFiles.length} imagen(es) listas:</strong>
                  <ul style={{ paddingLeft: 18, color: 'var(--text-secondary)' }}>
                    {imageFiles.map((f, i) => (
                      <li key={`${f.name}_${i}`}>{f.name}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* PDF TO IMAGES */}
          {kind === 'pdf-to-images' && (
            <div>
              {!activeTab ? (
                <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  Abre primero un PDF para exportar sus páginas como imágenes.
                </p>
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
                <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  Abre un documento PDF primero para reconocer texto de sus páginas escaneadas.
                </p>
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
          {kind === 'metadata' && activeTab && (
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
                    Borra autor, empresa y metadatos ocultos de este documento de inmediato.
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
                      creator: 'PDF-LEF',
                      producer: 'PDF-LEF Local Engine',
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
              <span>Extraer Rango</span>
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
