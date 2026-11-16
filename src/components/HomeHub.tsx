import React, { useState } from 'react';
import {
  Building2,
  CheckCheck,
  Clock,
  Crop,
  FileDown,
  FileOutput,
  FilePlus2,
  FileSpreadsheet,
  FileStack,
  FileText,
  FolderOpen,
  ImagePlus,
  Pencil,
  Pin,
  Scissors,
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
    filename: '06_Portafolio_Obra_Proyectos.pdf',
    badge: 'Arquitectura y Obra',
    badgeBg: 'rgba(217, 121, 59, 0.14)',
    badgeColor: '#C25E24',
    size: '2 págs · 4.8 KB',
    title: 'Portafolio de Proyectos e Ingeniería',
    desc: 'Encabezado oscuro, títulos en color terracota y párrafos densos para probar detección cromática exacta.',
  },
  {
    filename: '01_Cotizacion_Comercial_Abasteo.pdf',
    badge: 'Cotización TI',
    badgeBg: 'rgba(37, 99, 235, 0.12)',
    badgeColor: '#2563EB',
    size: '1 pág · 3.4 KB',
    title: 'Cotización Ejecutiva de Hardware',
    desc: 'Partidas tabulares e importes. Prueba editar precios y condiciones respetando la alineación.',
  },
  {
    filename: '02_Factura_Fiscal_CFDI.pdf',
    badge: 'CFDI 4.0 Fiscal',
    badgeBg: 'rgba(13, 122, 95, 0.12)',
    badgeColor: '#0D7A5F',
    size: '1 pág · 3.3 KB',
    title: 'Factura Fiscal con Desglose IVA',
    desc: 'Emisor, receptor, impuestos y sello digital. Prueba modificar conceptos o exportar tabla a Excel.',
  },
  {
    filename: '03_Contrato_Prestacion_Servicios.pdf',
    badge: 'Contrato Legal',
    badgeBg: 'rgba(3, 105, 161, 0.12)',
    badgeColor: '#0369A1',
    size: '2 págs · 4.2 KB',
    title: 'Contrato Marco de Servicios',
    desc: 'Cláusulas jurídicas y bloques de firmas en pág. 2. Prueba estampar firmas transparentes o eliminar hoja.',
  },
  {
    filename: '04_Reporte_Financiero_Ejecutivo.pdf',
    badge: 'Finanzas',
    badgeBg: 'rgba(180, 83, 9, 0.12)',
    badgeColor: '#B45309',
    size: '1 pág · 3.1 KB',
    title: 'Informe Ejecutivo de Indicadores',
    desc: 'Tarjetas de métricas ($24.8M USD) y resultados por región listos para convertir a Word o Excel.',
  },
  {
    filename: '05_Certificado_Laboral_Nomina.pdf',
    badge: 'Capital Humano',
    badgeBg: 'rgba(200, 30, 50, 0.11)',
    badgeColor: '#C81E32',
    size: '1 pág · 3.1 KB',
    title: 'Constancia Laboral y Nómina',
    desc: 'Percepciones, deducciones y validación oficial. Prueba colocar sellos, logos o marcas de agua.',
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
        {/* Architectural Hero Launchpad */}
        <section
          className="home-hero"
          style={{
            borderColor: dragging ? 'var(--accent)' : undefined,
            boxShadow: dragging ? '0 0 0 3px var(--accent-soft)' : undefined,
            flexWrap: 'wrap',
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
              <span>Kova Studio · Arquitectura Nativa Windows · 100% Local y Privado</span>
            </div>
            <h1
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 28,
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
                alt="Kova PDF"
                style={{ width: 34, height: 34, borderRadius: 8 }}
              />
              <span>Kova PDF</span>
            </h1>
            <p
              style={{
                margin: 0,
                fontSize: 13.5,
                lineHeight: 1.55,
                color: 'var(--text-secondary)',
              }}
            >
              Estación profesional de ingeniería documental sin nube ni suscripciones.{' '}
              <strong>Edita textos nativos</strong> respetando tipografía, color y fondo,{' '}
              <strong>une, divide, elimina páginas, comprime</strong> y convierte a{' '}
              <strong>Word o Excel</strong> al instante en tu equipo.
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
              <span>Probar Documento Interactivo</span>
            </button>
          </div>
        </section>

        {/* Windows Default App & Official Kova PDF Document Icon Banner */}
        <section
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 16,
            padding: '15px 22px',
            marginBottom: 26,
            borderRadius: 'var(--radius-lg)',
            background: 'var(--bg-surface)',
            border: '1px solid var(--accent-border)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <img
              src="/brand/pdf-doc-icon.svg"
              alt="Icono de Documento Kova PDF"
              style={{ width: 46, height: 46, flexShrink: 0 }}
            />
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', marginBottom: 2 }}>
                Visor y Editor Predeterminado en Windows 10 y 11
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
                Establece <strong>Kova PDF</strong> como tu aplicación predeterminada para abrir cualquier archivo{' '}
                <code>.pdf</code> al instante con doble clic y total privacidad local.
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

        {/* Complete Offline PDF Toolkit Grid */}
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
          Suite Completa de Herramientas PDF (100% Local)
        </div>

        <section className="home-actions-grid">
          <button type="button" className="action-card" onClick={onOpenPdfDialog}>
            <div className="action-icon-box">
              <Pencil size={18} />
            </div>
            <div className="action-card-title">Editar Texto PDF</div>
            <div className="action-card-desc">
              Modifica textos existentes conservando su color real y fondo original sin encimar renglones.
            </div>
          </button>

          <button type="button" className="action-card" onClick={() => onOpenToolModal('merge')}>
            <div className="action-icon-box">
              <FileStack size={18} />
            </div>
            <div className="action-card-title">Unir PDF</div>
            <div className="action-card-desc">
              Combina múltiples documentos PDF en el orden exacto que elijas en un solo archivo.
            </div>
          </button>

          <button type="button" className="action-card" onClick={() => onOpenToolModal('split')}>
            <div className="action-icon-box">
              <Scissors size={18} />
            </div>
            <div className="action-card-title">Dividir PDF</div>
            <div className="action-card-desc">
              Extrae rangos de páginas o separa cada N hojas en archivos PDF independientes (.zip).
            </div>
          </button>

          <button type="button" className="action-card" onClick={() => onOpenToolModal('remove-pages')}>
            <div className="action-icon-box">
              <Trash2 size={18} />
            </div>
            <div className="action-card-title">Eliminar Páginas</div>
            <div className="action-card-desc">
              Haz clic visualmente en las hojas sobrantes o indica rangos para suprimirlas al instante.
            </div>
          </button>

          <button type="button" className="action-card" onClick={() => onOpenToolModal('optimize')}>
            <div className="action-icon-box">
              <FileDown size={18} />
            </div>
            <div className="action-card-title">Comprimir PDF</div>
            <div className="action-card-desc">
              Reduce el peso en megabytes con 3 niveles de optimización y opción de aplanado seguro.
            </div>
          </button>

          <button type="button" className="action-card" onClick={() => onOpenToolModal('pdf-to-word')}>
            <div className="action-icon-box">
              <FileText size={18} />
            </div>
            <div className="action-card-title">PDF a Word (.docx)</div>
            <div className="action-card-desc">
              Convierte documentos PDF a Microsoft Word editable respetando títulos, negritas y tablas.
            </div>
          </button>

          <button type="button" className="action-card" onClick={() => onOpenToolModal('export-csv')}>
            <div className="action-icon-box">
              <FileSpreadsheet size={18} />
            </div>
            <div className="action-card-title">PDF a Excel (.csv)</div>
            <div className="action-card-desc">
              Extrae estados de cuenta, facturas y presupuestos directamente a tablas limpias para Excel.
            </div>
          </button>

          <button type="button" className="action-card" onClick={onOpenSignatureVault}>
            <div className="action-icon-box">
              <Signature size={18} />
            </div>
            <div className="action-card-title">Firmar y Sellar PDF</div>
            <div className="action-card-desc">
              Dibuja, escribe o sube tu firma eliminando el fondo blanco automáticamente en 1 clic.
            </div>
          </button>

          <button type="button" className="action-card" onClick={() => onOpenToolModal('pdf-to-images')}>
            <div className="action-icon-box">
              <FileOutput size={18} />
            </div>
            <div className="action-card-title">PDF a JPG / PNG</div>
            <div className="action-card-desc">
              Exporta todas las páginas en imágenes de 150, 300 o 600 DPI listas para presentación.
            </div>
          </button>

          <button type="button" className="action-card" onClick={() => onOpenToolModal('images-to-pdf')}>
            <div className="action-icon-box">
              <ImagePlus size={18} />
            </div>
            <div className="action-card-title">JPG / PNG a PDF</div>
            <div className="action-card-desc">
              Convierte fotografías o escaneos a PDF con control de orientación y márgenes limpios.
            </div>
          </button>

          <button type="button" className="action-card" onClick={() => onOpenToolModal('crop')}>
            <div className="action-icon-box">
              <Crop size={18} />
            </div>
            <div className="action-card-title">Recortar y Numerar</div>
            <div className="action-card-desc">
              Ajusta márgenes en milímetros, agrega marcas de agua o inserta folios consecutivos Bates.
            </div>
          </button>

          <button type="button" className="action-card" onClick={() => onOpenToolModal('logos')}>
            <div className="action-icon-box">
              <Building2 size={18} />
            </div>
            <div className="action-card-title">Logos ({savedLogosCount}) y Hoja Nueva</div>
            <div className="action-card-desc">
              Administra tus logotipos corporativos sin fondo o crea un PDF A4 en blanco.
            </div>
          </button>
        </section>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: -18, marginBottom: 24 }}>
          <button type="button" className="btn btn-subtle" onClick={onCreateBlankPdf}>
            <FilePlus2 size={14} />
            <span>Crear PDF en Blanco A4</span>
          </button>
        </div>

        {/* 6 Real Test Documents Showcase */}
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
              <span>Laboratorio de Validación: 6 Documentos Reales</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', textTransform: 'none' }}>
                Clic para abrir y auditar en vivo
              </span>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(235px, 1fr))',
                gap: 12,
              }}
            >
              {TEST_DOCUMENTS.map((doc) => (
                <button
                  key={doc.filename}
                  type="button"
                  className="action-card"
                  style={{ textAlign: 'left', padding: '14px 16px', cursor: 'pointer' }}
                  onClick={() => onLoadSamplePdf(doc.filename)}
                  title={`Abrir ${doc.title} para probar edición directa`}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      width: '100%',
                      marginBottom: 6,
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
                    style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 4 }}
                  >
                    {doc.title}
                  </div>
                  <div className="action-card-desc" style={{ fontSize: 11.5, lineHeight: 1.45 }}>
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
              <strong style={{ color: 'var(--text-primary)' }}>Probar Documento Interactivo</strong> para comenzar.
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
