import React, { useState } from 'react';
import {
  Building2,
  Calculator,
  Clock,
  Compass,
  FilePlus2,
  FileSpreadsheet,
  FileStack,
  FolderOpen,
  ImagePlus,
  Pencil,
  Pin,
  ShieldCheck,
  Signature,
  Sparkles,
  Trash2,
} from 'lucide-react';
import type { RecentFileEntry, StudioDepartment, ToolModalKind } from '../types/pdf';

interface HomeHubProps {
  recentFiles: RecentFileEntry[];
  savedLogosCount: number;
  onOpenPdfDialog: () => void;
  onDropFiles: (files: File[]) => void;
  onLoadShowcaseDemo: (dept?: StudioDepartment, pageIndex?: number) => void;
  onCreateBlankPdf: () => void;
  onOpenToolModal: (kind: ToolModalKind) => void;
  onTogglePinRecent: (id: string) => void;
  onClearRecents: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export const HomeHub: React.FC<HomeHubProps> = ({
  recentFiles,
  savedLogosCount,
  onOpenPdfDialog,
  onDropFiles,
  onLoadShowcaseDemo,
  onCreateBlankPdf,
  onOpenToolModal,
  onTogglePinRecent,
  onClearRecents,
}) => {
  const [dragging, setDragging] = useState(false);

  const sortedRecents = [...recentFiles].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return b.lastOpenedAt - a.lastOpenedAt;
  });

  return (
    <main
      className="home-hub"
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const dropped = Array.from(e.dataTransfer.files || []);
        if (dropped.length > 0) onDropFiles(dropped);
      }}
    >
      <div className="home-container">
        {/* Hero Launch Card */}
        <section
          className="home-hero"
          style={{
            borderColor: dragging ? 'var(--accent)' : undefined,
            boxShadow: dragging ? '0 0 0 3px var(--accent-soft)' : undefined,
          }}
        >
          <div style={{ maxWidth: 610 }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                fontSize: 11.5,
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: 'var(--accent)',
                marginBottom: 8,
              }}
            >
              <ShieldCheck size={14} />
              <span>100% Local en Windows · Cero Nube · Ediciones Ingeniería, Contabilidad y Administración</span>
            </div>
            <h1
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 26,
                fontWeight: 800,
                letterSpacing: '-0.03em',
                margin: '0 0 8px',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <img
                src="/brand/logo-mark.svg"
                alt="PDF-LEF"
                style={{ width: 30, height: 30, borderRadius: 7 }}
              />
              <span>PDF-LEF Studio Pro</span>
            </h1>
            <p
              style={{
                margin: 0,
                fontSize: 13.5,
                lineHeight: 1.55,
                color: 'var(--text-secondary)',
              }}
            >
              Abre cualquier PDF o imagen para <strong>editar y mover textos existentes</strong>,
              subir y escalar fotografías o <strong>logos empresariales</strong>, acotar planos a escala
              de <strong>Ingeniería</strong>, conciliar tablas de <strong>Contabilidad</strong> y firmar
              expedientes de <strong>Administración</strong>.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 9, flexShrink: 0 }}>
            <button
              type="button"
              id="home-open-pdf-btn"
              className="btn btn-primary"
              style={{ height: 40, padding: '0 20px', fontSize: 13.5 }}
              onClick={onOpenPdfDialog}
            >
              <FolderOpen size={16} />
              <span>Abrir archivo PDF…</span>
            </button>
            <button
              type="button"
              id="home-demo-pdf-btn"
              className="btn btn-subtle"
              style={{ height: 36, padding: '0 16px', fontSize: 12.5 }}
              onClick={() => onLoadShowcaseDemo('general', 0)}
            >
              <Sparkles size={14} style={{ color: 'var(--accent)' }} />
              <span>Abrir Proyecto Demo (3 Páginas)</span>
            </button>
          </div>
        </section>

        {/* Specialized Department Suites (Thunderbird Spaces Model) */}
        <div
          style={{
            fontSize: 11.5,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'var(--text-muted)',
            marginBottom: 12,
          }}
        >
          Espacios de Trabajo Especializados y Edición Directa
        </div>

        <section className="home-actions-grid">
          <button
            type="button"
            className="action-card"
            onClick={() => onLoadShowcaseDemo('general', 0)}
          >
            <div className="action-icon-box">
              <Pencil size={18} />
            </div>
            <div className="action-card-title">Editar Textos y Subir Imágenes</div>
            <div className="action-card-desc">
              Modifica palabras existentes del PDF, arrástralas de lugar, sube fotos o pega capturas con Ctrl+V.
            </div>
          </button>

          <button
            type="button"
            className="action-card"
            onClick={() => onOpenToolModal('logos')}
          >
            <div className="action-icon-box">
              <Building2 size={18} />
            </div>
            <div className="action-card-title">
              Bóveda de Logos ({savedLogosCount})
            </div>
            <div className="action-card-desc">
              Guarda los logotipos de tu empresa sin fondo blanco y estámpalos en cualquier PDF en 1 clic.
            </div>
          </button>

          <button
            type="button"
            className="action-card"
            onClick={() => onLoadShowcaseDemo('engineering', 2)}
          >
            <div className="action-icon-box" style={{ color: '#1D4ED8', background: 'rgba(29,78,216,0.1)' }}>
              <Compass size={18} />
            </div>
            <div className="action-card-title">Suite Ingeniería y Planos CAD</div>
            <div className="action-card-desc">
              Acota distancias y áreas m² a escala (1:100, 1:50), globos numerados, filtro Blueprint y Cajetín Técnico.
            </div>
          </button>

          <button
            type="button"
            className="action-card"
            onClick={() => onLoadShowcaseDemo('accounting', 2)}
          >
            <div className="action-icon-box" style={{ color: '#0D7A5F', background: 'rgba(13,122,95,0.1)' }}>
              <Calculator size={18} />
            </div>
            <div className="action-card-title">Contabilidad, IVA y Auditoría</div>
            <div className="action-card-desc">
              Calculadora de cinta con desglose de IVA/ISR estampable, marcas de conciliación ✓/✗ y sellos fiscales.
            </div>
          </button>

          <button
            type="button"
            className="action-card"
            onClick={() => onOpenToolModal('export-csv')}
          >
            <div className="action-icon-box" style={{ color: '#0F766E', background: 'rgba(15,118,110,0.1)' }}>
              <FileSpreadsheet size={18} />
            </div>
            <div className="action-card-title">Extraer Tablas PDF a Excel</div>
            <div className="action-card-desc">
              Convierte estados de cuenta, presupuestos y facturas PDF en archivos .CSV listos para Microsoft Excel.
            </div>
          </button>

          <button
            type="button"
            className="action-card"
            onClick={() => onLoadShowcaseDemo('admin', 0)}
          >
            <div className="action-icon-box">
              <Signature size={18} />
            </div>
            <div className="action-card-title">Administración, Firmas y Sellos</div>
            <div className="action-card-desc">
              Firmas transparentes, Acuse de Recibido, folios legales Bates, censura confidencial y marcas de agua.
            </div>
          </button>

          <button
            type="button"
            className="action-card"
            onClick={() => onOpenToolModal('merge')}
          >
            <div className="action-icon-box">
              <FileStack size={18} />
            </div>
            <div className="action-card-title">Unir y Dividir Expedientes</div>
            <div className="action-card-desc">
              Combina múltiples PDFs o convierte colecciones de fotografías PNG/JPG en documentos limpios.
            </div>
          </button>

          <button
            type="button"
            className="action-card"
            onClick={onCreateBlankPdf}
          >
            <div className="action-icon-box">
              <FilePlus2 size={18} />
            </div>
            <div className="action-card-title">Crear PDF Membretado en Blanco</div>
            <div className="action-card-desc">
              Inicia una hoja A4 limpia lista para insertar tu logo empresarial, textos, tablas e imágenes.
            </div>
          </button>
        </section>

        {/* Secondary Quick Conversion Bar */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-subtle"
            onClick={() => onOpenToolModal('images-to-pdf')}
          >
            <ImagePlus size={14} />
            <span>Convertir Fotos PNG/JPG a PDF…</span>
          </button>
          <button
            type="button"
            className="btn btn-subtle"
            onClick={() => onOpenToolModal('calculator')}
          >
            <Calculator size={14} />
            <span>Abrir Calculadora Contable IVA…</span>
          </button>
        </div>

        {/* Recent & Pinned Documents */}
        <section
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '13px 18px',
              borderBottom: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              <Clock size={15} style={{ color: 'var(--accent)' }} />
              <span>Documentos Recientes en este Equipo</span>
            </div>
            {sortedRecents.length > 0 && (
              <button
                type="button"
                className="btn"
                style={{ height: 26, fontSize: 11.5 }}
                onClick={onClearRecents}
              >
                <Trash2 size={12.5} />
                <span>Limpiar historial</span>
              </button>
            )}
          </div>

          {sortedRecents.length === 0 ? (
            <div
              style={{
                padding: '32px 20px',
                textAlign: 'center',
                color: 'var(--text-muted)',
                fontSize: 12.5,
              }}
            >
              Aún no hay archivos recientes. Abre un PDF desde tu equipo o haz clic en{' '}
              <strong style={{ color: 'var(--text-primary)' }}>
                Abrir Proyecto Demo (3 Páginas)
              </strong>{' '}
              para explorar edición de textos, logos, planos de ingeniería y tablas contables.
            </div>
          ) : (
            <div>
              {sortedRecents.map((item) => (
                <div
                  key={item.id}
                  style={{
                    padding: '10px 18px',
                    borderBottom: '1px solid var(--border-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: 12.5,
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                      {item.fileName}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {item.pageCount} págs. · {formatBytes(item.fileSize)} ·{' '}
                      {new Date(item.lastOpenedAt).toLocaleDateString('es-ES', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <button
                    type="button"
                    className={`btn icon-only ${item.pinned ? 'active' : ''}`}
                    style={{ width: 28, height: 28 }}
                    onClick={() => onTogglePinRecent(item.id)}
                    title={item.pinned ? 'Quitar fijado' : 'Fijar arriba'}
                  >
                    <Pin size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
};
