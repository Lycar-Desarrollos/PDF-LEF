import React from 'react';
import {
  Command,
  FileText,
  Home,
  Minus,
  Moon,
  Plus,
  Settings,
  Square,
  Sun,
  X,
} from 'lucide-react';
import type { AppSettings, PdfTabDocument, WorkspaceMode } from '../types/pdf';
import {
  closeNativeWindow,
  minimizeNativeWindow,
  toggleMaximizeNativeWindow,
} from '../utils/tauriBridge';

interface TitleBarProps {
  tabs: PdfTabDocument[];
  activeTabId: string | null;
  workspaceMode: WorkspaceMode;
  settings: AppSettings;
  onSelectHome: () => void;
  onSelectTab: (tabId: string) => void;
  onCloseTab: (tabId: string, e: React.MouseEvent) => void;
  onOpenNewPdf: () => void;
  onOpenCommandPalette: () => void;
  onToggleThemeQuick: () => void;
  onOpenSettings: () => void;
}

export const TitleBar: React.FC<TitleBarProps> = ({
  tabs,
  activeTabId,
  workspaceMode,
  settings,
  onSelectHome,
  onSelectTab,
  onCloseTab,
  onOpenNewPdf,
  onOpenCommandPalette,
  onToggleThemeQuick,
  onOpenSettings,
}) => {
  const isDark =
    settings.theme === 'dark' ||
    (settings.theme === 'system' &&
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);

  return (
    <header className="win-titlebar" data-tauri-drag-region>
      <div
        className="win-brand"
        onClick={onSelectHome}
        title="Inicio de Kova PDF"
        id="titlebar-brand-home"
      >
        <img src="/brand/logo-mark.svg" alt="Kova PDF" className="win-brand-icon" />
        <div className="win-brand-title">
          Kova<span>PDF</span>
        </div>
      </div>

      <div className="tab-strip" data-tauri-drag-region>
        <button
          type="button"
          id="tab-home-btn"
          className={`doc-tab ${workspaceMode === 'home' ? 'active' : ''}`}
          style={{ minWidth: 84, maxWidth: 102 }}
          onClick={onSelectHome}
        >
          <Home size={13.5} />
          <span className="doc-tab-name">Inicio</span>
        </button>

        {tabs.map((tab) => {
          const isActive = workspaceMode !== 'home' && tab.id === activeTabId;
          return (
            <div
              key={tab.id}
              className={`doc-tab ${isActive ? 'active' : ''}`}
              onClick={() => onSelectTab(tab.id)}
              title={tab.filePath || tab.fileName}
            >
              <FileText size={13} style={{ flexShrink: 0, opacity: 0.78 }} />
              <span className="doc-tab-name">{tab.fileName}</span>
              {tab.isModified && <span className="doc-tab-dirty" title="Cambios sin guardar" />}
              <button
                type="button"
                className="doc-tab-close"
                title="Cerrar pestaña"
                onClick={(e) => onCloseTab(tab.id, e)}
              >
                <X size={12} />
              </button>
            </div>
          );
        })}

        <button
          type="button"
          id="titlebar-open-pdf-btn"
          className="tab-add-btn"
          onClick={onOpenNewPdf}
          title="Abrir archivo PDF (Ctrl+O)"
        >
          <Plus size={15} />
        </button>
      </div>

      <div className="titlebar-right">
        <button
          type="button"
          id="titlebar-cmd-palette-btn"
          className="cmd-trigger"
          onClick={onOpenCommandPalette}
          title="Paleta de comandos rápida (Ctrl+K)"
        >
          <Command size={12.5} />
          <span className="cmd-trigger-label">Comandos…</span>
          <span className="kbd-badge">Ctrl K</span>
        </button>

        <button
          type="button"
          id="titlebar-theme-btn"
          className="btn icon-only"
          style={{ height: 28, width: 28 }}
          onClick={onToggleThemeQuick}
          title={isDark ? 'Cambiar a Modo Claro Editorial' : 'Cambiar a Modo Oscuro Obsidiana'}
        >
          {isDark ? <Sun size={14.5} /> : <Moon size={14.5} />}
        </button>

        <button
          type="button"
          id="titlebar-settings-btn"
          className="btn icon-only"
          style={{ height: 28, width: 28 }}
          onClick={onOpenSettings}
          title="Configuración y Preferencias (Ctrl+,)"
        >
          <Settings size={14.5} />
        </button>

        <div className="win-caption-btns">
          <button
            type="button"
            className="win-cap-btn"
            onClick={minimizeNativeWindow}
            title="Minimizar"
          >
            <Minus size={14} />
          </button>
          <button
            type="button"
            className="win-cap-btn"
            onClick={toggleMaximizeNativeWindow}
            title="Maximizar / Restaurar ventana"
          >
            <Square size={12} />
          </button>
          <button
            type="button"
            className="win-cap-btn close"
            onClick={closeNativeWindow}
            title="Cerrar aplicación"
          >
            <X size={15} />
          </button>
        </div>
      </div>
    </header>
  );
};
