import React, { useState } from 'react';
import {
  Download,
  Eye,
  Keyboard,
  Palette,
  PenTool,
  RotateCcw,
  ShieldCheck,
  Upload,
  X,
} from 'lucide-react';
import type {
  AccentTheme,
  AppSettings,
  FontFamilyChoice,
  PaperFilter,
  ThemePreference,
  UiDensity,
  ViewLayout,
} from '../types/pdf';
import { DEFAULT_SETTINGS } from '../utils/storage';
import { downloadBlobInBrowser } from '../utils/tauriBridge';

interface SettingsModalProps {
  settings: AppSettings;
  onChangeSettings: (next: AppSettings) => void;
  onNotify: (msg: string) => void;
  onClose: () => void;
}

type SettingsSection = 'appearance' | 'viewer' | 'editor' | 'privacy' | 'shortcuts';

export const SettingsModal: React.FC<SettingsModalProps> = ({
  settings,
  onChangeSettings,
  onNotify,
  onClose,
}) => {
  const [section, setSection] = useState<SettingsSection>('appearance');

  const update = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    onChangeSettings({ ...settings, [key]: value });
  };

  const handleExportProfile = () => {
    const blob = new Blob([JSON.stringify(settings, null, 2)], {
      type: 'application/json',
    });
    downloadBlobInBrowser(blob, 'PDF-LEF-Configuracion.json');
    onNotify('Perfil de configuración exportado.');
  };

  const handleImportProfile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        onChangeSettings({ ...DEFAULT_SETTINGS, ...parsed });
        onNotify('Configuración importada y aplicada.');
      } catch {
        onNotify('Archivo de configuración no válido.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-window"
        style={{ maxWidth: 820 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-title">
            <span>Configuración y Preferencias — PDF-LEF Studio Pro</span>
          </div>
          <button type="button" className="btn icon-only" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="settings-layout">
          <nav className="settings-nav">
            <button
              type="button"
              className={`settings-nav-btn ${section === 'appearance' ? 'active' : ''}`}
              onClick={() => setSection('appearance')}
            >
              <Palette size={15} />
              <span>Apariencia y Estilo</span>
            </button>
            <button
              type="button"
              className={`settings-nav-btn ${section === 'viewer' ? 'active' : ''}`}
              onClick={() => setSection('viewer')}
            >
              <Eye size={15} />
              <span>Visor y Lectura</span>
            </button>
            <button
              type="button"
              className={`settings-nav-btn ${section === 'editor' ? 'active' : ''}`}
              onClick={() => setSection('editor')}
            >
              <PenTool size={15} />
              <span>Edición y Firmas</span>
            </button>
            <button
              type="button"
              className={`settings-nav-btn ${section === 'privacy' ? 'active' : ''}`}
              onClick={() => setSection('privacy')}
            >
              <ShieldCheck size={15} />
              <span>Windows y Privacidad</span>
            </button>
            <button
              type="button"
              className={`settings-nav-btn ${section === 'shortcuts' ? 'active' : ''}`}
              onClick={() => setSection('shortcuts')}
            >
              <Keyboard size={15} />
              <span>Atajos y Respaldo</span>
            </button>
          </nav>

          <div className="settings-content">
            {section === 'appearance' && (
              <div>
                <div className="setting-card">
                  <div>
                    <div className="setting-card-title">Tema Visual de la Aplicación</div>
                    <div className="setting-card-desc">
                      Elige Blanco Puro Editorial, Oscuro Grafito o sincronizar con Windows 11.
                    </div>
                  </div>
                  <select
                    className="prop-select"
                    value={settings.theme}
                    onChange={(e) => update('theme', e.target.value as ThemePreference)}
                  >
                    <option value="light">Claro Editorial (Blanco Puro)</option>
                    <option value="dark">Oscuro Grafito Pro</option>
                    <option value="system">Automático según Windows</option>
                  </select>
                </div>

                <div className="setting-card">
                  <div>
                    <div className="setting-card-title">Color de Acento de Marca</div>
                    <div className="setting-card-desc">
                      Personaliza el color de controles activos, guías de alineación y pestañas.
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {(
                      [
                        { id: 'ruby', hex: '#C81E32', label: 'Rubí LEF' },
                        { id: 'cobalt', hex: '#1D4ED8', label: 'Cobalto' },
                        { id: 'emerald', hex: '#0F766E', label: 'Esmeralda' },
                        { id: 'graphite', hex: '#1F232B', label: 'Monocromo' },
                      ] as Array<{ id: AccentTheme; hex: string; label: string }>
                    ).map((ac) => (
                      <button
                        key={ac.id}
                        type="button"
                        title={ac.label}
                        className={`swatch-btn ${settings.accent === ac.id ? 'active' : ''}`}
                        style={{ backgroundColor: ac.hex, width: 24, height: 24 }}
                        onClick={() => update('accent', ac.id)}
                      />
                    ))}
                  </div>
                </div>

                <div className="setting-card">
                  <div>
                    <div className="setting-card-title">Densidad de Barras y Controles</div>
                    <div className="setting-card-desc">
                      Compacta maximiza el espacio del PDF; Amplia facilita pantallas táctiles.
                    </div>
                  </div>
                  <select
                    className="prop-select"
                    value={settings.density}
                    onChange={(e) => update('density', e.target.value as UiDensity)}
                  >
                    <option value="compact">Compacta (Máximo espacio)</option>
                    <option value="standard">Estándar Windows 11</option>
                    <option value="comfortable">Amplia / Táctil</option>
                  </select>
                </div>

                <div className="setting-card">
                  <div>
                    <div className="setting-card-title">Escala Tipográfica de la Interfaz</div>
                    <div className="setting-card-desc">
                      Ajusta el tamaño general de menús y textos de la aplicación.
                    </div>
                  </div>
                  <select
                    className="prop-select"
                    value={settings.uiScale}
                    onChange={(e) =>
                      update('uiScale', Number(e.target.value) as 95 | 100 | 108)
                    }
                  >
                    <option value={95}>95% (Fino)</option>
                    <option value={100}>100% (Nativo)</option>
                    <option value={108}>108% (Grande)</option>
                  </select>
                </div>

                <div className="setting-card">
                  <div>
                    <div className="setting-card-title">Mostrar Barra de Estado Inferior</div>
                    <div className="setting-card-desc">
                      Muestra dimensiones de página, estado offline y conteo de cambios.
                    </div>
                  </div>
                  <button
                    type="button"
                    className={`switch ${settings.showStatusBar ? 'on' : ''}`}
                    onClick={() => update('showStatusBar', !settings.showStatusBar)}
                  />
                </div>

                <div className="setting-card">
                  <div>
                    <div className="setting-card-title">Micro-animaciones fluidas</div>
                    <div className="setting-card-desc">
                      Transiciones suaves al cambiar paneles, herramientas y pestañas.
                    </div>
                  </div>
                  <button
                    type="button"
                    className={`switch ${settings.smoothAnimations ? 'on' : ''}`}
                    onClick={() => update('smoothAnimations', !settings.smoothAnimations)}
                  />
                </div>
              </div>
            )}

            {section === 'viewer' && (
              <div>
                <div className="setting-card">
                  <div>
                    <div className="setting-card-title">Zoom Inicial Predeterminado</div>
                    <div className="setting-card-desc">
                      Escala inicial al abrir cualquier documento PDF nuevo.
                    </div>
                  </div>
                  <select
                    className="prop-select"
                    value={String(settings.defaultZoom)}
                    onChange={(e) => update('defaultZoom', Number(e.target.value))}
                  >
                    <option value="0.9">90%</option>
                    <option value="1">100%</option>
                    <option value="1.15">115% (Recomendado)</option>
                    <option value="1.25">125%</option>
                    <option value="1.5">150%</option>
                  </select>
                </div>

                <div className="setting-card">
                  <div>
                    <div className="setting-card-title">Disposición de Páginas por Defecto</div>
                    <div className="setting-card-desc">
                      Modo continuo vertical, página individual o doble página tipo libro.
                    </div>
                  </div>
                  <select
                    className="prop-select"
                    value={settings.defaultViewLayout}
                    onChange={(e) =>
                      update('defaultViewLayout', e.target.value as ViewLayout)
                    }
                  >
                    <option value="continuous">Continuo Vertical</option>
                    <option value="single">Página Única</option>
                    <option value="dual">Doble Página (Libro)</option>
                  </select>
                </div>

                <div className="setting-card">
                  <div>
                    <div className="setting-card-title">Filtro de Papel Predeterminado</div>
                    <div className="setting-card-desc">
                      Descansa la vista al leer documentos extensos por la noche.
                    </div>
                  </div>
                  <select
                    className="prop-select"
                    value={settings.defaultPaperFilter}
                    onChange={(e) =>
                      update('defaultPaperFilter', e.target.value as PaperFilter)
                    }
                  >
                    <option value="original">Original del PDF</option>
                    <option value="night">Lectura Nocturna</option>
                    <option value="sepia">Sepia Editorial</option>
                    <option value="contrast">Alto Contraste</option>
                  </select>
                </div>

                <div className="setting-card">
                  <div>
                    <div className="setting-card-title">Renderizado Vectorial HiDPI (Retina / 4K)</div>
                    <div className="setting-card-desc">
                      Multiplica la densidad de píxeles del lienzo para textos ultra nítidos en monitores Windows modernos.
                    </div>
                  </div>
                  <button
                    type="button"
                    className={`switch ${settings.hiDpiRendering ? 'on' : ''}`}
                    onClick={() => update('hiDpiRendering', !settings.hiDpiRendering)}
                  />
                </div>
              </div>
            )}

            {section === 'editor' && (
              <div>
                <div className="setting-card">
                  <div>
                    <div className="setting-card-title">Nombre de Autor en Notas y Firmas</div>
                    <div className="setting-card-desc">
                      Se incluye en comentarios de revisión y sellos firmados.
                    </div>
                  </div>
                  <input
                    type="text"
                    className="prop-input"
                    style={{ width: 200 }}
                    value={settings.authorName}
                    onChange={(e) => update('authorName', e.target.value)}
                  />
                </div>

                <div className="setting-card">
                  <div>
                    <div className="setting-card-title">Fuente y Tamaño para Nuevos Textos</div>
                    <div className="setting-card-desc">
                      Formato aplicado al agregar cuadros de texto libres sobre la hoja.
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <select
                      className="prop-select"
                      value={settings.defaultFontFamily}
                      onChange={(e) =>
                        update('defaultFontFamily', e.target.value as FontFamilyChoice)
                      }
                    >
                      <option value="sans">Sans Moderna</option>
                      <option value="serif">Serif Clásica</option>
                      <option value="mono">Monoespaciada</option>
                    </select>
                    <input
                      type="number"
                      min={8}
                      max={48}
                      className="prop-input"
                      style={{ width: 68 }}
                      value={settings.defaultFontSizePt}
                      onChange={(e) =>
                        update('defaultFontSizePt', Number(e.target.value) || 12)
                      }
                    />
                  </div>
                </div>

                <div className="setting-card">
                  <div>
                    <div className="setting-card-title">Guías Magnéticas de Alineación</div>
                    <div className="setting-card-desc">
                      Ajusta automáticamente imágenes y textos al centro exacto de la página al arrastrarlos.
                    </div>
                  </div>
                  <button
                    type="button"
                    className={`switch ${settings.snapGuides ? 'on' : ''}`}
                    onClick={() => update('snapGuides', !settings.snapGuides)}
                  />
                </div>

                <div className="setting-card">
                  <div>
                    <div className="setting-card-title">Incluir Fecha Automática al Firmar y Sellar</div>
                    <div className="setting-card-desc">
                      Agrega fecha verificable debajo de cada firma o sello comercial estampado.
                    </div>
                  </div>
                  <button
                    type="button"
                    className={`switch ${settings.includeDateOnSignature ? 'on' : ''}`}
                    onClick={() => {
                      const nextVal = !settings.includeDateOnSignature;
                      onChangeSettings({
                        ...settings,
                        includeDateOnSignature: nextVal,
                        includeDateOnStamps: nextVal,
                      });
                    }}
                  />
                </div>
              </div>
            )}

            {section === 'privacy' && (
              <div>
                <div className="setting-card">
                  <div>
                    <div className="setting-card-title">Calidad Predeterminada de Exportación de Imágenes</div>
                    <div className="setting-card-desc">
                      Resolución por defecto al convertir páginas PDF a PNG o JPG.
                    </div>
                  </div>
                  <select
                    className="prop-select"
                    value={settings.exportImageDpi}
                    onChange={(e) =>
                      update('exportImageDpi', Number(e.target.value) as 150 | 300 | 600)
                    }
                  >
                    <option value={150}>150 DPI</option>
                    <option value={300}>300 DPI (Impresión)</option>
                    <option value={600}>600 DPI (Archivo Maestro)</option>
                  </select>
                </div>

                <div className="setting-card">
                  <div>
                    <div className="setting-card-title">Limpiar Metadatos Ocultos Automáticamente al Guardar</div>
                    <div className="setting-card-desc">
                      Elimina rastros de autor anterior al exportar documentos para clientes.
                    </div>
                  </div>
                  <button
                    type="button"
                    className={`switch ${settings.autoCleanMetadataOnExport ? 'on' : ''}`}
                    onClick={() =>
                      update('autoCleanMetadataOnExport', !settings.autoCleanMetadataOnExport)
                    }
                  />
                </div>

                <div className="setting-card">
                  <div>
                    <div className="setting-card-title">Confirmar antes de cerrar pestañas con cambios</div>
                    <div className="setting-card-desc">
                      Evita perder textos editados o firmas colocadas por accidente.
                    </div>
                  </div>
                  <button
                    type="button"
                    className={`switch ${settings.confirmCloseUnsaved ? 'on' : ''}`}
                    onClick={() => update('confirmCloseUnsaved', !settings.confirmCloseUnsaved)}
                  />
                </div>

                <div
                  style={{
                    padding: 14,
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-subtle)',
                    background: 'var(--bg-surface-subtle)',
                    fontSize: 12,
                    color: 'var(--text-secondary)',
                    lineHeight: 1.55,
                  }}
                >
                  <strong style={{ color: 'var(--text-primary)' }}>
                    Integración Nativa con Windows 10 / 11:
                  </strong>{' '}
                  El instalador oficial <code>PDF-LEF-Setup.exe</code> registra automáticamente la
                  asociación de archivos <code>.pdf</code> en el Explorador de Windows para abrir
                  cualquier documento con doble clic sin conexión a internet.
                </div>
              </div>
            )}

            {section === 'shortcuts' && (
              <div>
                <div style={{ marginBottom: 16 }}>
                  {[
                    ['Abrir archivo PDF', 'Ctrl + O'],
                    ['Guardar / Exportar PDF editado', 'Ctrl + S'],
                    ['Paleta rápida de comandos', 'Ctrl + K'],
                    ['Deshacer / Rehacer edición', 'Ctrl + Z / Ctrl + Y'],
                    ['Duplicar texto o imagen seleccionada', 'Ctrl + D'],
                    ['Eliminar elemento seleccionado', 'Supr / Backspace'],
                    ['Abrir Configuración Pro', 'Ctrl + ,'],
                  ].map(([label, keys]) => (
                    <div
                      key={label}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '8px 0',
                        borderBottom: '1px solid var(--border-subtle)',
                        fontSize: 12.5,
                      }}
                    >
                      <span>{label}</span>
                      <span className="kbd-badge">{keys}</span>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn btn-subtle"
                    onClick={handleExportProfile}
                  >
                    <Download size={14} />
                    <span>Exportar Configuración (.json)</span>
                  </button>

                  <label className="btn btn-subtle" style={{ cursor: 'pointer' }}>
                    <Upload size={14} />
                    <span>Importar Configuración…</span>
                    <input
                      type="file"
                      accept=".json,application/json"
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleImportProfile(f);
                      }}
                    />
                  </label>

                  <button
                    type="button"
                    className="btn btn-subtle"
                    style={{ color: 'var(--danger)' }}
                    onClick={() => {
                      onChangeSettings({ ...DEFAULT_SETTINGS });
                      onNotify('Configuración restaurada a los valores originales.');
                    }}
                  >
                    <RotateCcw size={14} />
                    <span>Restablecer de Fábrica</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
