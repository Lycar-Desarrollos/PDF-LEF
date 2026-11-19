import React, { useRef } from 'react';
import { Upload } from 'lucide-react';
import type { CustomFontEntry, FontFamilyChoice } from '../types/pdf';
import { BUILTIN_FONT_CATALOG } from '../utils/fontRegistry';

interface FontPickerControlProps {
  value: FontFamilyChoice;
  customFonts: CustomFontEntry[];
  onChange: (next: FontFamilyChoice) => void;
  onUploadFiles?: (files: FileList) => void;
  selectWidth?: number | string;
  compact?: boolean;
  includeScript?: boolean;
}

export const FontPickerControl: React.FC<FontPickerControlProps> = ({
  value,
  customFonts,
  onChange,
  onUploadFiles,
  selectWidth = 148,
  compact = false,
  includeScript = true,
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const sansFonts = BUILTIN_FONT_CATALOG.filter((f) => f.category === 'sans');
  const serifFonts = BUILTIN_FONT_CATALOG.filter((f) => f.category === 'serif');
  const monoAndScript = BUILTIN_FONT_CATALOG.filter(
    (f) => f.category === 'mono' || (includeScript && f.category === 'script')
  );

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: compact ? 3 : 5 }}>
      <select
        className="prop-select"
        style={{
          width: selectWidth,
          height: compact ? 22 : undefined,
          fontSize: compact ? 10.5 : undefined,
          padding: compact ? '0 4px' : undefined,
        }}
        value={value}
        onChange={(e) => onChange(e.target.value as FontFamilyChoice)}
        title="Seleccionar tipografía"
      >
        {customFonts.length > 0 && (
          <optgroup label="Mis Fuentes (.ttf / .otf)">
            {customFonts.map((cf) => (
              <option key={cf.choice} value={cf.choice}>
                {cf.name}
              </option>
            ))}
          </optgroup>
        )}

        <optgroup label="Oficina y Cotizaciones">
          {sansFonts.map((f) => (
            <option key={f.id} value={f.id}>
              {compact ? f.label.split(' (')[0] : f.label}
            </option>
          ))}
        </optgroup>

        <optgroup label="Editorial y Contratos">
          {serifFonts.map((f) => (
            <option key={f.id} value={f.id}>
              {compact ? f.label.split(' (')[0] : f.label}
            </option>
          ))}
        </optgroup>

        <optgroup label="Folios y Especiales">
          {monoAndScript.map((f) => (
            <option key={f.id} value={f.id}>
              {compact ? f.label.split(' (')[0] : f.label}
            </option>
          ))}
        </optgroup>
      </select>

      {onUploadFiles && (
        <>
          <button
            type="button"
            className="btn"
            style={{
              height: compact ? 22 : 28,
              padding: compact ? '0 5px' : '0 7px',
              fontSize: compact ? 10 : 11,
              gap: 3,
              flexShrink: 0,
            }}
            onClick={() => inputRef.current?.click()}
            title="Subir e instalar tipografía propia (.ttf o .otf)"
          >
            <Upload size={compact ? 11 : 12} />
            <span>{compact ? '+TTF' : '+Fuente'}</span>
          </button>
          <input
            ref={inputRef}
            type="file"
            accept=".ttf,.otf"
            multiple
            style={{ display: 'none' }}
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                onUploadFiles(e.target.files);
                e.target.value = '';
              }
            }}
          />
        </>
      )}
    </div>
  );
};
