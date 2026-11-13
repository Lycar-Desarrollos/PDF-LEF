import React, { useState } from 'react';
import {
  ArrowUpRight,
  BookOpen,
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
  Grid2x2,
  Hand,
  Highlighter,
  ImagePlus,
  LayoutList,
  MessageSquarePlus,
  MousePointer,
  PenTool,
  Pencil,
  Printer,
  Redo2,
  ScanText,
  Scissors,
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
  onPrintDocument: () => void;
  onSaveExportPdf: () => void;
}

const STAMP_PRESETS = [
  { label: 'APROBADO', color: '#0D7A5F' },
  { label: 'PAGADO', color: '#0D7A5F' },
  { label: 'CONFIDENCIAL', color: '#C81E32' },
  { label: 'URGENTE', color: '#C42B1C' },
  { label: 'BORRADOR', color: '#4B515D' },
  { label: 'COPIA CONTROLADA', color: '#1D4ED8' },
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
  onPrintDocument,
  onSaveExportPdf,
}) => {
  const [stampMenuOpen, setStampMenuOpen] = useState(false);
  const [proMenuOpen, setProMenuOpen] = useState(false);

  const totalPages = tab.pages.length;
  const currentNum = tab.currentPageIndex + 1;

  return (
    <div className="studio-header">
      {/* Main Contextual Mode Bar */}
      <div className="mode-bar">
        <div className="toolbar-group">
          <div className="mode-pills">
            <button
              type="button"
              id="mode-reader-btn"
              className={`mode-pill ${workspaceMode === 'reader' ? 'active' : ''}`}
              onClick={() => onChangeMode('reader')}
            >
              <Eye size={14} />
              <span>Lectura</span>
            </button>
            <button
              type="button"
              id="mode-edit-btn"
              className={`mode-pill ${workspaceMode === 'edit' ? 'active' : ''}`}
              onClick={() => onChangeMode('edit')}
            >
              <Pencil size={13.5} />
              <span>Editar y Anotar</span>
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
                padding: '0 6px',
                minWidth: 64,
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
              onClick={() => onChangeZoom(Math.max(0.4, Math.round((tab.zoom - 0.15) * 100) / 100))}
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
              {[50, 75, 90, 100, 115, 125, 150, 175, 200, 250].map((pct) => (
                <option key={pct} value={String(pct)}>
                  {pct}%
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn icon-only"
              onClick={() => onChangeZoom(Math.min(3.0, Math.round((tab.zoom + 0.15) * 100) / 100))}
              title="Acercar zoom"
            >
              <ZoomIn size={15} />
            </button>

            <div className="toolbar-divider" />

            <button
              type="button"
              className={`btn icon-only ${tab.viewLayout === 'continuous' ? 'active' : ''}`}
              onClick={() => onChangeLayout('continuous')}
              title="Desplazamiento vertical continuo"
            >
              <LayoutList size={15} />
            </button>
            <button
              type="button"
              className={`btn icon-only ${tab.viewLayout === 'dual' ? 'active' : ''}`}
              onClick={() => onChangeLayout('dual')}
              title="Vista libro (doble página)"
            >
              <BookOpen size={15} />
            </button>
            {availableTabsCount > 1 && (
              <button
                type="button"
                className={`btn icon-only ${splitCompareTabId ? 'active' : ''}`}
                onClick={onToggleSplitCompare}
                title="Comparar 2 PDFs lado a lado (Vista Dividida)"
              >
                <Columns2 size={15} />
              </button>
            )}

            <select
              aria-label="Filtro de lectura"
              className="prop-select"
              style={{ height: 28, fontSize: 11.5 }}
              value={tab.paperFilter}
              onChange={(e) => onChangePaperFilter(e.target.value as PaperFilter)}
              title="Modo de color del papel"
            >
              <option value="original">Papel Original</option>
              <option value="night">Lectura Nocturna</option>
              <option value="sepia">Sepia Cálido</option>
              <option value="contrast">Nitidez Alta</option>
            </select>
          </div>
        )}

        {/* Right Primary Actions */}
        <div className="toolbar-group" style={{ position: 'relative' }}>
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
              <span>Herramientas Pro</span>
              <ChevronDown size={13} />
            </button>

            {proMenuOpen && (
              <div
                style={{
                  position: 'absolute',
                  right: 0,
                  top: 'calc(100% + 6px)',
                  width: 255,
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
                  { kind: 'merge' as ToolModalKind, icon: <FileCheck2 size={14} />, label: 'Unir varios archivos PDF' },
                  { kind: 'split' as ToolModalKind, icon: <Scissors size={14} />, label: 'Dividir o extraer por rangos' },
                  { kind: 'watermark' as ToolModalKind, icon: <Sparkles size={14} />, label: 'Marca de agua comercial' },
                  { kind: 'numbering' as ToolModalKind, icon: <Type size={14} />, label: 'Numerar páginas y folios Bates' },
                  { kind: 'ocr' as ToolModalKind, icon: <ScanText size={14} />, label: 'OCR Local (extraer texto)' },
                  { kind: 'pdf-to-images' as ToolModalKind, icon: <FileOutput size={14} />, label: 'Exportar páginas a PNG/JPG (.zip)' },
                  { kind: 'images-to-pdf' as ToolModalKind, icon: <ImagePlus size={14} />, label: 'Convertir imágenes a PDF' },
                  { kind: 'metadata' as ToolModalKind, icon: <EyeOff size={14} />, label: 'Propiedades y limpiar metadatos' },
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
            title="Guardar PDF con todos los textos editados, imágenes y firmas (Ctrl+S)"
          >
            <Download size={14.5} />
            <span>Guardar PDF</span>
          </button>
        </div>
      </div>

      {/* Contextual Precision Edit Studio Subbar */}
      {workspaceMode === 'edit' && (
        <div className="edit-subbar">
          <div className="toolbar-group">
            <button
              type="button"
              id="tool-select-btn"
              className={`tool-chip ${activeTool === 'select' ? 'active' : ''}`}
              onClick={() => onSelectTool('select')}
              title="Seleccionar, mover y redimensionar textos o imágenes agregadas (V)"
            >
              <MousePointer size={13.5} />
              <span>Mover Objetos</span>
            </button>

            <button
              type="button"
              id="tool-edit-pdf-text-btn"
              className={`tool-chip highlight-feature ${
                activeTool === 'edit-pdf-text' ? 'active' : ''
              }`}
              onClick={() => onSelectTool('edit-pdf-text')}
              title="Editar o mover cualquier texto original que ya viene dentro del PDF"
            >
              <Pencil size={13.5} />
              <span>Editar / Mover Texto del PDF</span>
            </button>

            <div className="toolbar-divider" />

            <button
              type="button"
              id="tool-add-text-btn"
              className={`tool-chip ${activeTool === 'add-text' ? 'active' : ''}`}
              onClick={() => onSelectTool('add-text')}
              title="Hacer clic en la página para insertar un nuevo cuadro de texto"
            >
              <Type size={14} />
              <span>Agregar Texto</span>
            </button>

            <button
              type="button"
              id="tool-add-image-btn"
              className="tool-chip"
              onClick={onTriggerAddImage}
              title="Insertar imagen, foto o logotipo (PNG, JPG, WebP, SVG) y moverla libremente"
            >
              <ImagePlus size={14} />
              <span>Agregar Imagen</span>
            </button>

            <button
              type="button"
              id="tool-signature-btn"
              className="tool-chip"
              onClick={onOpenSignatureVault}
              title="Crear o estampar firma transparente desde tu Bóveda Local"
            >
              <Signature size={14} />
              <span>Firmar</span>
            </button>

            <div style={{ position: 'relative' }}>
              <button
                type="button"
                id="tool-stamps-btn"
                className={`tool-chip ${stampMenuOpen ? 'active' : ''}`}
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
                    zIndex: 120,
                  }}
                >
                  {STAMP_PRESETS.map((st) => (
                    <button
                      key={st.label}
                      type="button"
                      className="btn"
                      style={{
                        width: '100%',
                        justifyContent: 'flex-start',
                        height: 30,
                        color: st.color,
                        fontWeight: 700,
                        fontSize: 11.5,
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
                      {st.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="toolbar-divider" />

            <button
              type="button"
              className={`tool-chip ${activeTool === 'highlight' ? 'active' : ''}`}
              onClick={() => onSelectTool('highlight')}
              title="Resaltador translúcido"
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

            <div className="toolbar-divider" />

            <button
              type="button"
              className={`tool-chip ${activeTool === 'ink' ? 'active' : ''}`}
              onClick={() => onSelectTool('ink')}
              title="Dibujo libre con suavizado"
            >
              <PenTool size={14} />
              <span>Tinta</span>
            </button>
            <button
              type="button"
              className={`tool-chip ${activeTool === 'arrow' ? 'active' : ''}`}
              onClick={() => onSelectTool('arrow')}
              title="Dibujar flecha indicadora"
            >
              <ArrowUpRight size={14} />
            </button>
            <button
              type="button"
              className={`tool-chip ${activeTool === 'rect' ? 'active' : ''}`}
              onClick={() => onSelectTool('rect')}
              title="Dibujar recuadro"
            >
              <Square size={13.5} />
            </button>
            <button
              type="button"
              className={`tool-chip ${activeTool === 'ellipse' ? 'active' : ''}`}
              onClick={() => onSelectTool('ellipse')}
              title="Dibujar elipse / círculo"
            >
              <Circle size={13.5} />
            </button>
            <button
              type="button"
              className={`tool-chip ${activeTool === 'note' ? 'active' : ''}`}
              onClick={() => onSelectTool('note')}
              title="Agregar comentario / nota adhesiva"
            >
              <MessageSquarePlus size={14} />
            </button>
            <button
              type="button"
              className={`tool-chip ${activeTool === 'redact' ? 'active' : ''}`}
              onClick={() => onSelectTool('redact')}
              title="Censura permanente (oculta datos confidenciales)"
            >
              <EyeOff size={14} />
              <span>Censurar</span>
            </button>
            <button
              type="button"
              className={`tool-chip ${activeTool === 'pan' ? 'active' : ''}`}
              onClick={() => onSelectTool('pan')}
              title="Desplazar vista con la mano"
            >
              <Hand size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
