import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';

export interface CommandActionItem {
  id: string;
  label: string;
  category: string;
  shortcut?: string;
  run: () => void;
}

interface CommandPaletteProps {
  actions: CommandActionItem[];
  onClose: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ actions, onClose }) => {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return actions;
    return actions.filter(
      (a) =>
        a.label.toLowerCase().includes(q) || a.category.toLowerCase().includes(q)
    );
  }, [actions, query]);

  return (
    <div className="modal-backdrop" style={{ alignItems: 'flex-start', paddingTop: '11vh' }} onClick={onClose}>
      <div
        className="modal-window"
        style={{ maxWidth: 560 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: '12px 16px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <Search size={16} style={{ color: 'var(--accent)' }} />
          <input
            type="text"
            autoFocus
            placeholder="Escribe cualquier acción (ej. editar texto, agregar imagen, firmar, unir, modo oscuro)…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose();
              if (e.key === 'Enter' && filtered[0]) {
                filtered[0].run();
                onClose();
              }
            }}
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontSize: 13.5,
            }}
          />
          <span className="kbd-badge">ESC</span>
        </div>

        <div style={{ maxHeight: 360, overflowY: 'auto', padding: 8 }}>
          {filtered.map((item) => (
            <button
              key={item.id}
              type="button"
              className="btn"
              style={{
                width: '100%',
                justifyContent: 'space-between',
                height: 36,
                padding: '0 12px',
              }}
              onClick={() => {
                item.run();
                onClose();
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  style={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    color: 'var(--accent)',
                    minWidth: 74,
                    textAlign: 'left',
                  }}
                >
                  {item.category}
                </span>
                <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                  {item.label}
                </span>
              </div>
              {item.shortcut && <span className="kbd-badge">{item.shortcut}</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
