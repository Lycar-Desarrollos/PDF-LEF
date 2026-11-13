import React, { useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Check,
  Copy,
  Download,
  FilePlus,
  ImagePlus,
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
  ToolModalKind,
  WatermarkConfig,
} from '../types/pdf';
import { convertImagesToPdfBytes } from '../utils/imageUtils';
import { renderPageToCanvas } from '../utils/pdfEngine';
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
      creator: 'PDF-LEF Studio Pro',
      producer: 'PDF-LEF Native Engine',
    }
  );

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
      <div className="modal-window" style={{ maxWidth: 640 }} onClick={(e) => e.stopPropagation()}>
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
                      creator: 'PDF-LEF Studio Pro',
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
