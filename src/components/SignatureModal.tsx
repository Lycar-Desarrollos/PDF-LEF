import React, { useEffect, useRef, useState } from 'react';
import {
  Check,
  Eraser,
  ImagePlus,
  PenTool,
  Signature,
  Trash2,
  Type,
  X,
} from 'lucide-react';
import type { SavedSignature } from '../types/pdf';
import { fileToDataUrl, removeSignatureBackground } from '../utils/imageUtils';

interface SignatureModalProps {
  savedSignatures: SavedSignature[];
  hasActivePage?: boolean;
  onSaveNewSignature: (sig: SavedSignature) => void;
  onDeleteSavedSignature: (id: string) => void;
  onPlaceSignatureOnPage: (dataUrl: string, signerLabel: string) => void;
  onClose: () => void;
}

const INK_COLORS = [
  { label: 'Negro Tinta', hex: '#111318' },
  { label: 'Azul Firma Clásico', hex: '#143B8C' },
  { label: 'Rubí Ejecutivo', hex: '#C81E32' },
];

export const SignatureModal: React.FC<SignatureModalProps> = ({
  savedSignatures,
  hasActivePage = true,
  onSaveNewSignature,
  onDeleteSavedSignature,
  onPlaceSignatureOnPage,
  onClose,
}) => {
  const [tabMode, setTabMode] = useState<'draw' | 'type' | 'upload'>('draw');
  const [inkColor, setInkColor] = useState('#143B8C');
  const [signerName, setSignerName] = useState('Firma Autorizada');
  const [typedText, setTypedText] = useState('Carlos Méndez');
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [rawUploadUrl, setRawUploadUrl] = useState<string | null>(null);
  const [threshold, setThreshold] = useState(212);

  const padRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);
  const hasStrokeRef = useRef(false);

  const clearPad = () => {
    const c = padRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, c.width, c.height);
    hasStrokeRef.current = false;
  };

  useEffect(() => {
    if (tabMode === 'draw') clearPad();
  }, [tabMode]);

  useEffect(() => {
    if (rawUploadUrl) {
      removeSignatureBackground(rawUploadUrl, inkColor, threshold)
        .then(setUploadPreview)
        .catch(() => {});
    }
  }, [rawUploadUrl, inkColor, threshold]);

  const handlePadDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const c = padRef.current;
    if (!c) return;
    const rect = c.getBoundingClientRect();
    const ctx = c.getContext('2d');
    if (!ctx) return;
    isDrawingRef.current = true;
    hasStrokeRef.current = true;
    ctx.strokeStyle = inkColor;
    ctx.lineWidth = 3.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(
      ((e.clientX - rect.left) / rect.width) * c.width,
      ((e.clientY - rect.top) / rect.height) * c.height
    );
  };

  const handlePadMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    const c = padRef.current;
    if (!c) return;
    const rect = c.getBoundingClientRect();
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.lineTo(
      ((e.clientX - rect.left) / rect.width) * c.width,
      ((e.clientY - rect.top) / rect.height) * c.height
    );
    ctx.stroke();
  };

  const handlePadUp = () => {
    isDrawingRef.current = false;
  };

  const buildCurrentSignatureDataUrl = (): string | null => {
    if (tabMode === 'draw') {
      if (!padRef.current || !hasStrokeRef.current) return null;
      return padRef.current.toDataURL('image/png');
    }
    if (tabMode === 'type') {
      if (!typedText.trim()) return null;
      const c = document.createElement('canvas');
      c.width = 620;
      c.height = 190;
      const ctx = c.getContext('2d');
      if (!ctx) return null;
      ctx.fillStyle = inkColor;
      ctx.font = "700 68px 'Dancing Script', 'Caveat', Georgia, serif";
      ctx.textBaseline = 'middle';
      ctx.fillText(typedText.trim(), 28, 98);
      return c.toDataURL('image/png');
    }
    return uploadPreview;
  };

  const handleCreateAndPlace = () => {
    const dataUrl = buildCurrentSignatureDataUrl();
    if (!dataUrl) return;
    const saved: SavedSignature = {
      id: `sig_${Date.now()}`,
      name: signerName.trim() || 'Firma',
      dataUrl,
      inkColor,
      createdAt: new Date().toLocaleDateString('es-ES'),
    };
    onSaveNewSignature(saved);
    if (hasActivePage) {
      onPlaceSignatureOnPage(dataUrl, saved.name);
    }
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-window" style={{ maxWidth: 680 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <Signature size={18} style={{ color: 'var(--accent)' }} />
            <span>Bóveda Local de Firmas Transparentes</span>
          </div>
          <button type="button" className="btn icon-only" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="modal-body">
          {/* Existing Saved Signatures */}
          {savedSignatures.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div
                style={{
                  fontSize: 11.5,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  color: 'var(--text-muted)',
                  marginBottom: 8,
                }}
              >
                {hasActivePage
                  ? 'Mis Firmas Guardadas (Clic para estampar en la página actual)'
                  : 'Mis Firmas Guardadas (Clic para abrir un PDF y estampar)'}
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(175px, 1fr))',
                  gap: 10,
                }}
              >
                {savedSignatures.map((sig) => (
                  <div
                    key={sig.id}
                    style={{
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-md)',
                      padding: 10,
                      background: '#ffffff',
                      position: 'relative',
                      cursor: 'pointer',
                    }}
                    onClick={() => {
                      onPlaceSignatureOnPage(sig.dataUrl, sig.name);
                      onClose();
                    }}
                  >
                    <img
                      src={sig.dataUrl}
                      alt={sig.name}
                      style={{ width: '100%', height: 56, objectFit: 'contain' }}
                    />
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: '#111318',
                        marginTop: 6,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <span>{sig.name}</span>
                      <button
                        type="button"
                        className="btn icon-only"
                        style={{ width: 22, height: 22, color: '#c42b1c' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteSavedSignature(sig.id);
                        }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Create New Signature Tabs */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div className="mode-pills">
              <button
                type="button"
                className={`mode-pill ${tabMode === 'draw' ? 'active' : ''}`}
                onClick={() => setTabMode('draw')}
              >
                <PenTool size={13.5} />
                <span>Dibujar</span>
              </button>
              <button
                type="button"
                className={`mode-pill ${tabMode === 'type' ? 'active' : ''}`}
                onClick={() => setTabMode('type')}
              >
                <Type size={13.5} />
                <span>Caligrafía</span>
              </button>
              <button
                type="button"
                className={`mode-pill ${tabMode === 'upload' ? 'active' : ''}`}
                onClick={() => setTabMode('upload')}
              >
                <ImagePlus size={13.5} />
                <span>Foto en Papel (Quitar Fondo)</span>
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {INK_COLORS.map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  title={c.label}
                  className={`swatch-btn ${inkColor === c.hex ? 'active' : ''}`}
                  style={{ backgroundColor: c.hex }}
                  onClick={() => setInkColor(c.hex)}
                />
              ))}
            </div>
          </div>

          {tabMode === 'draw' && (
            <div>
              <div
                style={{
                  background: '#ffffff',
                  border: '1.5px dashed var(--border-strong)',
                  borderRadius: 'var(--radius-md)',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <canvas
                  ref={padRef}
                  width={620}
                  height={180}
                  style={{ width: '100%', height: 170, cursor: 'crosshair', display: 'block' }}
                  onMouseDown={handlePadDown}
                  onMouseMove={handlePadMove}
                  onMouseUp={handlePadUp}
                  onMouseLeave={handlePadUp}
                />
                <button
                  type="button"
                  className="btn btn-subtle"
                  style={{ position: 'absolute', top: 8, right: 8, height: 26, fontSize: 11 }}
                  onClick={clearPad}
                >
                  <Eraser size={12} />
                  <span>Limpiar trazo</span>
                </button>
              </div>
            </div>
          )}

          {tabMode === 'type' && (
            <div>
              <input
                type="text"
                className="prop-input"
                style={{ width: '100%', height: 38, fontSize: 14, marginBottom: 12 }}
                placeholder="Escribe tu nombre y apellido…"
                value={typedText}
                onChange={(e) => setTypedText(e.target.value)}
              />
              <div
                style={{
                  height: 125,
                  background: '#ffffff',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: 'var(--font-script)',
                  fontSize: 52,
                  fontWeight: 700,
                  color: inkColor,
                }}
              >
                {typedText || 'Vista previa'}
              </div>
            </div>
          )}

          {tabMode === 'upload' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <label className="btn btn-subtle" style={{ cursor: 'pointer' }}>
                  <ImagePlus size={14} />
                  <span>Seleccionar foto de firma…</span>
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      const url = await fileToDataUrl(f);
                      setRawUploadUrl(url);
                    }}
                  />
                </label>

                {rawUploadUrl && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                    <span>Limpieza de fondo blanco:</span>
                    <input
                      type="range"
                      min={140}
                      max={245}
                      value={threshold}
                      onChange={(e) => setThreshold(Number(e.target.value))}
                    />
                  </div>
                )}
              </div>

              <div
                style={{
                  height: 140,
                  background:
                    'repeating-conic-gradient(#eef0f4 0% 25%, #ffffff 0% 50%) 50% / 16px 16px',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 12,
                }}
              >
                {uploadPreview ? (
                  <img
                    src={uploadPreview}
                    alt="Firma sin fondo"
                    style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }}
                  />
                ) : (
                  <span style={{ fontSize: 12, color: '#686d76' }}>
                    Sube una foto de tu firma sobre hoja blanca y eliminaremos el papel automáticamente.
                  </span>
                )}
              </div>
            </div>
          )}

          <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="prop-label">Etiqueta / Firmante:</span>
            <input
              type="text"
              className="prop-input"
              style={{ flex: 1 }}
              value={signerName}
              onChange={(e) => setSignerName(e.target.value)}
            />
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-subtle" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="btn btn-primary" onClick={handleCreateAndPlace}>
            <Check size={14} />
            <span>{hasActivePage ? 'Guardar y Estampar en Página' : 'Guardar en Bóveda Local'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
