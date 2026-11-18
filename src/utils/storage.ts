import type {
  AppSettings,
  RecentFileEntry,
  SavedLogo,
  SavedSignature,
} from '../types/pdf';

const SETTINGS_KEY = 'kova_pdf_settings_v2';
const SIGNATURES_KEY = 'kova_pdf_signatures_v2';
const LOGOS_KEY = 'kova_pdf_logos_v2';
const RECENTS_KEY = 'kova_pdf_recents_v2';

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'light',
  accent: 'cobalt',
  density: 'standard',
  uiScale: 100,
  showStatusBar: true,
  smoothAnimations: true,

  defaultZoom: 1.0,
  defaultViewLayout: 'continuous',
  defaultPaperFilter: 'original',
  defaultLeftPanel: 'thumbnails',
  hiDpiRendering: true,

  authorName: 'Ejecutivo',
  companyName: 'Dirección Corporativa',
  defaultTaxRatePct: 16,
  currencySymbol: '$',
  defaultFontFamily: 'sans',
  defaultFontSizePt: 12,
  defaultTextColor: '#0F172A',
  defaultHighlightColor: '#FACC15',
  defaultInkColor: '#2563EB',
  defaultInkWidth: 2.2,
  snapGuides: true,
  autoSelectAfterInsert: true,
  includeDateOnSignature: true,
  includeDateOnStamps: true,

  exportImageDpi: 300,
  autoCleanMetadataOnExport: false,
  confirmCloseUnsaved: true,
  strictOfflineIndicator: true,
  autoCheckUpdates: true,
  autoInstallUpdates: true,
};

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage quota errors
  }
  applySettingsToDom(settings);
}

export function applySettingsToDom(settings: AppSettings): void {
  const root = document.documentElement;
  let resolvedTheme: 'light' | 'dark' = 'light';
  if (settings.theme === 'system') {
    resolvedTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } else {
    resolvedTheme = settings.theme;
  }

  root.setAttribute('data-theme', resolvedTheme);
  root.setAttribute('data-accent', settings.accent);
  root.setAttribute('data-density', settings.density);
  root.setAttribute('data-animations', settings.smoothAnimations ? 'on' : 'off');
  root.style.fontSize = `${settings.uiScale}%`;
}

export function loadSavedSignatures(): SavedSignature[] {
  try {
    const raw = localStorage.getItem(SIGNATURES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveSignaturesList(list: SavedSignature[]): void {
  try {
    localStorage.setItem(SIGNATURES_KEY, JSON.stringify(list));
  } catch {
    // Ignore
  }
}

export function loadSavedLogos(): SavedLogo[] {
  try {
    const raw = localStorage.getItem(LOGOS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveLogosList(list: SavedLogo[]): void {
  try {
    localStorage.setItem(LOGOS_KEY, JSON.stringify(list));
  } catch {
    // Ignore
  }
}

export function loadRecentFiles(): RecentFileEntry[] {
  try {
    const raw = localStorage.getItem(RECENTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function recordRecentFile(
  entry: Omit<RecentFileEntry, 'id' | 'lastOpenedAt'>
): RecentFileEntry[] {
  const existing = loadRecentFiles();
  const key = entry.filePath || entry.fileName;
  const prev = existing.find((item) => (item.filePath || item.fileName) === key);
  const updatedItem: RecentFileEntry = {
    id: prev?.id || `rec_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    fileName: entry.fileName,
    filePath: entry.filePath,
    fileSize: entry.fileSize,
    pageCount: entry.pageCount,
    lastOpenedAt: Date.now(),
    pinned: prev?.pinned ?? false,
  };
  const next = [
    updatedItem,
    ...existing.filter((item) => (item.filePath || item.fileName) !== key),
  ].slice(0, 18);
  try {
    localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
  } catch {
    // Ignore
  }
  return next;
}

export function togglePinRecentFile(id: string): RecentFileEntry[] {
  const next = loadRecentFiles().map((r) => (r.id === id ? { ...r, pinned: !r.pinned } : r));
  localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
  return next;
}

export function clearRecentFiles(): RecentFileEntry[] {
  const pinnedOnly = loadRecentFiles().filter((r) => r.pinned);
  localStorage.setItem(RECENTS_KEY, JSON.stringify(pinnedOnly));
  return pinnedOnly;
}
