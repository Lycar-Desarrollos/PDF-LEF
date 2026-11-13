import React, { useState } from 'react';
import {
  Clock,
  FilePlus2,
  FileStack,
  FolderOpen,
  ImagePlus,
  Pencil,
  Pin,
  ScanText,
  Scissors,
  ShieldCheck,
  Signature,
  Sparkles,
  Trash2,
} from 'lucide-react';
import type { RecentFileEntry, ToolModalKind } from '../types/pdf';

interface HomeHubProps {
  recentFiles: RecentFileEntry[];
  onOpenPdfDialog: () => void;
  onDropFiles: (files: File[]) => void;
  onLoadShowcaseDemo: () => void;
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
          <div style={{ maxWidth: 580 }}>
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
              <span>100% Local en Windows · Cero Nube · Máxima Precisión</span>
            </div>
            <h1
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 26,
                fontWeight: 800,
                letterSpacing: '-0.03em',
                margin: '0 0 8px',
              }}
            >
              PDF-LEF Studio Pro
            </h1>
            <p
              style={{
                margin: 0,
                fontSize: 13.5,
                lineHeight: 1.55,
                color: 'var(--text-secondary)',
              }}
            >
              Abre cualquier PDF para leer, <strong>editar y mover textos existentes</strong>,
              insertar imágenes, firmar sin fondo blanco, organizar páginas o exportar sin
              límites. Arrastra tus archivos aquí o elige una acción rápida.
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
              onClick={onLoadShowcaseDemo}
            >
              <Sparkles size={14} style={{ color: 'var(--accent)' }} />
              <span>Probar Documento Demo Editable</span>
            </button>
          </div>
        </section>

        {/* Quick Studio Workflows */}
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
          Estudio y Herramientas Directas
        </div>

        <section className="home-actions-grid">
          <button
            type="button"
            className="action-card"
            onClick={onOpenPdfDialog}
          >
            <div className="action-icon-box">
              <Pencil size={18} />
            </div>
            <div className="action-card-title">Editar y Mover Textos</div>
            <div className="action-card-desc">
              Modifica palabras existentes del PDF, muévelas de posición o cambia su tipografía.
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
            <div className="action-card-title">Unir varios PDFs</div>
            <div className="action-card-desc">
              Combina múltiples documentos en un solo archivo limpio ordenándolos a tu gusto.
            </div>
          </button>

          <button
            type="button"
            className="action-card"
            onClick={() => onOpenToolModal('images-to-pdf')}
          >
            <div className="action-icon-box">
              <ImagePlus size={18} />
            </div>
            <div className="action-card-title">Imágenes a PDF</div>
            <div className="action-card-desc">
              Convierte fotos PNG, JPG o WebP en documentos A4, Carta o tamaño exacto.
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
            <div className="action-card-title">Crear PDF desde Cero</div>
            <div className="action-card-desc">
              Inicia un lienzo A4 limpio para redactar, colocar logotipos, sellos y firmas.
            </div>
          </button>

          <button
            type="button"
            className="action-card"
            onClick={() => {
              onLoadShowcaseDemo();
            }}
          >
            <div className="action-icon-box">
              <Signature size={18} />
            </div>
            <div className="action-card-title">Bóveda de Firmas</div>
            <div className="action-card-desc">
              Dibuja o sube foto de tu firma eliminando el fondo blanco automáticamente.
            </div>
          </button>

          <button
            type="button"
            className="action-card"
            onClick={() => onOpenToolModal('split')}
          >
            <div className="action-icon-box">
              <Scissors size={18} />
            </div>
            <div className="action-card-title">Dividir y Extraer</div>
            <div className="action-card-desc">
              Extrae rangos específicos de páginas en nuevos archivos independientes.
            </div>
          </button>

          <button
            type="button"
            className="action-card"
            onClick={() => onOpenToolModal('ocr')}
          >
            <div className="action-icon-box">
              <ScanText size={18} />
            </div>
            <div className="action-card-title">OCR Escaneos Offline</div>
            <div className="action-card-desc">
              Reconoce texto copiable desde documentos escaneados sin salir de tu equipo.
            </div>
          </button>

          <button
            type="button"
            className="action-card"
            onClick={() => onOpenToolModal('watermark')}
          >
            <div className="action-icon-box">
              <Sparkles size={18} />
            </div>
            <div className="action-card-title">Marca de Agua y Folios</div>
            <div className="action-card-desc">
              Estampa sellos diagonales y numeración profesional Bates en segundos.
            </div>
          </button>
        </section>

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
                Probar Documento Demo Editable
              </strong>{' '}
              para explorar todas las herramientas.
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
