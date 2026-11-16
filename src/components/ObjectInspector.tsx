import React from 'react';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowUp,
  Bold,
  Copy,
  Crop,
  FileDown,
  ImagePlus,
  Italic,
  Move,
  PanelRightClose,
  Pencil,
  RotateCcw,
  Trash2,
  Wand2,
} from 'lucide-react';
import type {
  FontFamilyChoice,
  NativePdfTextItem,
  PdfOverlayElement,
  PdfTabDocument,
  ToolModalKind,
} from '../types/pdf';
import { removeSignatureBackground } from '../utils/imageUtils';

interface ObjectInspectorProps {
  tab: PdfTabDocument;
  selectedElement: PdfOverlayElement | null;
  selectedNativeText: NativePdfTextItem | null;
  onUpdateElement: (
    id: string,
    patch: Partial<PdfOverlayElement>,
    pushUndo?: boolean
  ) => void;
  onDuplicateElement: (id: string) => void;
  onReorderLayer: (id: string, dir: 'front' | 'back') => void;
  onDeleteElement: (id: string) => void;
  onReplaceImage: (id: string) => void;
  onUpdateNativeText: (item: NativePdfTextItem, pushUndo?: boolean) => void;
  onResetNativeText: (id: string) => void;
  onActivatePdfTextEditTool: () => void;
  onTriggerInsertImage: () => void;
  onOpenToolModal?: (kind: ToolModalKind) => void;
  onCloseInspector?: () => void;
}

const SWATCH_COLORS = [
  '#111318',
  '#2563EB',
  '#0D7A5F',
  '#D9793B',
  '#DC2626',
  '#525866',
  '#FACC15',
  '#FFFFFF',
];

const PATCH_BG_SWATCHES = [
  '#FFFFFF',
  '#F8FAFC',
  '#F1F5F9',
  '#4A4A4A',
  '#1E293B',
  '#0F172A',
];

const ELEMENT_KIND_LABELS: Record<PdfOverlayElement['kind'], string> = {
  text: 'Texto',
  image: 'Imagen',
  signature: 'Firma',
  stamp: 'Sello',
  highlight: 'Resaltado',
  underline: 'Subrayado',
  strikeout: 'Tachado',
  redact: 'Censura',
  rect: 'Recuadro',
  ellipse: 'Círculo',
  arrow: 'Flecha',
  ink: 'Trazo libre',
  note: 'Nota',
  dimension: 'Medida',
  area: 'Área',
  callout: 'Marcador',
  tickmark: 'Verificación',
};

export const ObjectInspector: React.FC<ObjectInspectorProps> = ({
  tab,
  selectedElement,
  selectedNativeText,
  onUpdateElement,
  onDuplicateElement,
  onReorderLayer,
  onDeleteElement,
  onReplaceImage,
  onUpdateNativeText,
  onResetNativeText,
  onActivatePdfTextEditTool,
  onTriggerInsertImage,
  onOpenToolModal,
  onCloseInspector,
}) => {
  // 1. Inspector for Selected Existing Native PDF Text
  if (selectedNativeText) {
    const nudgeNative = (dx: number, dy: number) => {
      onUpdateNativeText(
        {
          ...selectedNativeText,
          x: Math.max(0, Math.min(0.95, selectedNativeText.x + dx)),
          y: Math.max(0, Math.min(0.96, selectedNativeText.y + dy)),
          modified: true,
        },
        true
      );
    };

    const currentPatchBg = selectedNativeText.bgPatchColor || '#FFFFFF';

    return (
      <aside className="right-inspector">
        <div className="inspector-section">
          <div className="inspector-title">
            <span>Texto Original del PDF</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {selectedNativeText.modified && (
                <span style={{ color: 'var(--accent)', fontSize: 10 }}>EDITADO</span>
              )}
              {onCloseInspector && (
                <button
                  type="button"
                  className="btn icon-only"
                  style={{ width: 22, height: 22 }}
                  onClick={onCloseInspector}
                  title="Ocultar panel derecho"
                >
                  <PanelRightClose size={13} />
                </button>
              )}
            </div>
          </div>
          <textarea
            className="prop-input"
            spellCheck={false}
            autoCorrect="off"
            style={{ width: '100%', height: 68, padding: 8, resize: 'vertical' }}
            value={selectedNativeText.text}
            onChange={(e) =>
              onUpdateNativeText(
                { ...selectedNativeText, text: e.target.value, modified: true },
                true
              )
            }
          />
        </div>

        <div className="inspector-section">
          <div className="inspector-title">Tipografía y Tamaño</div>
          <div className="prop-row">
            <span className="prop-label">Fuente</span>
            <select
              className="prop-select"
              style={{ width: 128 }}
              value={selectedNativeText.fontFamily}
              onChange={(e) =>
                onUpdateNativeText(
                  {
                    ...selectedNativeText,
                    fontFamily: e.target.value as FontFamilyChoice,
                    modified: true,
                  },
                  true
                )
              }
            >
              <option value="sans">Sans Moderna</option>
              <option value="serif">Serif Editorial</option>
              <option value="mono">Monoespaciada</option>
            </select>
          </div>

          <div className="prop-row">
            <span className="prop-label">Tamaño (pt)</span>
            <input
              type="number"
              min={6}
              max={72}
              step={0.5}
              className="prop-input"
              style={{ width: 78 }}
              value={selectedNativeText.fontSizePt}
              onChange={(e) =>
                onUpdateNativeText(
                  {
                    ...selectedNativeText,
                    fontSizePt: Number(e.target.value) || 11,
                    modified: true,
                  },
                  true
                )
              }
            />
          </div>

          <div className="prop-row">
            <span className="prop-label">Estilo</span>
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                type="button"
                className={`btn icon-only ${
                  selectedNativeText.fontWeight === 'bold' ? 'active' : ''
                }`}
                onClick={() =>
                  onUpdateNativeText(
                    {
                      ...selectedNativeText,
                      fontWeight:
                        selectedNativeText.fontWeight === 'bold' ? 'normal' : 'bold',
                      modified: true,
                    },
                    true
                  )
                }
              >
                <Bold size={14} />
              </button>
              <button
                type="button"
                className={`btn icon-only ${
                  selectedNativeText.fontStyle === 'italic' ? 'active' : ''
                }`}
                onClick={() =>
                  onUpdateNativeText(
                    {
                      ...selectedNativeText,
                      fontStyle:
                        selectedNativeText.fontStyle === 'italic' ? 'normal' : 'italic',
                      modified: true,
                    },
                    true
                  )
                }
              >
                <Italic size={14} />
              </button>
            </div>
          </div>
        </div>

        <div className="inspector-section">
          <div className="inspector-title">Color del Texto</div>
          <div className="color-swatches">
            {SWATCH_COLORS.map((col) => (
              <button
                key={col}
                type="button"
                className={`swatch-btn ${
                  selectedNativeText.color.toLowerCase() === col.toLowerCase()
                    ? 'active'
                    : ''
                }`}
                style={{ backgroundColor: col }}
                onClick={() =>
                  onUpdateNativeText(
                    { ...selectedNativeText, color: col, modified: true },
                    true
                  )
                }
              />
            ))}
            <input
              type="color"
              value={selectedNativeText.color}
              onChange={(e) =>
                onUpdateNativeText(
                  { ...selectedNativeText, color: e.target.value, modified: true },
                  true
                )
              }
              style={{ width: 24, height: 24, border: 'none', padding: 0, cursor: 'pointer' }}
            />
          </div>

          <div className="inspector-title" style={{ marginTop: 12 }}>
            Color de Fondo (Parche)
          </div>
          <div className="color-swatches">
            {PATCH_BG_SWATCHES.map((col) => (
              <button
                key={col}
                type="button"
                className={`swatch-btn ${
                  currentPatchBg.toLowerCase() === col.toLowerCase() ? 'active' : ''
                }`}
                style={{ backgroundColor: col }}
                onClick={() =>
                  onUpdateNativeText(
                    { ...selectedNativeText, bgPatchColor: col, modified: true },
                    true
                  )
                }
              />
            ))}
            <input
              type="color"
              value={currentPatchBg}
              onChange={(e) =>
                onUpdateNativeText(
                  { ...selectedNativeText, bgPatchColor: e.target.value, modified: true },
                  true
                )
              }
              style={{ width: 24, height: 24, border: 'none', padding: 0, cursor: 'pointer' }}
            />
          </div>
        </div>

        <div className="inspector-section">
          <div className="inspector-title">Mover con Precisión</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
            <button type="button" className="btn btn-subtle" onClick={() => nudgeNative(-0.005, 0)}>
              ←
            </button>
            <button type="button" className="btn btn-subtle" onClick={() => nudgeNative(0, -0.005)}>
              ↑
            </button>
            <button type="button" className="btn btn-subtle" onClick={() => nudgeNative(0, 0.005)}>
              ↓
            </button>
            <button type="button" className="btn btn-subtle" onClick={() => nudgeNative(0.005, 0)}>
              →
            </button>
          </div>
        </div>

        <div className="inspector-section" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button
            type="button"
            className="btn btn-subtle"
            style={{ width: '100%' }}
            onClick={() => onResetNativeText(selectedNativeText.id)}
          >
            <RotateCcw size={14} />
            <span>Restaurar original</span>
          </button>
          <button
            type="button"
            className="btn btn-subtle"
            style={{ width: '100%', color: 'var(--danger)' }}
            onClick={() =>
              onUpdateNativeText(
                { ...selectedNativeText, deleted: true, modified: true },
                true
              )
            }
          >
            <Trash2 size={14} />
            <span>Eliminar texto del PDF</span>
          </button>
        </div>
      </aside>
    );
  }

  // 2. Inspector for Selected Added Overlay Object
  if (selectedElement) {
    const el = selectedElement;
    const nudgeEl = (dx: number, dy: number) => {
      onUpdateElement(
        el.id,
        {
          x: Math.max(0, Math.min(1 - el.width, el.x + dx)),
          y: Math.max(0, Math.min(1 - el.height, el.y + dy)),
        },
        true
      );
    };

    return (
      <aside className="right-inspector">
        <div className="inspector-section">
          <div className="inspector-title">
            <span>Propiedades · {ELEMENT_KIND_LABELS[el.kind] || 'Objeto'}</span>
            {onCloseInspector && (
              <button
                type="button"
                className="btn icon-only"
                style={{ width: 22, height: 22 }}
                onClick={onCloseInspector}
                title="Ocultar panel derecho"
              >
                <PanelRightClose size={13} />
              </button>
            )}
          </div>

          {(el.kind === 'text' ||
            el.kind === 'stamp' ||
            el.kind === 'note' ||
            el.kind === 'callout' ||
            el.kind === 'dimension' ||
            el.kind === 'area' ||
            el.kind === 'tickmark') && (
            <div style={{ marginBottom: 10 }}>
              <div className="prop-label" style={{ marginBottom: 4 }}>
                Contenido / Etiqueta
              </div>
              <textarea
                className="prop-input"
                spellCheck={false}
                autoCorrect="off"
                style={{ width: '100%', height: 64, padding: 8, resize: 'vertical' }}
                value={el.text || ''}
                onChange={(e) =>
                  onUpdateElement(el.id, { text: e.target.value }, true)
                }
              />
            </div>
          )}

          {(el.kind === 'stamp' ||
            el.kind === 'signature' ||
            el.kind === 'dimension' ||
            el.kind === 'area') && (
            <div>
              <div className="prop-label" style={{ marginBottom: 4 }}>
                Subtítulo / Fecha
              </div>
              <input
                type="text"
                className="prop-input"
                style={{ width: '100%' }}
                placeholder="Ej. Aprobado · Dirección General"
                value={el.subText || ''}
                onChange={(e) =>
                  onUpdateElement(el.id, { subText: e.target.value }, true)
                }
              />
            </div>
          )}

          {el.kind === 'image' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
              {el.dataUrl && (
                <button
                  type="button"
                  className="btn btn-subtle"
                  style={{ width: '100%', color: 'var(--accent)', fontWeight: 600 }}
                  onClick={async () => {
                    if (!el.dataUrl) return;
                    const cleaned = await removeSignatureBackground(el.dataUrl, undefined, 232);
                    onUpdateElement(el.id, { dataUrl: cleaned }, true);
                  }}
                >
                  <Wand2 size={14} />
                  <span>Quitar fondo blanco</span>
                </button>
              )}
              <button
                type="button"
                className="btn btn-subtle"
                style={{ width: '100%' }}
                onClick={() => onReplaceImage(el.id)}
              >
                <ImagePlus size={14} />
                <span>Cambiar imagen…</span>
              </button>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
                <button
                  type="button"
                  className="btn btn-subtle"
                  style={{ fontSize: 11 }}
                  onClick={() =>
                    onUpdateElement(
                      el.id,
                      {
                        width: Math.max(0.06, el.width * 0.75),
                        height: Math.max(0.04, el.height * 0.75),
                      },
                      true
                    )
                  }
                >
                  − Tamaño
                </button>
                <button
                  type="button"
                  className="btn btn-subtle"
                  style={{ fontSize: 11 }}
                  onClick={() =>
                    onUpdateElement(
                      el.id,
                      {
                        width: Math.min(0.92, el.width * 1.25),
                        height: Math.min(0.92, el.height * 1.25),
                      },
                      true
                    )
                  }
                >
                  + Tamaño
                </button>
                <button
                  type="button"
                  className="btn btn-subtle"
                  style={{ fontSize: 11 }}
                  onClick={() =>
                    onUpdateElement(
                      el.id,
                      { x: Math.max(0, 0.5 - el.width / 2) },
                      true
                    )
                  }
                >
                  Centrar
                </button>
              </div>
            </div>
          )}
        </div>

        {el.kind === 'text' && (
          <div className="inspector-section">
            <div className="inspector-title">Formato de Texto</div>
            <div className="prop-row">
              <span className="prop-label">Fuente</span>
              <select
                className="prop-select"
                style={{ width: 128 }}
                value={el.fontFamily || 'sans'}
                onChange={(e) =>
                  onUpdateElement(
                    el.id,
                    { fontFamily: e.target.value as FontFamilyChoice },
                    true
                  )
                }
              >
                <option value="sans">Sans Moderna</option>
                <option value="serif">Serif Clásica</option>
                <option value="mono">Monoespaciada</option>
                <option value="script">Caligráfica</option>
              </select>
            </div>

            <div className="prop-row">
              <span className="prop-label">Tamaño (pt)</span>
              <input
                type="number"
                min={6}
                max={96}
                className="prop-input"
                style={{ width: 76 }}
                value={el.fontSizePt || 12}
                onChange={(e) =>
                  onUpdateElement(
                    el.id,
                    { fontSizePt: Number(e.target.value) || 12 },
                    true
                  )
                }
              />
            </div>

            <div className="prop-row">
              <span className="prop-label">Alineación</span>
              <div style={{ display: 'flex', gap: 3 }}>
                <button
                  type="button"
                  className={`btn icon-only ${el.fontWeight === 'bold' ? 'active' : ''}`}
                  style={{ width: 26, height: 26 }}
                  onClick={() =>
                    onUpdateElement(
                      el.id,
                      { fontWeight: el.fontWeight === 'bold' ? 'normal' : 'bold' },
                      true
                    )
                  }
                >
                  <Bold size={12.5} />
                </button>
                <button
                  type="button"
                  className={`btn icon-only ${el.fontStyle === 'italic' ? 'active' : ''}`}
                  style={{ width: 26, height: 26 }}
                  onClick={() =>
                    onUpdateElement(
                      el.id,
                      { fontStyle: el.fontStyle === 'italic' ? 'normal' : 'italic' },
                      true
                    )
                  }
                >
                  <Italic size={12.5} />
                </button>
                <button
                  type="button"
                  className={`btn icon-only ${el.textAlign === 'left' ? 'active' : ''}`}
                  style={{ width: 26, height: 26 }}
                  onClick={() => onUpdateElement(el.id, { textAlign: 'left' }, true)}
                >
                  <AlignLeft size={12.5} />
                </button>
                <button
                  type="button"
                  className={`btn icon-only ${el.textAlign === 'center' ? 'active' : ''}`}
                  style={{ width: 26, height: 26 }}
                  onClick={() => onUpdateElement(el.id, { textAlign: 'center' }, true)}
                >
                  <AlignCenter size={12.5} />
                </button>
                <button
                  type="button"
                  className={`btn icon-only ${el.textAlign === 'right' ? 'active' : ''}`}
                  style={{ width: 26, height: 26 }}
                  onClick={() => onUpdateElement(el.id, { textAlign: 'right' }, true)}
                >
                  <AlignRight size={12.5} />
                </button>
              </div>
            </div>
          </div>
        )}

        {el.kind !== 'image' && el.kind !== 'signature' && el.kind !== 'redact' && (
          <div className="inspector-section">
            <div className="inspector-title">Color Principal</div>
            <div className="color-swatches">
              {SWATCH_COLORS.map((col) => (
                <button
                  key={col}
                  type="button"
                  className={`swatch-btn ${
                    (el.color || '').toLowerCase() === col.toLowerCase() ? 'active' : ''
                  }`}
                  style={{ backgroundColor: col }}
                  onClick={() => onUpdateElement(el.id, { color: col }, true)}
                />
              ))}
              <input
                type="color"
                value={el.color || '#2563EB'}
                onChange={(e) => onUpdateElement(el.id, { color: e.target.value }, true)}
                style={{ width: 24, height: 24, border: 'none', padding: 0, cursor: 'pointer' }}
              />
            </div>
          </div>
        )}

        <div className="inspector-section">
          <div className="inspector-title">Apariencia y Posición</div>
          <div className="prop-row">
            <span className="prop-label">Opacidad ({Math.round((el.opacity ?? 1) * 100)}%)</span>
            <input
              type="range"
              min={0.1}
              max={1}
              step={0.05}
              value={el.opacity ?? 1}
              onChange={(e) =>
                onUpdateElement(el.id, { opacity: Number(e.target.value) }, true)
              }
              style={{ width: 100 }}
            />
          </div>

          {(el.kind === 'image' || el.kind === 'signature') && (
            <div className="prop-row">
              <span className="prop-label">Mantener proporción</span>
              <button
                type="button"
                className={`switch ${el.preserveAspect ? 'on' : ''}`}
                onClick={() =>
                  onUpdateElement(
                    el.id,
                    { preserveAspect: !el.preserveAspect },
                    true
                  )
                }
              />
            </div>
          )}

          <div className="prop-label" style={{ marginTop: 8, marginBottom: 6 }}>
            Ajuste fino de posición
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
            <button type="button" className="btn btn-subtle" onClick={() => nudgeEl(-0.005, 0)}>
              ←
            </button>
            <button type="button" className="btn btn-subtle" onClick={() => nudgeEl(0, -0.005)}>
              ↑
            </button>
            <button type="button" className="btn btn-subtle" onClick={() => nudgeEl(0, 0.005)}>
              ↓
            </button>
            <button type="button" className="btn btn-subtle" onClick={() => nudgeEl(0.005, 0)}>
              →
            </button>
          </div>
        </div>

        <div className="inspector-section" style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            <button
              type="button"
              className="btn btn-subtle"
              onClick={() => onReorderLayer(el.id, 'front')}
            >
              <ArrowUp size={13.5} />
              <span>Al frente</span>
            </button>
            <button
              type="button"
              className="btn btn-subtle"
              onClick={() => onReorderLayer(el.id, 'back')}
            >
              <ArrowDown size={13.5} />
              <span>Al fondo</span>
            </button>
          </div>
          <button
            type="button"
            className="btn btn-subtle"
            onClick={() => onDuplicateElement(el.id)}
          >
            <Copy size={13.5} />
            <span>Duplicar objeto</span>
          </button>
          <button
            type="button"
            className="btn btn-subtle"
            style={{ color: 'var(--danger)' }}
            onClick={() => onDeleteElement(el.id)}
          >
            <Trash2 size={13.5} />
            <span>Eliminar objeto</span>
          </button>
        </div>
      </aside>
    );
  }

  // 3. Default Contextual Studio Guide when nothing is selected
  return (
    <aside className="right-inspector">
      <div className="inspector-section">
        <div className="inspector-title">
          <span>Estudio de Edición</span>
          {onCloseInspector && (
            <button
              type="button"
              className="btn icon-only"
              style={{ width: 22, height: 22 }}
              onClick={onCloseInspector}
              title="Ocultar panel derecho"
            >
              <PanelRightClose size={13} />
            </button>
          )}
        </div>
        <p style={{ fontSize: 11.5, color: 'var(--text-secondary)', lineHeight: 1.48, margin: '0 0 12px' }}>
          Selecciona cualquier texto o imagen en la hoja para ajustar su formato, o ejecuta una acción rápida:
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <button
            type="button"
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'flex-start' }}
            onClick={onActivatePdfTextEditTool}
          >
            <Pencil size={14} />
            <span>Editar / Mover Texto PDF</span>
          </button>

          <button
            type="button"
            className="btn btn-subtle"
            style={{ width: '100%', justifyContent: 'flex-start' }}
            onClick={onTriggerInsertImage}
          >
            <ImagePlus size={14} />
            <span>Insertar Imagen</span>
          </button>

          {onOpenToolModal && (
            <>
              <button
                type="button"
                className="btn btn-subtle"
                style={{ width: '100%', justifyContent: 'flex-start' }}
                onClick={() => onOpenToolModal('remove-pages')}
              >
                <Trash2 size={14} />
                <span>Eliminar Páginas…</span>
              </button>
              <button
                type="button"
                className="btn btn-subtle"
                style={{ width: '100%', justifyContent: 'flex-start' }}
                onClick={() => onOpenToolModal('crop')}
              >
                <Crop size={14} />
                <span>Recortar Márgenes…</span>
              </button>
              <button
                type="button"
                className="btn btn-subtle"
                style={{ width: '100%', justifyContent: 'flex-start' }}
                onClick={() => onOpenToolModal('optimize')}
              >
                <FileDown size={14} />
                <span>Comprimir PDF…</span>
              </button>
            </>
          )}
        </div>
      </div>

      <div className="inspector-section">
        <div className="inspector-title">Resumen del Documento</div>
        <div className="prop-row">
          <span className="prop-label">Páginas totales</span>
          <strong style={{ fontSize: 12 }}>{tab.pages.length}</strong>
        </div>
        <div className="prop-row">
          <span className="prop-label">Objetos insertados</span>
          <strong style={{ fontSize: 12 }}>{tab.elements.length}</strong>
        </div>
        <div className="prop-row">
          <span className="prop-label">Textos PDF editados</span>
          <strong style={{ fontSize: 12 }}>
            {Object.values(tab.nativeTextEdits).filter((t) => t.modified || t.deleted).length}
          </strong>
        </div>
      </div>

      <div className="inspector-section">
        <div className="inspector-title">Atajos de Precisión</div>
        <div style={{ fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.65 }}>
          <div>
            <Move size={11} style={{ verticalAlign: 'middle', marginRight: 5 }} />
            Arrastra cualquier objeto o texto para moverlo.
          </div>
          <div>• Doble clic en un cuadro de texto para editarlo.</div>
          <div>• Arrastra fotos PNG/JPG directo sobre la hoja.</div>
          <div>
            • <span className="kbd-badge">Supr</span> borra el elemento activo.
          </div>
          <div>
            • <span className="kbd-badge">Ctrl+Z</span> deshace cualquier cambio.
          </div>
        </div>
      </div>
    </aside>
  );
};
