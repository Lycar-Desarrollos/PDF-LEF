import React, { useEffect, useRef, useState } from 'react';
import {
  Bookmark,
  Files,
  Layers,
  RotateCcw,
  RotateCw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import type {
  OutlineNode,
  PageDescriptor,
  PdfTabDocument,
} from '../types/pdf';
import {
  extractPdfOutline,
  renderPageToCanvas,
  searchInTabDocument,
  type SearchMatchResult,
} from '../utils/pdfEngine';

type LeftPanelKind = 'thumbnails' | 'outline' | 'search' | 'layers' | 'closed';

interface LeftSidebarProps {
  tab: PdfTabDocument;
  openPanel: LeftPanelKind;
  selectedElementId: string | null;
  selectedNativeTextId: string | null;
  onChangePanel: (panel: LeftPanelKind) => void;
  onSelectPage: (pageIndex: number) => void;
  onReorderPages?: (fromIndex: number, toIndex: number) => void;
  onRotatePage: (pageIndex: number) => void;
  onDeletePage: (pageIndex: number) => void;
  onSelectOverlayElement: (id: string, pageIndex: number) => void;
  onDeleteOverlayElement: (id: string) => void;
  onSelectNativeTextEdit: (id: string, pageIndex: number) => void;
  onResetNativeTextEdit: (id: string) => void;
}

const PageThumbCanvas: React.FC<{
  tab: PdfTabDocument;
  pageDesc: PageDescriptor;
}> = ({ tab, pageDesc }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const bytes = tab.sourceBuffers[pageDesc.sourceId];
    renderPageToCanvas(pageDesc.sourceId, bytes, pageDesc, canvas, 0.24, false).catch(() => {
      if (!cancelled) {
        // Ignore cancelled render
      }
    });
    return () => {
      cancelled = true;
    };
  }, [tab.sourceBuffers, pageDesc]);

  return (
    <div className="thumb-canvas-wrap">
      <canvas ref={canvasRef} style={{ display: 'block', maxWidth: '100%', height: 'auto' }} />
    </div>
  );
};

export const LeftSidebar: React.FC<LeftSidebarProps> = ({
  tab,
  openPanel,
  selectedElementId,
  selectedNativeTextId,
  onChangePanel,
  onSelectPage,
  onReorderPages,
  onRotatePage,
  onDeletePage,
  onSelectOverlayElement,
  onDeleteOverlayElement,
  onSelectNativeTextEdit,
  onResetNativeTextEdit,
}) => {
  const [outline, setOutline] = useState<OutlineNode[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchMatchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [dragThumbFrom, setDragThumbFrom] = useState<number | null>(null);
  const [dragThumbOver, setDragThumbOver] = useState<number | null>(null);

  useEffect(() => {
    if (openPanel === 'outline') {
      extractPdfOutline(tab).then(setOutline);
    }
  }, [openPanel, tab]);

  const handleRunSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const matches = await searchInTabDocument(tab, searchQuery);
      setSearchResults(matches);
      if (matches.length > 0) {
        onSelectPage(matches[0].pageIndex);
      }
    } finally {
      setSearching(false);
    }
  };

  const togglePanel = (target: Exclude<LeftPanelKind, 'closed'>) => {
    onChangePanel(openPanel === target ? 'closed' : target);
  };

  const modifiedNativeTexts = Object.values(tab.nativeTextEdits).filter(
    (nt) => nt.modified || nt.deleted
  );

  return (
    <>
      <aside className="left-rail">
        <button
          type="button"
          className={`rail-btn ${openPanel === 'thumbnails' ? 'active' : ''}`}
          onClick={() => togglePanel('thumbnails')}
          title="Miniaturas de páginas"
        >
          <Files size={17} />
        </button>
        <button
          type="button"
          className={`rail-btn ${openPanel === 'outline' ? 'active' : ''}`}
          onClick={() => togglePanel('outline')}
          title="Índice y marcadores del documento"
        >
          <Bookmark size={17} />
        </button>
        <button
          type="button"
          className={`rail-btn ${openPanel === 'search' ? 'active' : ''}`}
          onClick={() => togglePanel('search')}
          title="Buscar texto en el PDF (Ctrl+F)"
        >
          <Search size={17} />
        </button>
        <button
          type="button"
          className={`rail-btn ${openPanel === 'layers' ? 'active' : ''}`}
          onClick={() => togglePanel('layers')}
          title="Capas: textos editados, imágenes y firmas"
        >
          <Layers size={17} />
        </button>
      </aside>

      {openPanel !== 'closed' && (
        <aside className="left-drawer">
          <div className="drawer-header">
            <span>
              {openPanel === 'thumbnails' && `Páginas (${tab.pages.length})`}
              {openPanel === 'outline' && 'Índice del PDF'}
              {openPanel === 'search' && 'Buscar Texto'}
              {openPanel === 'layers' &&
                `Capas (${tab.elements.length + modifiedNativeTexts.length})`}
            </span>
            <button
              type="button"
              className="btn icon-only"
              style={{ width: 24, height: 24 }}
              onClick={() => onChangePanel('closed')}
              title="Ocultar panel lateral"
            >
              <X size={13.5} />
            </button>
          </div>

          <div className="drawer-scroll">
            {openPanel === 'thumbnails' &&
              tab.pages.map((pd, idx) => (
                <div
                  key={pd.id}
                  draggable={Boolean(onReorderPages && tab.pages.length > 1)}
                  className={`thumb-item ${idx === tab.currentPageIndex ? 'active' : ''}`}
                  style={
                    dragThumbOver === idx
                      ? { borderColor: 'var(--accent)', boxShadow: '0 0 0 2px var(--accent-soft)' }
                      : undefined
                  }
                  onClick={() => onSelectPage(idx)}
                  onDragStart={() => setDragThumbFrom(idx)}
                  onDragOver={(e) => {
                    if (!onReorderPages) return;
                    e.preventDefault();
                    setDragThumbOver(idx);
                  }}
                  onDragLeave={() => setDragThumbOver(null)}
                  onDrop={(e) => {
                    if (!onReorderPages) return;
                    e.preventDefault();
                    setDragThumbOver(null);
                    if (dragThumbFrom !== null && dragThumbFrom !== idx) {
                      onReorderPages(dragThumbFrom, idx);
                    }
                    setDragThumbFrom(null);
                  }}
                  title="Clic para ir a esta página · Arrastra para cambiar el orden"
                >
                  <PageThumbCanvas tab={tab} pageDesc={pd} />
                  <div className="thumb-label">Página {idx + 1}</div>
                  <div
                    className="thumb-quick-actions"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {onReorderPages && tab.pages.length > 1 && idx > 0 && (
                      <button
                        type="button"
                        className="btn icon-only"
                        style={{ width: 20, height: 22, fontSize: 10.5, fontWeight: 700 }}
                        onClick={() => onReorderPages(idx, idx - 1)}
                        title="Subir página"
                      >
                        ↑
                      </button>
                    )}
                    {onReorderPages && tab.pages.length > 1 && idx < tab.pages.length - 1 && (
                      <button
                        type="button"
                        className="btn icon-only"
                        style={{ width: 20, height: 22, fontSize: 10.5, fontWeight: 700 }}
                        onClick={() => onReorderPages(idx, idx + 1)}
                        title="Bajar página"
                      >
                        ↓
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn icon-only"
                      style={{ width: 22, height: 22 }}
                      onClick={() => onRotatePage(idx)}
                      title="Rotar página 90°"
                    >
                      <RotateCw size={12} />
                    </button>
                    {tab.pages.length > 1 && (
                      <button
                        type="button"
                        className="btn icon-only"
                        style={{ width: 22, height: 22, color: 'var(--danger)' }}
                        onClick={() => onDeletePage(idx)}
                        title="Eliminar página"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>
              ))}

            {openPanel === 'outline' && (
              <div>
                {outline.length === 0 ? (
                  <div
                    style={{
                      padding: '24px 8px',
                      textAlign: 'center',
                      fontSize: 12,
                      color: 'var(--text-muted)',
                    }}
                  >
                    Este documento no incluye marcadores de índice integrados.
                  </div>
                ) : (
                  outline.map((node, i) => (
                    <button
                      key={`${node.title}_${i}`}
                      type="button"
                      className="btn"
                      style={{
                        width: '100%',
                        justifyContent: 'space-between',
                        height: 32,
                        marginBottom: 3,
                      }}
                      onClick={() => onSelectPage(node.pageIndex)}
                    >
                      <span
                        style={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {node.title}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        Pág. {node.pageIndex + 1}
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}

            {openPanel === 'search' && (
              <div>
                <form onSubmit={handleRunSearch} style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                  <input
                    type="text"
                    className="prop-input"
                    style={{ flex: 1 }}
                    placeholder="Buscar palabra o frase…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    autoFocus
                  />
                  <button type="submit" className="btn btn-primary" style={{ padding: '0 10px' }}>
                    Ir
                  </button>
                </form>

                {searching && (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: 8 }}>
                    Buscando en {tab.pages.length} páginas…
                  </div>
                )}

                {!searching && searchQuery && searchResults.length === 0 && (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: 8 }}>
                    Sin coincidencias para "{searchQuery}".
                  </div>
                )}

                {searchResults.map((res) => (
                  <div
                    key={res.pageIndex}
                    onClick={() => onSelectPage(res.pageIndex)}
                    style={{
                      padding: '9px 10px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-subtle)',
                      background: 'var(--bg-surface-subtle)',
                      marginBottom: 8,
                      cursor: 'pointer',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: 11,
                        fontWeight: 700,
                        color: 'var(--accent)',
                        marginBottom: 4,
                      }}
                    >
                      <span>Página {res.pageNumber}</span>
                      <span>{res.occurrences} coincidencia(s)</span>
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                      {res.snippet}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {openPanel === 'layers' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {modifiedNativeTexts.length === 0 && tab.elements.length === 0 && (
                  <div
                    style={{
                      padding: '24px 8px',
                      textAlign: 'center',
                      fontSize: 12,
                      color: 'var(--text-muted)',
                    }}
                  >
                    Aún no hay elementos agregados ni textos modificados en este documento.
                  </div>
                )}

                {modifiedNativeTexts.map((nt) => {
                  const pIdx = tab.pages.findIndex((p) => p.id === nt.pageId);
                  return (
                    <div
                      key={nt.id}
                      onClick={() => onSelectNativeTextEdit(nt.id, Math.max(0, pIdx))}
                      style={{
                        padding: '8px 10px',
                        borderRadius: 'var(--radius-sm)',
                        border: `1px solid ${
                          selectedNativeTextId === nt.id
                            ? 'var(--accent)'
                            : 'var(--border-subtle)'
                        }`,
                        background: 'var(--bg-surface-subtle)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 6,
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--accent)' }}>
                          Texto PDF {nt.deleted ? '(Eliminado)' : '(Editado/Movido)'} · Pág.{' '}
                          {pIdx + 1}
                        </div>
                        <div
                          style={{
                            fontSize: 11.5,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {nt.text || nt.originalText}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="btn icon-only"
                        style={{ width: 24, height: 24 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onResetNativeTextEdit(nt.id);
                        }}
                        title="Restaurar texto original del PDF"
                      >
                        <RotateCcw size={12} />
                      </button>
                    </div>
                  );
                })}

                {tab.elements.map((el) => {
                  const pIdx = tab.pages.findIndex((p) => p.id === el.pageId);
                  const kindMap: Record<string, string> = {
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
                  };
                  const kindLabel = kindMap[el.kind] || 'Elemento';
                  const previewLabel =
                    el.kind === 'image'
                      ? 'Imagen en página'
                      : el.kind === 'signature'
                      ? 'Firma sin fondo'
                      : el.text || kindLabel;

                  return (
                    <div
                      key={el.id}
                      onClick={() => onSelectOverlayElement(el.id, Math.max(0, pIdx))}
                      style={{
                        padding: '8px 10px',
                        borderRadius: 'var(--radius-sm)',
                        border: `1px solid ${
                          selectedElementId === el.id
                            ? 'var(--accent)'
                            : 'var(--border-subtle)'
                        }`,
                        background: 'var(--bg-surface-subtle)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 6,
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-muted)' }}>
                          {kindLabel} · Pág. {pIdx + 1}
                        </div>
                        <div
                          style={{
                            fontSize: 11.5,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {previewLabel}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="btn icon-only"
                        style={{ width: 24, height: 24, color: 'var(--danger)' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteOverlayElement(el.id);
                        }}
                        title="Eliminar elemento"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </aside>
      )}
    </>
  );
};
