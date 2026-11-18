import React, { useState } from 'react';
import {
  CheckCircle2,
  Download,
  Eye,
  Keyboard,
  Palette,
  PenTool,
  RefreshCw,
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
import { saveExportBlobOrBytes } from '../utils/tauriBridge';
import {
  CURRENT_APP_VERSION,
  checkGlobalAppUpdate,
  openExternalUrl,
  triggerOneClickUpdate,
  type RemoteUpdateInfo,
} from '../utils/updater';

interface SettingsModalProps {
  settings: AppSettings;
  onChangeSettings: (next: AppSettings) => void;
  onNotify: (msg: string) => void;
  onClose: () => void;
}

type SettingsSection = 'appearance' | 'viewer' | 'editor' | 'privacy' | 'shortcuts' | 'updates';

export const SettingsModal: React.FC<SettingsModalProps> = ({
  settings,
  onChangeSettings,
  onNotify,
  onClose,
}) => {
  const [section, setSection] = useState<SettingsSection>('appearance');
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [installingUpdate, setInstallingUpdate] = useState(false);
  const [updateResult, setUpdateResult] = useState<RemoteUpdateInfo | null>(null);

  const checkUpdates = async () => {
    setCheckingUpdate(true);
    setUpdateResult(null);
    try {
      const info = await checkGlobalAppUpdate(CURRENT_APP_VERSION);
      setUpdateResult(info);
    } catch {
      setUpdateResult({
        status: 'error',
        currentVersion: `v${CURRENT_APP_VERSION}`,
        latestVersion: `v${CURRENT_APP_VERSION}`,
        mandatory: false,
      });
    } finally {
      setCheckingUpdate(false);
    }
  };

  const handleInstallOneClick = async (downloadUrl: string) => {
    setInstallingUpdate(true);
    try {
      const res = await triggerOneClickUpdate(downloadUrl);
      onNotify(res.message);
    } finally {
      setInstallingUpdate(false);
    }
  };

  const update = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    onChangeSettings({ ...settings, [key]: value });
  };

  const handleExportProfile = async () => {
    const blob = new Blob([JSON.stringify(settings, null, 2)], {
      type: 'application/json',
    });
    const res = await saveExportBlobOrBytes(
      blob,
      'Kova-PDF-Configuracion.json',
      'Perfil de Configuración Kova PDF',
      'json'
    );
    if (res.saved) {
      onNotify(`Perfil de configuración guardado: ${res.fileName}`);
    }
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
            <span>Configuración y Preferencias — Kova PDF</span>
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
            <button
              type="button"
              className={`settings-nav-btn ${section === 'updates' ? 'active' : ''}`}
              onClick={() => setSection('updates')}
            >
              <RefreshCw size={15} />
              <span>Actualizaciones y Versión</span>
            </button>
          </nav>

          <div className="settings-content">
            {section === 'appearance' && (
              <div>
                <div className="setting-card">
                  <div>
                    <div className="setting-card-title">Tema Visual de la Aplicación</div>
                    <div className="setting-card-desc">
                      Elige Blanco Puro Editorial, Oscuro Obsidiana o sincronizar con Windows 11.
                    </div>
                  </div>
                  <select
                    className="prop-select"
                    value={settings.theme}
                    onChange={(e) => update('theme', e.target.value as ThemePreference)}
                  >
                    <option value="light">Claro Editorial (Blanco Puro)</option>
                    <option value="dark">Oscuro Obsidiana</option>
                    <option value="system">Automático según Windows</option>
                  </select>
                </div>

                <div className="setting-card">
                  <div>
                    <div className="setting-card-title">Color de Acento</div>
                    <div className="setting-card-desc">
                      Personaliza el color de controles activos, guías magnéticas y pestañas.
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {(
                      [
                        { id: 'cobalt', hex: '#2563EB', label: 'Zafiro Kova' },
                        { id: 'emerald', hex: '#0F766E', label: 'Esmeralda' },
                        { id: 'ruby', hex: '#C81E32', label: 'Rubí' },
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
                      Muestra dimensiones de página, estado offline y conteo de páginas.
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
                    <option value="1">100% (Recomendado)</option>
                    <option value="1.1">110%</option>
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
                    <option value="original">Papel Original</option>
                    <option value="night">Lectura Nocturna</option>
                    <option value="sepia">Sepia Cálido</option>
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
                    <div className="setting-card-title">Organización o Área (Opcional)</div>
                    <div className="setting-card-desc">
                      Se utiliza como referencia opcional en sellos rápidos y propiedades del PDF.
                    </div>
                  </div>
                  <input
                    type="text"
                    className="prop-input"
                    style={{ width: 210 }}
                    value={settings.companyName}
                    onChange={(e) => update('companyName', e.target.value)}
                  />
                </div>

                <div className="setting-card">
                  <div>
                    <div className="setting-card-title">Nombre de Autor en Notas y Firmas</div>
                    <div className="setting-card-desc">
                      Se incluye en comentarios de revisión y notas rápidas.
                    </div>
                  </div>
                  <input
                    type="text"
                    className="prop-input"
                    style={{ width: 210 }}
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
                      Alinea automáticamente columnas, renglones y centro de página al mover textos o imágenes.
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
                      Agrega fecha verificable debajo de cada firma o sello estampado.
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
                    <option value={600}>600 DPI (Alta Definición)</option>
                  </select>
                </div>

                <div className="setting-card">
                  <div>
                    <div className="setting-card-title">Limpiar Metadatos Ocultos Automáticamente al Guardar</div>
                    <div className="setting-card-desc">
                      Elimina rastros de autor anterior al exportar documentos para terceros.
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
                    Integración Nativa en Windows 10 y 11:
                  </strong>{' '}
                  El instalador oficial de <strong>Kova PDF</strong> registra{' '}
                  <code>KovaPDF.Document</code> con el icono geométrico oficial para abrir
                  cualquier archivo <code>.pdf</code> con doble clic 100% sin conexión.
                </div>
              </div>
            )}

            {section === 'shortcuts' && (
              <div>
                <div style={{ marginBottom: 16 }}>
                  {[
                    ['Abrir archivo PDF', 'Ctrl + O'],
                    ['Guardar PDF editado', 'Ctrl + S'],
                    ['Imprimir documento', 'Ctrl + P'],
                    ['Acercar / Alejar / 100% Zoom', 'Ctrl + Rueda / Ctrl + 0'],
                    ['Paleta rápida de comandos', 'Ctrl + K'],
                    ['Deshacer / Rehacer edición', 'Ctrl + Z / Ctrl + Y'],
                    ['Mover elemento con precisión', 'Flechas / Shift + Flechas'],
                    ['Duplicar objeto seleccionado', 'Ctrl + D'],
                    ['Eliminar elemento seleccionado', 'Supr / Backspace'],
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

            {section === 'updates' && (
              <div>
                <div className="setting-card">
                  <div>
                    <div className="setting-card-title">Versión Instalada</div>
                    <div className="setting-card-desc">
                      Kova PDF v{CURRENT_APP_VERSION} · Kova Studio (Edición Nativa 64-bit para Windows 10 y 11).
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={checkingUpdate}
                    onClick={checkUpdates}
                  >
                    <RefreshCw size={14} className={checkingUpdate ? 'spin-icon' : ''} />
                    <span>{checkingUpdate ? 'Consultando canal…' : 'Buscar actualizaciones'}</span>
                  </button>
                </div>

                <div className="setting-card" style={{ marginTop: 12 }}>
                  <div>
                    <div className="setting-card-title">Actualización directa silenciosa sin asistentes</div>
                    <div className="setting-card-desc">
                      Aplica mejoras empujadas desde el canal oficial en segundo plano sin abrir instaladores ni desconfigurar firmas, tema, recientes ni el lector PDF predeterminado.
                    </div>
                  </div>
                  <button
                    type="button"
                    className={`switch ${settings.autoInstallUpdates !== false ? 'on' : ''}`}
                    onClick={() => {
                      const nextVal = settings.autoInstallUpdates === false;
                      onChangeSettings({
                        ...settings,
                        autoCheckUpdates: nextVal ? true : settings.autoCheckUpdates,
                        autoInstallUpdates: nextVal,
                      });
                    }}
                  />
                </div>

                <div className="setting-card" style={{ marginTop: 12 }}>
                  <div>
                    <div className="setting-card-title">Verificar canal oficial automáticamente (En vivo)</div>
                    <div className="setting-card-desc">
                      Detecta actualizaciones o reversiones remotas al abrir y periódicamente mientras Kova PDF permanece abierto.
                    </div>
                  </div>
                  <button
                    type="button"
                    className={`switch ${settings.autoCheckUpdates ? 'on' : ''}`}
                    onClick={() => update('autoCheckUpdates', !settings.autoCheckUpdates)}
                  />
                </div>

                {updateResult && (
                  <div
                    style={{
                      marginTop: 14,
                      padding: '14px 18px',
                      borderRadius: 'var(--radius-md)',
                      background:
                        updateResult.status === 'latest'
                          ? 'rgba(13, 122, 95, 0.08)'
                          : updateResult.status === 'available'
                          ? 'rgba(37, 99, 235, 0.08)'
                          : 'rgba(220, 38, 38, 0.08)',
                      border: `1px solid ${
                        updateResult.status === 'latest'
                          ? 'rgba(13, 122, 95, 0.3)'
                          : updateResult.status === 'available'
                          ? 'rgba(37, 99, 235, 0.3)'
                          : 'rgba(220, 38, 38, 0.3)'
                      }`,
                    }}
                  >
                    {updateResult.status === 'latest' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--success)' }}>
                        <CheckCircle2 size={18} />
                        <div>
                          <strong>Estás en la versión oficial más reciente ({updateResult.latestVersion}).</strong>
                          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                            Tu estación cuenta con las últimas mejoras del motor gráfico y tipográfico de Kova PDF.
                          </div>
                        </div>
                      </div>
                    )}

                    {updateResult.status === 'available' && (
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
                          <strong style={{ color: 'var(--accent)' }}>
                            {updateResult.isRollback
                              ? `Versión objetivo de respaldo lista: ${updateResult.latestVersion}`
                              : `Actualización directa lista: ${updateResult.latestVersion}`}
                          </strong>
                          {updateResult.downloadUrl && (
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                              <button
                                type="button"
                                className="btn btn-primary"
                                style={{ height: 30, fontSize: 12 }}
                                disabled={installingUpdate}
                                onClick={() => handleInstallOneClick(updateResult.downloadUrl!)}
                              >
                                <Download size={13} />
                                <span>
                                  {installingUpdate
                                    ? 'Aplicando motor y reiniciando…'
                                    : 'Aplicar actualización directa'}
                                </span>
                              </button>
                              <button
                                type="button"
                                className="btn btn-subtle"
                                style={{ height: 30, fontSize: 11.5 }}
                                onClick={() => {
                                  openExternalUrl(updateResult.downloadUrl!);
                                  onNotify('Abriendo instalador de respaldo en tu navegador predeterminado…');
                                }}
                              >
                                <span>Respaldo .exe manual</span>
                              </button>
                            </div>
                          )}
                        </div>
                        <div
                          style={{
                            fontSize: 11.5,
                            color: 'var(--success)',
                            marginBottom: 6,
                            fontWeight: 600,
                          }}
                        >
                          ✓ Sin asistente de instalación ni pérdida de ajustes: actualiza únicamente el binario interno en 2 segundos y reabre Kova PDF automáticamente.
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>
                          {updateResult.notes || 'Mejoras de rendimiento, precisión tipográfica y seguridad.'}
                        </div>
                      </div>
                    )}

                    {updateResult.status === 'error' && (
                      <div style={{ color: 'var(--danger)', fontSize: 12.5 }}>
                        No se pudo conectar con el servidor global de distribución. Verifica tu conexión a internet.
                      </div>
                    )}
                  </div>
                )}

                <div
                  style={{
                    marginTop: 20,
                    padding: '16px',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
                    Actualización Directa In-Situ & Control Remoto de Versiones
                  </div>
                  <div style={{ fontSize: 12, lineHeight: 1.55, color: 'var(--text-secondary)' }}>
                    Cada actualización reemplaza de forma silenciosa únicamente el motor ejecutable (<code>/UPDATE</code>) sin mostrar ventanas de instalación ni tocar tu perfil local.
                    Tus firmas, logotipos, tema visual, archivos recientes y la asociación de Windows (<code>KovaPDF.Document</code>) permanecen 100% intactos — con soporte de reversión remota inmediata a versiones anteriores si alguna vez se requiere.
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
