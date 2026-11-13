import React, { useState } from 'react';
import {
  ArrowUpRight,
  BookOpen,
  Building2,
  CheckCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  Columns2,
  Download,
  Eye,
  EyeOff,
  FileCheck2,
  FileOutput,
  FileSpreadsheet,
  Grid2x2,
  Hand,
  Hash,
  Highlighter,
  ImagePlus,
  LayoutList,
  Maximize2,
  MessageSquarePlus,
  MousePointer,
  PenTool,
  Pencil,
  Printer,
  Redo2,
  ScanText,
  Scissors,
  ShieldAlert,
  Signature,
  Sparkles,
  Square,
  Stamp,
  Strikethrough,
  Type,
  Underline,
  Undo2,
  Wand2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import type {
  ActiveTool,
  PaperFilter,
  PdfTabDocument,
  ToolModalKind,
  ViewLayout,
  WorkspaceMode,
} from '../types/pdf';

interface RibbonToolbarProps {
  tab: PdfTabDocument;
  workspaceMode: WorkspaceMode;
  activeTool: ActiveTool;
  splitCompareTabId: string | null;
  availableTabsCount: number;
  onChangeMode: (mode: WorkspaceMode) => void;
  onSelectTool: (tool: ActiveTool) => void;
  onTriggerAddImage: () => void;
  onOpenLogoVault: () => void;
  onOpenSignatureVault: () => void;
  onPlaceQuickStamp: (presetText: string, color: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  onNavigatePage: (pageIndex: number) => void;
  onChangeZoom: (zoom: number) => void;
  onChangeLayout: (layout: ViewLayout) => void;
  onChangePaperFilter: (filter: PaperFilter) => void;
  onToggleSplitCompare: () => void;
  onOpenToolModal: (kind: ToolModalKind) => void;
  onSetDefaultWindowsApp: () => void;
  onPrintDocument: () => void;
  onSaveExportPdf: () => void;
}

const QUICK_STAMPS = [
  { label: 'APROBADO', color: '#0D7A5F' },
  { label: 'PAGADO', color: '#0D7A5F' },
  { label: 'RECIBIDO', color: '#2563EB' },
  { label: 'REVISADO', color: '#4F46E5' },
  { label: 'CONFIDENCIAL', color: '#DC2626' },
  { label: 'URGENTE', color: '#B45309' },
];

export const RibbonToolbar: React.FC<RibbonToolbarProps> = ({
  tab,
  workspaceMode,
  activeTool,
  splitCompareTabId,
  availableTabsCount,
  onChangeMode,
  onSelectTool,
  onTriggerAddImage,
  onOpenLogoVault,
  onOpenSignatureVault,
  onPlaceQuickStamp,
  onUndo,
  onRedo,
  onNavigatePage,
  onChangeZoom,
  onChangeLayout,
  onChangePaperFilter,
  onToggleSplitCompare,
  onOpenToolModal,
  onSetDefaultWindowsApp,
  onPrintDocument,
  onSaveExportPdf,
}) => {
  const [stampMenuOpen, setStampMenuOpen] = useState(false);
  const [proMenuOpen, setProMenuOpen] = useState(false);

  const totalPages = tab.pages.length;
  const currentNum = tab.currentPageIndex + 1;

  return (
    <div className="studio-header">
      {/* Primary Minimalist Acrobat + Thunderbird Mode Bar */}
      <div className="mode-bar" style={{ overflowX: 'auto' }}>
        <div className="toolbar-group">
          <div className="mode-pills">
            <button
              type="button"
              id="mode-reader-btn"
              className={`mode-pill ${workspaceMode === 'reader' ? 'active' : ''}`}
              onClick={() => onChangeMode('reader')}
            >
              <Eye size={14} />
              <span>Leer</span>
            </button>
            <button
              type="button"
              id="mode-edit-btn"
              className={`mode-pill ${workspaceMode === 'edit' ? 'active' : ''}`}
              onClick={() => onChangeMode('edit')}
            >
              <Pencil size={13.5} />
              <span>Editar PDF</span>
            </button>
            <button
              type="button"
              id="mode-organize-btn"
              className={`mode-pill ${workspaceMode === 'organize' ? 'active' : ''}`}
              onClick={() => onChangeMode('organize')}
            >
              <Grid2x2 size={14} />
              <span>Páginas ({totalPages})</span>
            </button>
          </div>

          <div className="toolbar-divider" />

          <button
            type="button"
            className="btn icon-only"
            disabled={tab.undoStack.length === 0}
            onClick={onUndo}
            title="Deshacer cambio (Ctrl+Z)"
          >
            <Undo2 size={15} />
          </button>
          <button
            type="button"
            className="btn icon-only"
            disabled={tab.redoStack.length === 0}
            onClick={onRedo}
            title="Rehacer cambio (Ctrl+Y)"
          >
            <Redo2 size={15} />
          </button>
        </div>

        {/* Center Page & Zoom Controls */}
        {workspaceMode !== 'organize' && (
          <div className="toolbar-group">
            <button
              type="button"
              className="btn icon-only"
              disabled={currentNum <= 1}
              onClick={() => onNavigatePage(tab.currentPageIndex - 1)}
              title="Página anterior"
            >
              <ChevronLeft size={15} />
            </button>
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                fontFamily: 'var(--font-mono)',
                padding: '0 4px',
                minWidth: 56,
                textAlign: 'center',
              }}
            >
              {currentNum} / {totalPages}
            </span>
            <button
              type="button"
              className="btn icon-only"
              disabled={currentNum >= totalPages}
              onClick={() => onNavigatePage(tab.currentPageIndex + 1)}
              title="Página siguiente"
            >
              <ChevronRight size={15} />
            </button>

            <div className="toolbar-divider" />

            <button
              type="button"
              className="btn icon-only"
              onClick={() => onChangeZoom(Math.max(0.4, Math.round((tab.zoom - 0.1) * 100) / 100))}
              title="Alejar zoom"
            >
              <ZoomOut size={15} />
            </button>
            <select
              aria-label="Nivel de zoom"
              className="prop-select"
              style={{ height: 28, fontSize: 12, fontWeight: 600, padding: '0 6px' }}
              value={String(Math.round(tab.zoom * 100))}
              onChange={(e) => onChangeZoom(Number(e.target.value) / 100)}
            >
              {[50, 75, 90, 100, 105, 115, 125, 150, 175, 200, 250].map((pct) => (
                <option key={pct} value={String(pct)}>
                  {pct}%
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn icon-only"
              onClick={() => onChangeZoom(Math.min(3.0, Math.round((tab.zoom + 0.1) * 100) / 100))}
              title="Acercar zoom"
            >
              <ZoomIn size={15} />
            </button>
            <button
              type="button"
              className="btn icon-only"
              onClick={() => onChangeZoom(1.0)}
              title="Ajustar al 100% limpio"
            >
              <Maximize2 size={14} />
            </button>

            <div className="toolbar-divider" />

            <button
              type="button"
              className={`btn icon-only ${tab.viewLayout === 'continuous' ? 'active' : ''}`}
              onClick={() => onChangeLayout('continuous')}
              title="Vista continua"
            >
              <LayoutList size={15} />
            </button>
            <button
              type="button"
              className={`btn icon-only ${tab.viewLayout === 'dual' ? 'active' : ''}`}
              onClick={() => onChangeLayout('dual')}
              title="Vista doble página"
            >
              <BookOpen size={15} />
            </button>
            {availableTabsCount > 1 && (
              <button
                type="button"
                className={`btn icon-only ${splitCompareTabId ? 'active' : ''}`}
                onClick={onToggleSplitCompare}
                title="Comparar 2 PDFs lado a lado"
              >
                <Columns2 size={15} />
              </button>
            )}

            <select
              aria-label="Modo de papel"
              className="prop-select"
              style={{ height: 28, fontSize: 11.5 }}
              value={tab.paperFilter}
              onChange={(e) => onChangePaperFilter(e.target.value as PaperFilter)}
            >
              <option value="original">Papel Original</option>
              <option value="night">Lectura Nocturna</option>
              <option value="sepia">Sepia Cálido</option>
              <option value="contrast">Alto Contraste</option>
            </select>
          </div>
        )}

        {/* Right Primary Actions */}
        <div className="toolbar-group" style={{ position: 'relative' }}>
          <button
            type="button"
            className="btn btn-subtle"
            onClick={onOpenSignatureVault}
            title="Dibujar o insertar firma sin fondo"
          >
            <Signature size={14} />
            <span>Firmar</span>
          </button>

          <div style={{ position: 'relative' }}>
            <button
              type="button"
              id="pro-tools-dropdown-btn"
              className="btn btn-subtle"
              onClick={() => {
                setProMenuOpen((v) => !v);
                setStampMenuOpen(false);
              }}
            >
              <Wand2 size={14} />
              <span>Herramientas</span>
              <ChevronDown size={13} />
            </button>

            {proMenuOpen && (
              <div
                style={{
                  position: 'absolute',
                  right: 0,
                  top: 'calc(100% + 6px)',
                  width: 268,
                  background: 'var(--bg-surface-elevated)',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 'var(--radius-md)',
                  boxShadow: 'var(--shadow-lg)',
                  padding: 6,
                  zIndex: 120,
                }}
                onMouseLeave={() => setProMenuOpen(false)}
              >
                {[
                  { kind: 'logos' as ToolModalKind, icon: <Building2 size={14} />, label: 'Mis Logos Guardados' },
                  { kind: 'merge' as ToolModalKind, icon: <FileCheck2 size={14} />, label: 'Unir varios PDFs' },
                  { kind: 'split' as ToolModalKind, icon: <Scissors size={14} />, label: 'Dividir o extraer páginas' },
                  { kind: 'watermark' as ToolModalKind, icon: <Sparkles size={14} />, label: 'Marca de agua' },
                  { kind: 'numbering' as ToolModalKind, icon: <Hash size={14} />, label: 'Numerar páginas' },
                  { kind: 'images-to-pdf' as ToolModalKind, icon: <ImagePlus size={14} />, label: 'Imágenes a PDF' },
                  { kind: 'pdf-to-images' as ToolModalKind, icon: <FileOutput size={14} />, label: 'PDF a Imágenes PNG/JPG' },
                  { kind: 'export-csv' as ToolModalKind, icon: <FileSpreadsheet size={14} />, label: 'Extraer tablas a Excel (.csv)' },
                  { kind: 'ocr' as ToolModalKind, icon: <ScanText size={14} />, label: 'Extraer texto (OCR)' },
                  { kind: 'metadata' as ToolModalKind, icon: <ShieldAlert size={14} />, label: 'Propiedades del documento' },
                ].map((item) => (
                  <button
                    key={item.kind}
                    type="button"
                    className="btn"
                    style={{ width: '100%', justifyContent: 'flex-start', height: 32 }}
                    onClick={() => {
                      setProMenuOpen(false);
                      onOpenToolModal(item.kind);
                    }}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </button>
                ))}
                <div style={{ height: 1, background: 'var(--border-subtle)', margin: '4px 0' }} />
                <button
                  type="button"
                  className="btn"
                  style={{
                    width: '100%',
                    justifyContent: 'flex-start',
                    height: 34,
                    color: 'var(--accent)',
                    fontWeight: 600,
                  }}
                  onClick={() => {
                    setProMenuOpen(false);
                    onSetDefaultWindowsApp();
                  }}
                >
                  <CheckCheck size={14} />
                  <span>Usar como App PDF Predeterminada</span>
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            className="btn icon-only"
            onClick={onPrintDocument}
            title="Imprimir PDF (Ctrl+P)"
          >
            <Printer size={15} />
          </button>

          <button
            type="button"
            id="save-export-pdf-btn"
            className="btn btn-primary"
            onClick={onSaveExportPdf}
            title="Guardar PDF final con todos los cambios (Ctrl+S)"
          >
            <Download size={14.5} />
            <span>Guardar PDF</span>
          </button>
        </div>
      </div>

      {/* Unified General-Purpose Acrobat Pro Plus Edit Bar */}
      {workspaceMode === 'edit' && (
        <div className="edit-subbar">
          <div className="toolbar-group">
            <button
              type="button"
              className={`tool-chip ${activeTool === 'select' ? 'active' : ''}`}
              onClick={() => onSelectTool('select')}
              title="Seleccionar, mover y escalar elementos"
            >
              <MousePointer size={13.5} />
              <span>Seleccionar</span>
            </button>

            <button
              type="button"
              className={`tool-chip ${activeTool === 'pan' ? 'active' : ''}`}
              onClick={() => onSelectTool('pan')}
              title="Desplazar hoja con la mano"
            >
              <Hand size={13.5} />
            </button>

            <div className="toolbar-divider" />

            <button
              type="button"
              className={`tool-chip highlight-feature ${
                activeTool === 'edit-pdf-text' ? 'active' : ''
              }`}
              onClick={() => onSelectTool('edit-pdf-text')}
              title="Edita o mueve cualquier texto que ya tiene el PDF sin dañar nada"
            >
              <Pencil size={13.5} />
              <span>Editar / Mover Texto PDF</span>
            </button>

            <button
              type="button"
              className={`tool-chip ${activeTool === 'add-text' ? 'active' : ''}`}
              onClick={() => onSelectTool('add-text')}
              title="Agregar un cuadro de texto nuevo"
            >
              <Type size={14} />
              <span>Agregar Texto</span>
            </button>

            <button
              type="button"
              className="tool-chip"
              onClick={onTriggerAddImage}
              title="Insertar imagen limpia o pegar desde portapapeles (Ctrl+V)"
            >
              <ImagePlus size={14} />
              <span>Subir Imagen</span>
            </button>

            <button
              type="button"
              className="tool-chip"
              onClick={onOpenLogoVault}
              title="Insertar logo guardado"
            >
              <Building2 size={14} />
              <span>Logos</span>
            </button>

            <div className="toolbar-divider" />

            <button
              type="button"
              className={`tool-chip ${activeTool === 'highlight' ? 'active' : ''}`}
              onClick={() => onSelectTool('highlight')}
              title="Resaltar texto"
            >
              <Highlighter size={14} />
              <span>Resaltar</span>
            </button>

            <button
              type="button"
              className={`tool-chip ${activeTool === 'underline' ? 'active' : ''}`}
              onClick={() => onSelectTool('underline')}
              title="Subrayar"
            >
              <Underline size={14} />
            </button>

            <button
              type="button"
              className={`tool-chip ${activeTool === 'strikeout' ? 'active' : ''}`}
              onClick={() => onSelectTool('strikeout')}
              title="Tachar"
            >
              <Strikethrough size={14} />
            </button>

            <button
              type="button"
              className={`tool-chip ${activeTool === 'ink' ? 'active' : ''}`}
              onClick={() => onSelectTool('ink')}
              title="Trazo libre"
            >
              <PenTool size={14} />
            </button>

            <button
              type="button"
              className={`tool-chip ${activeTool === 'arrow' ? 'active' : ''}`}
              onClick={() => onSelectTool('arrow')}
              title="Flecha indicadora"
            >
              <ArrowUpRight size={14} />
            </button>

            <button
              type="button"
              className={`tool-chip ${activeTool === 'rect' ? 'active' : ''}`}
              onClick={() => onSelectTool('rect')}
              title="Recuadro"
            >
              <Square size={13.5} />
            </button>

            <button
              type="button"
              className={`tool-chip ${activeTool === 'ellipse' ? 'active' : ''}`}
              onClick={() => onSelectTool('ellipse')}
              title="Círculo / Óvalo"
            >
              <Circle size={13.5} />
            </button>

            <button
              type="button"
              className={`tool-chip ${activeTool === 'note' ? 'active' : ''}`}
              onClick={() => onSelectTool('note')}
              title="Nota adhesiva"
            >
              <MessageSquarePlus size={14} />
            </button>

            <button
              type="button"
              className={`tool-chip ${activeTool === 'redact' ? 'active' : ''}`}
              onClick={() => onSelectTool('redact')}
              title="Ocultar datos confidenciales"
            >
              <EyeOff size={14} />
              <span>Censurar</span>
            </button>

            {/* Quick Stamps Dropdown */}
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                className="tool-chip"
                onClick={() => {
                  setStampMenuOpen((v) => !v);
                  setProMenuOpen(false);
                }}
              >
                <Stamp size={14} />
                <span>Sellos</span>
                <ChevronDown size={12} />
              </button>

              {stampMenuOpen && (
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 'calc(100% + 6px)',
                    width: 196,
                    background: 'var(--bg-surface-elevated)',
                    border: '1px solid var(--border-strong)',
                    borderRadius: 'var(--radius-md)',
                    boxShadow: 'var(--shadow-lg)',
                    padding: 6,
                    zIndex: 130,
                  }}
                  onMouseLeave={() => setStampMenuOpen(false)}
                >
                  {QUICK_STAMPS.map((st) => (
                    <button
                      key={st.label}
                      type="button"
                      className="btn"
                      style={{
                        width: '100%',
                        justifyContent: 'flex-start',
                        height: 30,
                        fontSize: 11.5,
                        fontWeight: 700,
                        color: st.color,
                      }}
                      onClick={() => {
                        setStampMenuOpen(false);
                        onPlaceQuickStamp(st.label, st.color);
                      }}
                    >
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: st.color,
                        }}
                      />
                      <span>{st.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
