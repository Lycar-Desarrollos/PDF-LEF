import React, { useState } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  BookOpen,
  Building2,
  Calculator,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  Columns2,
  Compass,
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
  Ruler,
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
  XCircle,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import type {
  ActiveTool,
  PaperFilter,
  PdfTabDocument,
  ScaleCalibration,
  StudioDepartment,
  ToolModalKind,
  ViewLayout,
  WorkspaceMode,
} from '../types/pdf';

interface RibbonToolbarProps {
  tab: PdfTabDocument;
  workspaceMode: WorkspaceMode;
  department: StudioDepartment;
  activeTool: ActiveTool;
  splitCompareTabId: string | null;
  availableTabsCount: number;
  onChangeMode: (mode: WorkspaceMode) => void;
  onChangeDepartment: (dept: StudioDepartment) => void;
  onSelectTool: (tool: ActiveTool) => void;
  onTriggerAddImage: () => void;
  onOpenLogoVault: () => void;
  onOpenSignatureVault: () => void;
  onPlaceQuickStamp: (presetText: string, color: string) => void;
  onInsertEngineeringTitleBlock: () => void;
  onInsertAdminReceivedBlock: () => void;
  onChangeScaleCalibration: (cal: ScaleCalibration) => void;
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

const GENERAL_STAMPS = [
  { label: 'APROBADO', color: '#0D7A5F' },
  { label: 'PAGADO', color: '#0D7A5F' },
  { label: 'CONFIDENCIAL', color: '#C81E32' },
  { label: 'URGENTE', color: '#C42B1C' },
  { label: 'BORRADOR', color: '#4B515D' },
  { label: 'COPIA CONTROLADA', color: '#1D4ED8' },
];

const ACCOUNTING_STAMPS = [
  { label: 'CONTABILIZADO', color: '#0D7A5F' },
  { label: 'CONCILIADO BANCOS', color: '#1D4ED8' },
  { label: 'FACTURA AUDITADA', color: '#0F766E' },
  { label: 'PAGADO · TRANSFERENCIA', color: '#0D7A5F' },
  { label: 'PENDIENTE DE PAGO', color: '#B45309' },
  { label: 'CANCELADO / NULO', color: '#C42B1C' },
];

const ENGINEERING_STAMPS = [
  { label: 'APTO PARA CONSTRUCCION', color: '#0D7A5F' },
  { label: 'REVISION INGENIERIA', color: '#1D4ED8' },
  { label: 'VERIFICAR EN OBRA', color: '#B45309' },
  { label: 'PLANO AS-BUILT', color: '#0F766E' },
  { label: 'OBSOLETO / SUPERADO', color: '#C42B1C' },
];

const SCALE_PRESETS: Array<{ preset: string; ratio: number }> = [
  { preset: '1:1', ratio: 1 },
  { preset: '1:20', ratio: 20 },
  { preset: '1:25', ratio: 25 },
  { preset: '1:50', ratio: 50 },
  { preset: '1:75', ratio: 75 },
  { preset: '1:100', ratio: 100 },
  { preset: '1:200', ratio: 200 },
  { preset: '1:500', ratio: 500 },
];

export const RibbonToolbar: React.FC<RibbonToolbarProps> = ({
  tab,
  workspaceMode,
  department,
  activeTool,
  splitCompareTabId,
  availableTabsCount,
  onChangeMode,
  onChangeDepartment,
  onSelectTool,
  onTriggerAddImage,
  onOpenLogoVault,
  onOpenSignatureVault,
  onPlaceQuickStamp,
  onInsertEngineeringTitleBlock,
  onInsertAdminReceivedBlock,
  onChangeScaleCalibration,
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

  const activeStamps =
    department === 'accounting'
      ? ACCOUNTING_STAMPS
      : department === 'engineering'
      ? ENGINEERING_STAMPS
      : GENERAL_STAMPS;

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
              <span>Ver</span>
            </button>
            <button
              type="button"
              id="mode-edit-btn"
              className={`mode-pill ${workspaceMode === 'edit' ? 'active' : ''}`}
              onClick={() => onChangeMode('edit')}
            >
              <Pencil size={13.5} />
              <span>Editar Suite</span>
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
                minWidth: 62,
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
              {[50, 75, 90, 100, 115, 125, 150, 175, 200, 250, 300].map((pct) => (
                <option key={pct} value={String(pct)}>
                  {pct}%
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn icon-only"
              onClick={() => onChangeZoom(Math.min(3.2, Math.round((tab.zoom + 0.15) * 100) / 100))}
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
              aria-label="Filtro de lectura"
              className="prop-select"
              style={{ height: 28, fontSize: 11.5 }}
              value={tab.paperFilter}
              onChange={(e) => onChangePaperFilter(e.target.value as PaperFilter)}
            >
              <option value="original">Papel Original</option>
              <option value="night">Modo Noche</option>
              <option value="sepia">Sepia Lectura</option>
              <option value="contrast">Nitidez Planos</option>
              <option value="blueprint">Azul Ingeniería</option>
            </select>
          </div>
        )}

        {/* Right Primary Actions */}
        <div className="toolbar-group" style={{ position: 'relative' }}>
          <button
            type="button"
            className="btn btn-subtle"
            onClick={onOpenLogoVault}
            title="Abrir Bóveda de Logos Empresariales para estampar en 1 clic"
          >
            <Building2 size={14} />
            <span>Mis Logos</span>
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
              <span>Utilidades</span>
              <ChevronDown size={13} />
            </button>

            {proMenuOpen && (
              <div
                style={{
                  position: 'absolute',
                  right: 0,
                  top: 'calc(100% + 6px)',
                  width: 272,
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
                  { kind: 'logos' as ToolModalKind, icon: <Building2 size={14} />, label: 'Bóveda de Logos Empresariales' },
                  { kind: 'calculator' as ToolModalKind, icon: <Calculator size={14} />, label: 'Calculadora Contable (IVA / Cinta)' },
                  { kind: 'export-csv' as ToolModalKind, icon: <FileSpreadsheet size={14} />, label: 'Exportar Tablas a Excel (.csv)' },
                  { kind: 'merge' as ToolModalKind, icon: <FileCheck2 size={14} />, label: 'Unir varios archivos PDF' },
                  { kind: 'split' as ToolModalKind, icon: <Scissors size={14} />, label: 'Dividir o extraer por rangos' },
                  { kind: 'watermark' as ToolModalKind, icon: <Sparkles size={14} />, label: 'Marca de agua comercial' },
                  { kind: 'numbering' as ToolModalKind, icon: <Hash size={14} />, label: 'Numerar páginas y folios Bates' },
                  { kind: 'images-to-pdf' as ToolModalKind, icon: <ImagePlus size={14} />, label: 'Convertir imágenes a PDF' },
                  { kind: 'pdf-to-images' as ToolModalKind, icon: <FileOutput size={14} />, label: 'Exportar páginas a PNG/JPG (.zip)' },
                  { kind: 'ocr' as ToolModalKind, icon: <ScanText size={14} />, label: 'OCR Local (extraer texto)' },
                  { kind: 'metadata' as ToolModalKind, icon: <ShieldAlert size={14} />, label: 'Propiedades y limpiar metadatos' },
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
            title="Guardar PDF final con todos los cambios (Ctrl+S)"
          >
            <Download size={14.5} />
            <span>Guardar PDF</span>
          </button>
        </div>
      </div>

      {/* Thunderbird-Inspired Department Switcher + Contextual Precision Tools */}
      {workspaceMode === 'edit' && (
        <div className="edit-subbar">
          <div className="toolbar-group">
            {/* Department Selector */}
            <div
              style={{
                display: 'inline-flex',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 7,
                padding: 2,
                gap: 2,
              }}
            >
              {(
                [
                  { id: 'general', label: 'Edición General' },
                  { id: 'engineering', label: 'Ingeniería' },
                  { id: 'accounting', label: 'Contabilidad' },
                  { id: 'admin', label: 'Administración' },
                ] as Array<{ id: StudioDepartment; label: string }>
              ).map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => onChangeDepartment(d.id)}
                  style={{
                    height: 25,
                    padding: '0 9px',
                    borderRadius: 5,
                    border: 'none',
                    fontSize: 11.5,
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: department === d.id ? 'var(--accent)' : 'transparent',
                    color:
                      department === d.id
                        ? 'var(--text-on-accent)'
                        : 'var(--text-secondary)',
                  }}
                >
                  {d.label}
                </button>
              ))}
            </div>

            <div className="toolbar-divider" />

            {/* Core Always-Available Cursor & Direct Text Edit */}
            <button
              type="button"
              className={`tool-chip ${activeTool === 'select' ? 'active' : ''}`}
              onClick={() => onSelectTool('select')}
              title="Seleccionar, mover y redimensionar objetos e imágenes"
            >
              <MousePointer size={13.5} />
              <span>Mover</span>
            </button>

            <button
              type="button"
              className={`tool-chip highlight-feature ${
                activeTool === 'edit-pdf-text' ? 'active' : ''
              }`}
              onClick={() => onSelectTool('edit-pdf-text')}
              title="Editar o mover cualquier texto existente dentro del PDF"
            >
              <Pencil size={13.5} />
              <span>Editar Texto PDF</span>
            </button>

            <button
              type="button"
              className="tool-chip"
              onClick={onTriggerAddImage}
              title="Subir imagen, plano, foto o captura (o pega con Ctrl+V)"
            >
              <ImagePlus size={14} />
              <span>Subir Imagen</span>
            </button>

            <div className="toolbar-divider" />

            {/* DEPARTMENT 1: GENERAL */}
            {department === 'general' && (
              <>
                <button
                  type="button"
                  className={`tool-chip ${activeTool === 'add-text' ? 'active' : ''}`}
                  onClick={() => onSelectTool('add-text')}
                >
                  <Type size={14} />
                  <span>Nuevo Texto</span>
                </button>
                <button
                  type="button"
                  className="tool-chip"
                  onClick={onOpenSignatureVault}
                >
                  <Signature size={14} />
                  <span>Firmar</span>
                </button>
                <button
                  type="button"
                  className={`tool-chip ${activeTool === 'highlight' ? 'active' : ''}`}
                  onClick={() => onSelectTool('highlight')}
                >
                  <Highlighter size={14} />
                  <span>Resaltar</span>
                </button>
                <button
                  type="button"
                  className={`tool-chip ${activeTool === 'underline' ? 'active' : ''}`}
                  onClick={() => onSelectTool('underline')}
                >
                  <Underline size={14} />
                </button>
                <button
                  type="button"
                  className={`tool-chip ${activeTool === 'strikeout' ? 'active' : ''}`}
                  onClick={() => onSelectTool('strikeout')}
                >
                  <Strikethrough size={14} />
                </button>
                <button
                  type="button"
                  className={`tool-chip ${activeTool === 'ink' ? 'active' : ''}`}
                  onClick={() => onSelectTool('ink')}
                >
                  <PenTool size={14} />
                  <span>Tinta</span>
                </button>
                <button
                  type="button"
                  className={`tool-chip ${activeTool === 'arrow' ? 'active' : ''}`}
                  onClick={() => onSelectTool('arrow')}
                >
                  <ArrowUpRight size={14} />
                </button>
                <button
                  type="button"
                  className={`tool-chip ${activeTool === 'rect' ? 'active' : ''}`}
                  onClick={() => onSelectTool('rect')}
                >
                  <Square size={13.5} />
                </button>
                <button
                  type="button"
                  className={`tool-chip ${activeTool === 'ellipse' ? 'active' : ''}`}
                  onClick={() => onSelectTool('ellipse')}
                >
                  <Circle size={13.5} />
                </button>
                <button
                  type="button"
                  className={`tool-chip ${activeTool === 'note' ? 'active' : ''}`}
                  onClick={() => onSelectTool('note')}
                >
                  <MessageSquarePlus size={14} />
                </button>
                <button
                  type="button"
                  className={`tool-chip ${activeTool === 'redact' ? 'active' : ''}`}
                  onClick={() => onSelectTool('redact')}
                >
                  <EyeOff size={14} />
                  <span>Censurar</span>
                </button>
              </>
            )}

            {/* DEPARTMENT 2: ENGINEERING & CAD PLANS */}
            {department === 'engineering' && (
              <>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Compass size={14} style={{ color: 'var(--accent)' }} />
                  <select
                    aria-label="Escala de plano"
                    className="prop-select"
                    style={{ height: 28, fontSize: 11.5, fontWeight: 700 }}
                    value={tab.scaleCalibration.preset}
                    onChange={(e) => {
                      const found =
                        SCALE_PRESETS.find((s) => s.preset === e.target.value) ||
                        SCALE_PRESETS[5];
                      onChangeScaleCalibration({
                        ...tab.scaleCalibration,
                        preset: found.preset,
                        ratio: found.ratio,
                      });
                    }}
                  >
                    {SCALE_PRESETS.map((sp) => (
                      <option key={sp.preset} value={sp.preset}>
                        Escala {sp.preset}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label="Unidad de ingeniería"
                    className="prop-select"
                    style={{ height: 28, fontSize: 11.5 }}
                    value={tab.scaleCalibration.unit}
                    onChange={(e) =>
                      onChangeScaleCalibration({
                        ...tab.scaleCalibration,
                        unit: e.target.value as ScaleCalibration['unit'],
                      })
                    }
                  >
                    <option value="m">Metros (m)</option>
                    <option value="cm">cm</option>
                    <option value="mm">mm</option>
                    <option value="ft">Pies (ft)</option>
                  </select>
                </div>

                <button
                  type="button"
                  className={`tool-chip ${activeTool === 'measure-line' ? 'active' : ''}`}
                  onClick={() => onSelectTool('measure-line')}
                  title="Arrastra de punto A a punto B para acotar longitud real a escala"
                >
                  <Ruler size={14} />
                  <span>Acotar Distancia</span>
                </button>

                <button
                  type="button"
                  className={`tool-chip ${activeTool === 'measure-area' ? 'active' : ''}`}
                  onClick={() => onSelectTool('measure-area')}
                  title="Arrastra un rectángulo en el plano para calcular Área (m²)"
                >
                  <Maximize2 size={13.5} />
                  <span>Medir Área m²</span>
                </button>

                <button
                  type="button"
                  className={`tool-chip ${activeTool === 'callout' ? 'active' : ''}`}
                  onClick={() => onSelectTool('callout')}
                  title="Colocar globo numerado consecutivo (1, 2, 3…) para revisión de planos"
                >
                  <Hash size={14} />
                  <span>Globo #{tab.nextCalloutNumber}</span>
                </button>

                <button
                  type="button"
                  className="tool-chip"
                  onClick={onInsertEngineeringTitleBlock}
                  title="Insertar cajetín de ingeniería con proyecto, escala, responsable y fecha"
                >
                  <FileCheck2 size={14} />
                  <span>Cajetín Técnico</span>
                </button>
              </>
            )}

            {/* DEPARTMENT 3: ACCOUNTING & AUDIT */}
            {department === 'accounting' && (
              <>
                <button
                  type="button"
                  className="tool-chip highlight-feature"
                  onClick={() => onOpenToolModal('calculator')}
                  title="Calculadora de cinta contable con desglose de IVA / ISR e inserción en el PDF"
                >
                  <Calculator size={14} />
                  <span>Cinta Contable / IVA</span>
                </button>

                <button
                  type="button"
                  className="tool-chip"
                  onClick={() => onOpenToolModal('export-csv')}
                  title="Extraer tablas y partidas de este PDF para abrirlas en Microsoft Excel (.csv)"
                >
                  <FileSpreadsheet size={14} />
                  <span>Exportar a Excel (.csv)</span>
                </button>

                <button
                  type="button"
                  className={`tool-chip ${activeTool === 'tick-ok' ? 'active' : ''}`}
                  onClick={() => onSelectTool('tick-ok')}
                  style={{ color: '#0D7A5F' }}
                  title="Clic en estados de cuenta para marcar partida conciliada (✓)"
                >
                  <CheckCircle2 size={14} />
                  <span>Conciliado ✓</span>
                </button>

                <button
                  type="button"
                  className={`tool-chip ${activeTool === 'tick-err' ? 'active' : ''}`}
                  onClick={() => onSelectTool('tick-err')}
                  style={{ color: '#C42B1C' }}
                  title="Clic para señalar diferencia o cargo no reconocido (✗)"
                >
                  <XCircle size={14} />
                  <span>Diferencia ✗</span>
                </button>

                <button
                  type="button"
                  className={`tool-chip ${activeTool === 'tick-warn' ? 'active' : ''}`}
                  onClick={() => onSelectTool('tick-warn')}
                  style={{ color: '#B45309' }}
                  title="Clic para marcar pendiente de comprobante / CFDI (!)"
                >
                  <AlertTriangle size={14} />
                  <span>Revisar !</span>
                </button>
              </>
            )}

            {/* DEPARTMENT 4: ADMINISTRATION & CORPORATE */}
            {department === 'admin' && (
              <>
                <button
                  type="button"
                  className="tool-chip highlight-feature"
                  onClick={onOpenLogoVault}
                >
                  <Building2 size={14} />
                  <span>Estampar Logo Empresa</span>
                </button>

                <button
                  type="button"
                  className="tool-chip"
                  onClick={onOpenSignatureVault}
                >
                  <Signature size={14} />
                  <span>Firmar Documento</span>
                </button>

                <button
                  type="button"
                  className="tool-chip"
                  onClick={onInsertAdminReceivedBlock}
                  title="Insertar acuse administrativo de RECIBIDO con fecha, hora y firma"
                >
                  <FileCheck2 size={14} />
                  <span>Acuse RECIBIDO</span>
                </button>

                <button
                  type="button"
                  className="tool-chip"
                  onClick={() => onOpenToolModal('numbering')}
                >
                  <Hash size={14} />
                  <span>Folios Bates</span>
                </button>

                <button
                  type="button"
                  className="tool-chip"
                  onClick={() => onOpenToolModal('watermark')}
                >
                  <Sparkles size={14} />
                  <span>Marca de Agua</span>
                </button>
              </>
            )}

            {/* Contextual Stamps Dropdown for All Departments */}
            <div style={{ position: 'relative' }}>
              <button
                type="button"
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
                    right: 0,
                    top: 'calc(100% + 6px)',
                    width: 225,
                    background: 'var(--bg-surface-elevated)',
                    border: '1px solid var(--border-strong)',
                    borderRadius: 'var(--radius-md)',
                    boxShadow: 'var(--shadow-lg)',
                    padding: 6,
                    zIndex: 120,
                  }}
                >
                  {activeStamps.map((st) => (
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
                        fontSize: 11,
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
                          flexShrink: 0,
                        }}
                      />
                      <span>{st.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

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
