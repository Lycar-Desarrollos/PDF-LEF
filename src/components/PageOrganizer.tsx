import React, { useEffect, useRef, useState } from 'react';
import {
  Copy,
  FileOutput,
  FilePlus,
  FolderPlus,
  RotateCcw,
  RotateCw,
  Trash2,
} from 'lucide-react';
import type { PageDescriptor, PdfTabDocument } from '../types/pdf';
import { renderPageToCanvas } from '../utils/pdfEngine';

interface PageOrganizerProps {
  tab: PdfTabDocument;
  onReorderPages: (fromIdx: number, toIdx: number) => void;
  onRotatePages: (indices: number[], deltaDeg: number) => void;
  onDuplicatePages: (indices: number[]) => void;
  onDeletePages: (indices: number[]) => void;
  onInsertBlankPage: (afterIndex: number) => void;
  onAppendExternalPdf: () => void;
  onExtractPagesToNewTab: (indices: number[]) => void;
  onOpenPageInEditor: (pageIndex: number) => void;
}

const OrganizerThumb: React.FC<{ tab: PdfTabDocument; pageDesc: PageDescriptor }> = ({
  tab,
  pageDesc,
}) => {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const bytes = tab.sourceBuffers[pageDesc.sourceId];
    renderPageToCanvas(pageDesc.sourceId, bytes, pageDesc, c, 0.28, false).catch(() => {});
  }, [tab.sourceBuffers, pageDesc]);

  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 6,
        boxShadow: 'var(--shadow-sm)',
        overflow: 'hidden',
        height: 190,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 4,
      }}
    >
      <canvas ref={ref} style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} />
    </div>
  );
};

export const PageOrganizer: React.FC<PageOrganizerProps> = ({
  tab,
  onReorderPages,
  onRotatePages,
  onDuplicatePages,
  onDeletePages,
  onInsertBlankPage,
  onAppendExternalPdf,
  onExtractPagesToNewTab,
  onOpenPageInEditor,
}) => {
  const [selectedIndices, setSelectedIndices] = useState<number[]>([0]);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  const toggleIndex = (idx: number, multi: boolean) => {
    if (!multi) {
      setSelectedIndices([idx]);
      return;
    }
    setSelectedIndices((prev) =>
      prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx].sort((a, b) => a - b)
    );
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {/* Organizer Action Bar */}
      <div
        style={{
          padding: '8px 18px',
          background: 'var(--bg-surface-subtle)',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          flexWrap: 'wrap',
        }}
      >
        <div className="toolbar-group">
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
            {selectedIndices.length} seleccionada(s) · Arrastra para reordenar
          </span>
          <button
            type="button"
            className="btn"
            style={{ height: 28, fontSize: 11.5 }}
            onClick={() => setSelectedIndices(tab.pages.map((_, i) => i))}
          >
            Seleccionar todas
          </button>
        </div>

        <div className="toolbar-group">
          <button
            type="button"
            className="btn btn-subtle"
            disabled={selectedIndices.length === 0}
            onClick={() => onRotatePages(selectedIndices, -90)}
          >
            <RotateCcw size={14} />
            <span>Girar Izq.</span>
          </button>
          <button
            type="button"
            className="btn btn-subtle"
            disabled={selectedIndices.length === 0}
            onClick={() => onRotatePages(selectedIndices, 90)}
          >
            <RotateCw size={14} />
            <span>Girar Der.</span>
          </button>
          <button
            type="button"
            className="btn btn-subtle"
            disabled={selectedIndices.length === 0}
            onClick={() => onDuplicatePages(selectedIndices)}
          >
            <Copy size={14} />
            <span>Duplicar</span>
          </button>
          <button
            type="button"
            className="btn btn-subtle"
            onClick={() =>
              onInsertBlankPage(
                selectedIndices.length > 0
                  ? selectedIndices[selectedIndices.length - 1]
                  : tab.pages.length - 1
              )
            }
          >
            <FilePlus size={14} />
            <span>Página en blanco</span>
          </button>
          <button
            type="button"
            className="btn btn-subtle"
            onClick={onAppendExternalPdf}
          >
            <FolderPlus size={14} />
            <span>Anexar otro PDF…</span>
          </button>
          <button
            type="button"
            className="btn btn-subtle"
            disabled={selectedIndices.length === 0}
            onClick={() => onExtractPagesToNewTab(selectedIndices)}
          >
            <FileOutput size={14} />
            <span>Extraer en pestaña</span>
          </button>
          <button
            type="button"
            className="btn btn-subtle"
            style={{ color: 'var(--danger)' }}
            disabled={
              selectedIndices.length === 0 || selectedIndices.length >= tab.pages.length
            }
            onClick={() => {
              onDeletePages(selectedIndices);
              setSelectedIndices([0]);
            }}
          >
            <Trash2 size={14} />
            <span>Eliminar</span>
          </button>
        </div>
      </div>

      {/* Lightbox Grid */}
      <div className="organizer-stage">
        <div className="organizer-grid">
          {tab.pages.map((pd, idx) => {
            const isSel = selectedIndices.includes(idx);
            return (
              <div
                key={pd.id}
                draggable
                className={`org-card ${isSel ? 'selected' : ''} ${
                  dragOver === idx ? 'drag-over' : ''
                }`}
                onClick={(e) => toggleIndex(idx, e.ctrlKey || e.metaKey || e.shiftKey)}
                onDoubleClick={() => onOpenPageInEditor(idx)}
                onDragStart={() => setDragFrom(idx)}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(idx);
                }}
                onDragLeave={() => setDragOver(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(null);
                  if (dragFrom !== null && dragFrom !== idx) {
                    onReorderPages(dragFrom, idx);
                    setSelectedIndices([idx]);
                  }
                  setDragFrom(null);
                }}
              >
                <OrganizerThumb tab={tab} pageDesc={pd} />
                <div
                  style={{
                    marginTop: 10,
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  <span>Página {idx + 1}</span>
                  <div style={{ display: 'flex', gap: 2 }} onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      className="btn icon-only"
                      style={{ width: 24, height: 24 }}
                      onClick={() => onRotatePages([idx], 90)}
                      title="Rotar 90°"
                    >
                      <RotateCw size={12} />
                    </button>
                    {tab.pages.length > 1 && (
                      <button
                        type="button"
                        className="btn icon-only"
                        style={{ width: 24, height: 24, color: 'var(--danger)' }}
                        onClick={() => onDeletePages([idx])}
                        title="Eliminar página"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
