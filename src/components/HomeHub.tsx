import React, { useState } from 'react';
import {
  Building2,
  CheckCheck,
  Clock,
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
import type { RecentFileEntry, ToolModalKind } from '../types/pdf';

interface HomeHubProps {
  recentFiles: RecentFileEntry[];
  savedLogosCount: number;
  onOpenPdfDialog: () => void;
  onDropFiles: (files: File[]) => void;
  onLoadShowcaseDemo: () => void;
  onLoadSamplePdf?: (sampleName: string) => void;
  onCreateBlankPdf: () => void;
  onOpenToolModal: (kind: ToolModalKind) => void;
  onOpenSignatureVault: () => void;
  onSetDefaultWindowsApp: () => void;
  onTogglePinRecent: (id: string) => void;
  onClearRecents: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

const TEST_DOCUMENTS = [
  {
    filename: '01_Cotizacion_Comercial_Abasteo.pdf',
    badge: 'Cotización TI',
    badgeBg: 'rgba(37, 99, 235, 0.12)',
    badgeColor: '#2563eb',
    size: '1 pág · 3.4 KB',
    title: 'Cotización Abasteo Hardware',
    desc: 'Laptops HP Victus e importes. Prueba editar importes y condiciones sin desbordar el margen.',
  },
  {
    filename: '02_Factura_Fiscal_CFDI.pdf',
    badge: 'CFDI 4.0 SAT',
    badgeBg: 'rgba(16, 185, 129, 0.12)',
    badgeColor: '#059669',
    size: '1 pág · 3.3 KB',
    title: 'Factura Fiscal con SAT',
    desc: 'Emisor, Receptor, desglose de IVA y timbre digital. Prueba modificar conceptos o extraer a CSV.',
  },
  {
    filename: '03_Contrato_Prestacion_Servicios.pdf',
    badge: 'Contrato Legal',
    badgeBg: 'rgba(139, 92, 246, 0.12)',
    badgeColor: '#7c3aed',
    size: '2 págs · 4.2 KB',
    title: 'Contrato Marco de Servicios',
    desc: 'Cláusulas legales y bloques de firmas ejecutivas en pág. 2. Prueba insertar firmas transparentes.',
  },
  {
    filename: '04_Reporte_Financiero_Ejecutivo.pdf',
    badge: 'Finanzas',
    badgeBg: 'rgba(245, 158, 11, 0.12)',
    badgeColor: '#d97706',
    size: '1 pág · 3.1 KB',
    title: 'Informe Ejecutivo con KPIs',
    desc: 'Tarjetas de métricas ($24.8M USD) y tabla por regiones operativas para pruebas de edición.',
  },
  {
    filename: '05_Certificado_Laboral_Nomina.pdf',
    badge: 'RH y Nómina',
    badgeBg: 'rgba(236, 72, 153, 0.12)',
    badgeColor: '#db2777',
    size: '1 pág · 3.1 KB',
    title: 'Constancia Laboral y Nómina',
    desc: 'Percepciones, deducciones y sello digital corporativo. Prueba modificar sueldos y agregar sellos.',
  },
];

export const HomeHub: React.FC<HomeHubProps> = ({
  recentFiles,
  savedLogosCount,
  onOpenPdfDialog,
  onDropFiles,
  onLoadShowcaseDemo,
  onLoadSamplePdf,
  onCreateBlankPdf,
  onOpenToolModal,
  onOpenSignatureVault,
  onSetDefaultWindowsApp,
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
        {/* Minimalist Thunderbird-Style Hero Launch Card */}
        <section
          className="home-hero"
          style={{
            borderColor: dragging ? 'var(--accent)' : undefined,
            boxShadow: dragging ? '0 0 0 3px var(--accent-soft)' : undefined,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ maxWidth: 600 }}>
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
              <span>Nativo en Windows 10 &amp; 11 · 100% Local · Próximamente macOS</span>
            </div>
            <h1
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 27,
                fontWeight: 800,
                letterSpacing: '-0.03em',
                margin: '0 0 8px',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <img
                src="/brand/logo-mark.svg"
                alt="PDF-LEF"
                style={{ width: 34, height: 34, borderRadius: 8 }}
              />
              <span>PDF-LEF</span>
            </h1>
            <p
              style={{
                margin: 0,
                fontSize: 13.5,
                lineHeight: 1.55,
                color: 'var(--text-secondary)',
              }}
            >
              El poder de edición real de Adobe Acrobat con la ligereza de Thunderbird. <strong>Edita y mueve textos originales</strong> sin
              dañar el formato, inserta <strong>imágenes y firmas transparentes</strong>, y organiza páginas con precisión quirúrgica.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 9, flexShrink: 0 }}>
            <button
              type="button"
              id="home-open-pdf-btn"
              className="btn btn-primary"
              style={{ height: 40, padding: '0 22px', fontSize: 13.5 }}
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
              <span>Probar Documento Ejemplo</span>
            </button>
          </div>
        </section>

        {/* Windows Default App & Official PDF-LEF Document Icon Banner */}
        <section
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 16,
            padding: '16px 22px',
            marginBottom: 26,
            borderRadius: 'var(--radius-lg)',
            background: 'var(--bg-surface)',
            border: '1px solid var(--accent-border)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <img
              src="/brand/pdf-doc-icon.svg"
              alt="Icono de Documento PDF-LEF"
              style={{ width: 48, height: 48, flexShrink: 0 }}
            />
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', marginBottom: 2 }}>
                Diseño Oficial de Documentos PDF en Windows
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
                Aplica <strong>PDF-LEF</strong> como tu aplicación predeterminada para que todos tus archivos{' '}
                <code>.pdf</code> luzcan con este icono exclusivo y abran al instante con doble clic.
              </div>
            </div>
          </div>

          <button
            type="button"
            className="btn btn-subtle"
            style={{ borderColor: 'var(--accent-border)', color: 'var(--accent)', fontWeight: 600 }}
            onClick={onSetDefaultWindowsApp}
          >
            <CheckCheck size={15} />
            <span>Establecer como predeterminada</span>
          </button>
        </section>

        {/* Clean General-Purpose Acrobat Plus Tools */}
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
          Herramientas Esenciales PDF
        </div>

        <section className="home-actions-grid">
          <button type="button" className="action-card" onClick={onLoadShowcaseDemo}>
            <div className="action-icon-box">
              <Pencil size={18} />
            </div>
            <div className="action-card-title">Editar y Mover Textos</div>
            <div className="action-card-desc">
              Corrige cualquier texto que ya tenga tu PDF o muévelo con guías magnéticas sin desemparejar líneas.
            </div>
          </button>

          <button type="button" className="action-card" onClick={() => onOpenToolModal('logos')}>
            <div className="action-icon-box">
              <Building2 size={18} />
            </div>
            <div className="action-card-title">Imágenes y Mis Logos ({savedLogosCount})</div>
            <div className="action-card-desc">
              Sube fotografías o guarda tus logotipos sin fondo blanco para insertarlos limpios en 1 clic.
            </div>
          </button>

          <button type="button" className="action-card" onClick={onOpenSignatureVault}>
            <div className="action-icon-box">
              <Signature size={18} />
            </div>
            <div className="action-card-title">Firmar y Sellar</div>
            <div className="action-card-desc">
              Dibuja o sube tu firma con fondo transparente y coloca sellos ejecutivos limpios en segundos.
            </div>
          </button>

          <button type="button" className="action-card" onClick={() => onOpenToolModal('merge')}>
            <div className="action-icon-box">
              <FileStack size={18} />
            </div>
            <div className="action-card-title">Unir y Dividir PDFs</div>
            <div className="action-card-desc">
              Combina varios documentos en uno solo, reordena páginas, rota hojas o extrae rangos específicos.
            </div>
          </button>

          <button type="button" className="action-card" onClick={() => onOpenToolModal('images-to-pdf')}>
            <div className="action-icon-box">
              <ImagePlus size={18} />
            </div>
            <div className="action-card-title">Convertir Imágenes a PDF</div>
            <div className="action-card-desc">
              Transforma fotos PNG/JPG o escaneos en un documento PDF limpio y perfectamente encuadrado.
            </div>
          </button>

          <button type="button" className="action-card" onClick={() => onOpenToolModal('export-csv')}>
            <div className="action-icon-box">
              <FileSpreadsheet size={18} />
            </div>
            <div className="action-card-title">Extraer Tablas a Excel</div>
            <div className="action-card-desc">
              Convierte tablas contenidas dentro de cualquier PDF en un archivo .CSV listo para abrir en Excel.
            </div>
          </button>

          <button type="button" className="action-card" onClick={onCreateBlankPdf}>
            <div className="action-icon-box">
              <FilePlus2 size={18} />
            </div>
            <div className="action-card-title">Nuevo PDF en Blanco</div>
            <div className="action-card-desc">
              Crea una hoja A4 limpia desde cero para redactar notas, colocar imágenes, logos y firmas.
            </div>
          </button>
        </section>

        {/* 5 Real Test Documents Showcase (Pruebas de Edición In Situ) */}
        {onLoadSamplePdf && (
          <div style={{ marginBottom: 28 }}>
            <div
              style={{
                fontSize: 11.5,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'var(--text-muted)',
                marginBottom: 12,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span>📁 Suite de Pruebas: 5 Documentos Reales</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', textTransform: 'none' }}>
                Carpeta /pruebas integrada
              </span>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: 12,
              }}
            >
              {TEST_DOCUMENTS.map((doc) => (
                <button
                  key={doc.filename}
                  type="button"
                  className="action-card"
                  style={{ textAlign: 'left', padding: '13px 15px', cursor: 'pointer' }}
                  onClick={() => onLoadSamplePdf(doc.filename)}
                  title={`Abrir ${doc.title} para probar edición in situ`}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 7,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: '2px 7px',
                        borderRadius: 4,
                        background: doc.badgeBg,
                        color: doc.badgeColor,
                      }}
                    >
                      {doc.badge}
                    </span>
                    <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{doc.size}</span>
                  </div>
                  <div
                    className="action-card-title"
                    style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}
                  >
                    {doc.title}
                  </div>
                  <div className="action-card-desc" style={{ fontSize: 11.5, lineHeight: 1.42 }}>
                    {doc.desc}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

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
              <span>Documentos Recientes</span>
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
                padding: '28px 20px',
                textAlign: 'center',
                color: 'var(--text-muted)',
                fontSize: 12.5,
              }}
            >
              Arrastra cualquier archivo PDF aquí o haz clic en{' '}
              <strong style={{ color: 'var(--text-primary)' }}>Probar Documento Ejemplo</strong> para comenzar.
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <img
                      src="/brand/pdf-doc-icon.svg"
                      alt="PDF"
                      style={{ width: 26, height: 26, flexShrink: 0 }}
                    />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
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
