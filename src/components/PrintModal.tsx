import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Download, FileText, Printer, Sparkles, X } from 'lucide-react';
import type { PdfTabDocument } from '../types/pdf';
import {
  destroyPrintProxy,
  loadCompiledPrintProxy,
  renderCompiledPagePreview,
  resolvePrintPageIndices,
  spoolCompiledPagesAndPrint,
  type CompiledPrintProxy,
  type PrintPageScope,
  type PrintQualityDpi,
  type PrintScaleMode,
} from '../utils/printEngine';

interface PrintModalProps {
  tab: PdfTabDocument;
  onSavePdfCopy: () => void;
  onNotify: (msg: string) => void;
  onClose: () => void;
}

const SheetPreviewCard: React.FC<{
  pdfProxy: CompiledPrintProxy;
  pageIndex: number;
  singleSheet: boolean;
}> = ({ pdfProxy, pageIndex, singleSheet }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [dimsMm, setDimsMm] = useState<{ widthMm: number; heightMm: number } | null>(null);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    let cancelled = false;
    renderCompiledPagePreview(pdfProxy, pageIndex, c, singleSheet ? 255 : 148)
      .then((dims) => {
        if (!cancelled) setDimsMm(dims);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [pdfProxy, pageIndex, singleSheet]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
      }}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: 6,
          padding: 4,
          boxShadow: '0 6px 20px rgba(15, 23, 42, 0.14)',
          border: '1px solid rgba(15, 23, 42, 0.12)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <canvas
          ref={canvasRef}
          style={{ display: 'block', maxWidth: '100%', height: 'auto', borderRadius: 2 }}
        />
      </div>
      <div
        style={{
          fontSize: 11.5,
          fontWeight: 600,
          color: 'var(--text-secondary)',
        }}
      >
        Hoja {pageIndex + 1}
        {dimsMm ? ` · ${dimsMm.widthMm} × ${dimsMm.heightMm} mm` : ''}
      </div>
    </div>
  );
};

export const PrintModal: React.FC<PrintModalProps> = ({
  tab,
  onSavePdfCopy,
  onNotify,
  onClose,
}) => {
  const totalPages = tab.pages.length;
  const currentNum = tab.currentPageIndex + 1;

  const [scope, setScope] = useState<PrintPageScope>('all');
  const [customRange, setCustomRange] = useState<string>(
    totalPages > 1 ? `1-${Math.min(totalPages, 2)}` : '1'
  );
  const [scaleMode, setScaleMode] = useState<PrintScaleMode>('fit');
  const [dpi, setDpi] = useState<PrintQualityDpi>(300);

  const [pdfProxy, setPdfProxy] = useState<CompiledPrintProxy | null>(null);
  const [compiling, setCompiling] = useState<boolean>(true);
  const [spooling, setSpooling] = useState<boolean>(false);
  const [progressText, setProgressText] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    let activeProxy: CompiledPrintProxy | null = null;

    loadCompiledPrintProxy(tab)
      .then(({ pdfProxy: loaded }) => {
        if (cancelled) {
          destroyPrintProxy(loaded);
          return;
        }
        activeProxy = loaded;
        setPdfProxy(loaded);
      })
      .catch(() => {
        if (!cancelled) {
          onNotify('No se pudo preparar la vista de impresión del PDF.');
        }
      })
      .finally(() => {
        if (!cancelled) setCompiling(false);
      });

    return () => {
      cancelled = true;
      destroyPrintProxy(activeProxy);
    };
  }, [tab, onNotify]);

  const targetIndices = useMemo(
    () => resolvePrintPageIndices(totalPages, tab.currentPageIndex, scope, customRange),
    [totalPages, tab.currentPageIndex, scope, customRange]
  );

  const previewIndices = useMemo(() => targetIndices.slice(0, 12), [targetIndices]);

  const handleConfirmPrint = async () => {
    if (!pdfProxy || targetIndices.length === 0 || spooling) return;
    setSpooling(true);
    setProgressText(`Preparando hoja 1 de ${targetIndices.length}…`);
    try {
      await spoolCompiledPagesAndPrint(pdfProxy, targetIndices, {
        scaleMode,
        dpi,
        onProgress: (done, total) => {
          setProgressText(`Preparando hoja ${done} de ${total} en alta nitidez…`);
        },
      });
      onClose();
    } catch {
      onNotify('Ocurrió un problema al enviar las hojas a la cola de impresión.');
    } finally {
      setSpooling(false);
      setProgressText('');
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !spooling) {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [spooling, onClose]);

  return (
    <div className="modal-backdrop" onClick={() => !spooling && onClose()}>
      <div
        className="modal-window"
        style={{ maxWidth: 820 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-title">
            <Printer size={17} style={{ color: 'var(--accent)' }} />
            <span>Imprimir Documento PDF — Hojas Limpias sin Márgenes de Ventana</span>
          </div>
          <button
            type="button"
            className="btn icon-only"
            disabled={spooling}
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>

        <div
          className="modal-body"
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(290px, 1.05fr) minmax(260px, 0.95fr)',
            gap: 18,
            alignItems: 'stretch',
          }}
        >
          {/* Left Column: Print Configuration */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="setting-card" style={{ marginBottom: 0 }}>
              <div style={{ minWidth: 0 }}>
                <div
                  className="setting-card-title"
                  style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {tab.fileName}
                </div>
                <div className="setting-card-desc">
                  {totalPages === 1
                    ? '1 hoja lista (incluye todas tus ediciones, textos y firmas)'
                    : `${totalPages} hojas disponibles · Estás viendo la hoja ${currentNum}`}
                </div>
              </div>
              <FileText size={19} style={{ color: 'var(--accent)', flexShrink: 0 }} />
            </div>

            <div>
              <div className="prop-label" style={{ marginBottom: 6, fontWeight: 700 }}>
                1. ¿Qué hojas deseas imprimir?
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                <button
                  type="button"
                  className="action-card"
                  style={{
                    padding: '10px 12px',
                    borderColor: scope === 'all' ? 'var(--accent)' : 'var(--border-subtle)',
                    background: scope === 'all' ? 'var(--accent-soft)' : 'var(--bg-surface-subtle)',
                  }}
                  onClick={() => setScope('all')}
                >
                  <div className="action-card-title" style={{ fontSize: 12.5 }}>
                    {totalPages === 1
                      ? 'Hoja única del documento (Página 1)'
                      : `Todas las hojas del PDF (1 a ${totalPages})`}
                  </div>
                </button>

                {totalPages > 1 && (
                  <>
                    <button
                      type="button"
                      className="action-card"
                      style={{
                        padding: '10px 12px',
                        borderColor: scope === 'current' ? 'var(--accent)' : 'var(--border-subtle)',
                        background:
                          scope === 'current' ? 'var(--accent-soft)' : 'var(--bg-surface-subtle)',
                      }}
                      onClick={() => setScope('current')}
                    >
                      <div className="action-card-title" style={{ fontSize: 12.5 }}>
                        Solo la hoja actual (Página {currentNum} de {totalPages})
                      </div>
                    </button>

                    <button
                      type="button"
                      className="action-card"
                      style={{
                        padding: '10px 12px',
                        borderColor: scope === 'custom' ? 'var(--accent)' : 'var(--border-subtle)',
                        background:
                          scope === 'custom' ? 'var(--accent-soft)' : 'var(--bg-surface-subtle)',
                      }}
                      onClick={() => setScope('custom')}
                    >
                      <div className="action-card-title" style={{ fontSize: 12.5 }}>
                        Rango personalizado de hojas
                      </div>
                    </button>

                    {scope === 'custom' && (
                      <input
                        type="text"
                        className="prop-input"
                        style={{ width: '100%', height: 34 }}
                        placeholder={`Ej. 1-3, ${totalPages}`}
                        value={customRange}
                        onChange={(e) => setCustomRange(e.target.value)}
                      />
                    )}
                  </>
                )}
              </div>
            </div>

            <div>
              <div className="prop-label" style={{ marginBottom: 6, fontWeight: 700 }}>
                2. Escala y adaptación a tu impresora
              </div>
              <select
                className="prop-select"
                style={{ width: '100%', height: 34 }}
                value={scaleMode}
                onChange={(e) => setScaleMode(e.target.value as PrintScaleMode)}
              >
                <option value="fit">
                  Ajustar automáticamente a la hoja (Carta, A4, Oficio o Térmica)
                </option>
                <option value="exact">
                  Tamaño exacto 100% del PDF (Medidas milimétricas reales)
                </option>
              </select>
            </div>

            <div>
              <div className="prop-label" style={{ marginBottom: 6, fontWeight: 700 }}>
                3. Resolución de salida
              </div>
              <select
                className="prop-select"
                style={{ width: '100%', height: 34 }}
                value={dpi}
                onChange={(e) => setDpi(Number(e.target.value) as PrintQualityDpi)}
              >
                <option value={300}>Alta Definición Impresión (300 DPI — Textos y firmas nítidos)</option>
                <option value={220}>Rápida de Oficina (220 DPI — Lotes extensos)</option>
              </select>
            </div>

            <div
              style={{
                marginTop: 'auto',
                padding: '10px 12px',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(13, 122, 95, 0.08)',
                border: '1px solid rgba(13, 122, 95, 0.25)',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 12,
                color: 'var(--success)',
                fontWeight: 600,
              }}
            >
              <CheckCircle2 size={15} style={{ flexShrink: 0 }} />
              <span>
                {targetIndices.length === 0
                  ? 'Indica un rango válido de páginas para imprimir.'
                  : `Se enviarán únicamente ${targetIndices.length} hoja(s) PDF limpias a tu impresora (sin barras ni encabezados).`}
              </span>
            </div>
          </div>

          {/* Right Column: Live Clean Sheet Preview */}
          <div
            style={{
              background: 'var(--bg-surface-subtle)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-lg)',
              padding: 14,
              display: 'flex',
              flexDirection: 'column',
              minHeight: 330,
              maxHeight: 430,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 10,
                fontSize: 11.5,
                fontWeight: 700,
                color: 'var(--text-secondary)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              <span>Vista previa exacta de salida ({targetIndices.length} hoja{targetIndices.length === 1 ? '' : 's'})</span>
              <Sparkles size={13} style={{ color: 'var(--accent)' }} />
            </div>

            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                display: 'grid',
                gridTemplateColumns:
                  previewIndices.length <= 1 ? '1fr' : 'repeat(auto-fill, minmax(136px, 1fr))',
                gap: 12,
                alignItems: 'center',
                justifyItems: 'center',
                padding: '6px 4px',
              }}
            >
              {compiling || !pdfProxy ? (
                <div style={{ fontSize: 12.5, color: 'var(--text-muted)', padding: 24 }}>
                  Compilando hojas del PDF en alta nitidez…
                </div>
              ) : previewIndices.length === 0 ? (
                <div style={{ fontSize: 12.5, color: 'var(--danger)', padding: 24, textAlign: 'center' }}>
                  El rango indicado no coincide con las páginas del documento (1 a {totalPages}).
                </div>
              ) : (
                previewIndices.map((idx) => (
                  <SheetPreviewCard
                    key={idx}
                    pdfProxy={pdfProxy}
                    pageIndex={idx}
                    singleSheet={previewIndices.length === 1}
                  />
                ))
              )}
            </div>

            {targetIndices.length > previewIndices.length && (
              <div
                style={{
                  textAlign: 'center',
                  fontSize: 11,
                  color: 'var(--text-muted)',
                  paddingTop: 6,
                }}
              >
                Mostrando las primeras {previewIndices.length} de {targetIndices.length} hojas seleccionadas.
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button
            type="button"
            className="btn btn-subtle"
            disabled={spooling}
            onClick={onClose}
          >
            Cancelar
          </button>

          <button
            type="button"
            className="btn btn-subtle"
            disabled={spooling}
            onClick={() => {
              onClose();
              onSavePdfCopy();
            }}
          >
            <Download size={14} />
            <span>Guardar como PDF…</span>
          </button>

          <button
            type="button"
            className="btn btn-primary"
            disabled={compiling || !pdfProxy || targetIndices.length === 0 || spooling}
            onClick={handleConfirmPrint}
          >
            <Printer size={14.5} />
            <span>
              {spooling
                ? progressText || 'Enviando hojas a impresora…'
                : targetIndices.length === 1
                ? `Imprimir Hoja ${targetIndices[0] + 1}`
                : `Imprimir ${targetIndices.length} Hojas`}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
