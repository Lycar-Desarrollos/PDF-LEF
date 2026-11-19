import type { BuiltinFontFamily, CustomFontEntry, FontFamilyChoice } from '../types/pdf';
import { isTauriDesktop } from './tauriBridge';

export interface BuiltinFontDescriptor {
  id: BuiltinFontFamily;
  label: string;
  category: 'sans' | 'serif' | 'mono' | 'script';
  cssFamily: string;
  canvasFamily: string;
  winFiles?: {
    normal: string[];
    bold: string[];
    italic: string[];
    boldItalic: string[];
  };
  bundledWebPaths?: {
    normal: string;
    bold: string;
    italic: string;
    boldItalic: string;
  };
}

export const BUILTIN_FONT_CATALOG: BuiltinFontDescriptor[] = [
  {
    id: 'arial',
    label: 'Arial (Cotizaciones / Oficina)',
    category: 'sans',
    cssFamily: 'Arial, "Helvetica Neue", Helvetica, sans-serif',
    canvasFamily: 'Arial, Helvetica, sans-serif',
    winFiles: {
      normal: ['arial.ttf'],
      bold: ['arialbd.ttf', 'arial.ttf'],
      italic: ['ariali.ttf', 'arial.ttf'],
      boldItalic: ['arialbi.ttf', 'arialbd.ttf', 'arial.ttf'],
    },
  },
  {
    id: 'calibri',
    label: 'Calibri (Word / Excel)',
    category: 'sans',
    cssFamily: 'Calibri, "Segoe UI", Arial, sans-serif',
    canvasFamily: 'Calibri, "Segoe UI", Arial, sans-serif',
    winFiles: {
      normal: ['calibri.ttf'],
      bold: ['calibrib.ttf', 'calibri.ttf'],
      italic: ['calibrii.ttf', 'calibri.ttf'],
      boldItalic: ['calibribi.ttf', 'calibrib.ttf', 'calibri.ttf'],
    },
  },
  {
    id: 'roboto',
    label: 'Roboto (Moderna Integrada)',
    category: 'sans',
    cssFamily: '"Roboto", "Segoe UI", Arial, sans-serif',
    canvasFamily: '"Roboto", Arial, sans-serif',
    bundledWebPaths: {
      normal: '/fonts/Roboto-Regular.ttf',
      bold: '/fonts/Roboto-Bold.ttf',
      italic: '/fonts/Roboto-Italic.ttf',
      boldItalic: '/fonts/Roboto-BoldItalic.ttf',
    },
  },
  {
    id: 'segoe',
    label: 'Segoe UI (Corporativa)',
    category: 'sans',
    cssFamily: '"Segoe UI", Calibri, Arial, sans-serif',
    canvasFamily: '"Segoe UI", Arial, sans-serif',
    winFiles: {
      normal: ['segoeui.ttf'],
      bold: ['segoeuib.ttf', 'segoeui.ttf'],
      italic: ['segoeuii.ttf', 'segoeui.ttf'],
      boldItalic: ['segoeuiz.ttf', 'segoeuib.ttf', 'segoeui.ttf'],
    },
  },
  {
    id: 'tahoma',
    label: 'Tahoma (Facturación / ERP)',
    category: 'sans',
    cssFamily: 'Tahoma, Geneva, Verdana, sans-serif',
    canvasFamily: 'Tahoma, Verdana, sans-serif',
    winFiles: {
      normal: ['tahoma.ttf'],
      bold: ['tahomabd.ttf', 'tahoma.ttf'],
      italic: ['tahoma.ttf'],
      boldItalic: ['tahomabd.ttf', 'tahoma.ttf'],
    },
  },
  {
    id: 'verdana',
    label: 'Verdana (Tablas Legibles)',
    category: 'sans',
    cssFamily: 'Verdana, Geneva, Tahoma, sans-serif',
    canvasFamily: 'Verdana, Tahoma, sans-serif',
    winFiles: {
      normal: ['verdana.ttf'],
      bold: ['verdanab.ttf', 'verdana.ttf'],
      italic: ['verdanai.ttf', 'verdana.ttf'],
      boldItalic: ['verdanaz.ttf', 'verdanab.ttf', 'verdana.ttf'],
    },
  },
  {
    id: 'trebuchet',
    label: 'Trebuchet MS (Ejecutiva)',
    category: 'sans',
    cssFamily: '"Trebuchet MS", Arial, sans-serif',
    canvasFamily: '"Trebuchet MS", Arial, sans-serif',
    winFiles: {
      normal: ['trebuc.ttf'],
      bold: ['trebucbd.ttf', 'trebuc.ttf'],
      italic: ['trebucit.ttf', 'trebuc.ttf'],
      boldItalic: ['trebucbi.ttf', 'trebucbd.ttf', 'trebuc.ttf'],
    },
  },
  {
    id: 'sans',
    label: 'Helvetica (Estándar PDF)',
    category: 'sans',
    cssFamily: 'Helvetica, Arial, var(--font-sans)',
    canvasFamily: 'Helvetica, Arial, sans-serif',
  },
  {
    id: 'serif',
    label: 'Times New Roman (Legal)',
    category: 'serif',
    cssFamily: '"Times New Roman", Times, Georgia, serif',
    canvasFamily: '"Times New Roman", Georgia, serif',
    winFiles: {
      normal: ['times.ttf'],
      bold: ['timesbd.ttf', 'times.ttf'],
      italic: ['timesi.ttf', 'times.ttf'],
      boldItalic: ['timesbi.ttf', 'timesbd.ttf', 'times.ttf'],
    },
  },
  {
    id: 'georgia',
    label: 'Georgia (Editorial)',
    category: 'serif',
    cssFamily: 'Georgia, "Times New Roman", serif',
    canvasFamily: 'Georgia, "Times New Roman", serif',
    winFiles: {
      normal: ['georgia.ttf'],
      bold: ['georgiab.ttf', 'georgia.ttf'],
      italic: ['georgiai.ttf', 'georgia.ttf'],
      boldItalic: ['georgiaz.ttf', 'georgiab.ttf', 'georgia.ttf'],
    },
  },
  {
    id: 'consolas',
    label: 'Consolas (Folios / Código)',
    category: 'mono',
    cssFamily: 'Consolas, "Cascadia Code", "Courier New", monospace',
    canvasFamily: 'Consolas, "Courier New", monospace',
    winFiles: {
      normal: ['consola.ttf'],
      bold: ['consolab.ttf', 'consola.ttf'],
      italic: ['consolai.ttf', 'consola.ttf'],
      boldItalic: ['consolaz.ttf', 'consolab.ttf', 'consola.ttf'],
    },
  },
  {
    id: 'mono',
    label: 'Courier New (Monoespaciada)',
    category: 'mono',
    cssFamily: '"Courier New", Courier, var(--font-mono)',
    canvasFamily: '"Courier New", Courier, monospace',
    winFiles: {
      normal: ['cour.ttf'],
      bold: ['courbd.ttf', 'cour.ttf'],
      italic: ['couri.ttf', 'cour.ttf'],
      boldItalic: ['courbi.ttf', 'courbd.ttf', 'cour.ttf'],
    },
  },
  {
    id: 'script',
    label: 'Caligráfica / Cursiva',
    category: 'script',
    cssFamily: 'var(--font-script)',
    canvasFamily: '"Segoe Script", Georgia, serif',
    winFiles: {
      normal: ['segoesc.ttf'],
      bold: ['segoescb.ttf', 'segoesc.ttf'],
      italic: ['segoesc.ttf'],
      boldItalic: ['segoescb.ttf', 'segoesc.ttf'],
    },
  },
];

const BUILTIN_BY_ID = new Map<string, BuiltinFontDescriptor>(
  BUILTIN_FONT_CATALOG.map((item) => [item.id, item])
);

const customFontMetaMap = new Map<string, CustomFontEntry>();
const customFontBytesMap = new Map<string, Uint8Array>();
const systemFontBytesCache = new Map<string, Uint8Array | null>();

const IDB_NAME = 'kova_pdf_custom_fonts_v1';
const IDB_STORE = 'fonts';

interface IdbStoredFont {
  id: string;
  name: string;
  fileName: string;
  bytes: Uint8Array;
}

export function isValidFontBinary(bytes: Uint8Array): boolean {
  if (!bytes || bytes.byteLength < 512 || bytes.byteLength > 25_000_000) {
    return false;
  }
  const b0 = bytes[0];
  const b1 = bytes[1];
  const b2 = bytes[2];
  const b3 = bytes[3];
  const isTrueType = b0 === 0x00 && b1 === 0x01 && b2 === 0x00 && b3 === 0x00;
  const isOpenType = b0 === 0x4f && b1 === 0x54 && b2 === 0x54 && b3 === 0x4f; // 'OTTO'
  const isAppleTrue = b0 === 0x74 && b1 === 0x72 && b2 === 0x75 && b3 === 0x65; // 'true'
  const isTyp1 = b0 === 0x74 && b1 === 0x79 && b2 === 0x70 && b3 === 0x31; // 'typ1'
  return isTrueType || isOpenType || isAppleTrue || isTyp1;
}

export function cleanDisplayFontName(fileName: string): string {
  const withoutExt = (fileName || 'Fuente Personalizada')
    .replace(/\.(ttf|otf)$/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return (withoutExt || 'Fuente Personalizada').slice(0, 60);
}

export function buildCustomFontId(fileName: string, bytes: Uint8Array): string {
  const slug = cleanDisplayFontName(fileName)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 36) || 'font';

  let hash = 2166136261;
  const step = Math.max(1, Math.floor(bytes.byteLength / 512));
  for (let i = 0; i < bytes.byteLength; i += step) {
    hash ^= bytes[i];
    hash = Math.imul(hash, 16777619);
  }
  const hex = (hash >>> 0).toString(16).padStart(8, '0');
  return `${slug}_${hex}`;
}

async function registerDomFontFace(cssFamily: string, bytes: Uint8Array): Promise<void> {
  if (
    typeof window === 'undefined' ||
    typeof document === 'undefined' ||
    typeof FontFace === 'undefined' ||
    !document.fonts
  ) {
    return;
  }
  try {
    const bufferCopy = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(bufferCopy).set(bytes);
    const face = new FontFace(cssFamily, bufferCopy);
    const loaded = await face.load();
    document.fonts.add(loaded);
  } catch {
    // Non-fatal in headless environments
  }
}

function upsertMemoryFont(
  id: string,
  name: string,
  fileName: string,
  bytes: Uint8Array
): CustomFontEntry {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const cssFamily = `KovaCustom_${id}`;
  const entry: CustomFontEntry = {
    id,
    choice: `custom:${id}`,
    name,
    fileName,
    cssFamily,
  };
  customFontMetaMap.set(id, entry);
  customFontBytesMap.set(id, copy);
  return entry;
}

function openFontsIdb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function idbSaveFont(record: IdbStoredFont): Promise<void> {
  const db = await openFontsIdb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(record);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
    } catch {
      db.close();
      resolve();
    }
  });
}

async function idbLoadAllFonts(): Promise<IdbStoredFont[]> {
  const db = await openFontsIdb();
  if (!db) return [];
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).getAll();
      req.onsuccess = () => {
        const rows = Array.isArray(req.result) ? (req.result as IdbStoredFont[]) : [];
        db.close();
        resolve(rows);
      };
      req.onerror = () => {
        db.close();
        resolve([]);
      };
    } catch {
      db.close();
      resolve([]);
    }
  });
}

async function idbDeleteFont(id: string): Promise<void> {
  const db = await openFontsIdb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).delete(id);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
    } catch {
      db.close();
      resolve();
    }
  });
}

export function getCustomFontsSnapshot(): CustomFontEntry[] {
  return Array.from(customFontMetaMap.values()).sort((a, b) =>
    a.name.localeCompare(b.name, 'es')
  );
}

export async function loadSavedCustomFonts(): Promise<CustomFontEntry[]> {
  if (isTauriDesktop()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const rows = await invoke<
        Array<{ id: string; name: string; fileName: string; bytes: number[] }>
      >('list_custom_font_files');
      for (const row of rows) {
        const bytes = new Uint8Array(row.bytes);
        if (!isValidFontBinary(bytes)) continue;
        const entry = upsertMemoryFont(row.id, row.name, row.fileName, bytes);
        await registerDomFontFace(entry.cssFamily, bytes);
      }
      return getCustomFontsSnapshot();
    } catch {
      // Fall through to IndexedDB if Tauri invoke fails
    }
  }

  const idbRows = await idbLoadAllFonts();
  for (const row of idbRows) {
    const bytes =
      row.bytes instanceof Uint8Array ? row.bytes : new Uint8Array(row.bytes as ArrayBuffer);
    if (!isValidFontBinary(bytes)) continue;
    const entry = upsertMemoryFont(row.id, row.name, row.fileName, bytes);
    await registerDomFontFace(entry.cssFamily, bytes);
  }
  return getCustomFontsSnapshot();
}

export async function importCustomFontFromBytes(
  fileName: string,
  bytes: Uint8Array,
  customDisplayName?: string
): Promise<CustomFontEntry> {
  if (!isValidFontBinary(bytes)) {
    throw new Error(
      'Selecciona un archivo de tipografía válido en formato TrueType (.ttf) u OpenType (.otf).'
    );
  }

  const id = buildCustomFontId(fileName, bytes);
  const name = (customDisplayName?.trim() || cleanDisplayFontName(fileName)).slice(0, 60);
  const entry = upsertMemoryFont(id, name, fileName, bytes);
  await registerDomFontFace(entry.cssFamily, bytes);

  if (isTauriDesktop()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('save_custom_font_file', {
        id,
        name,
        fileName,
        bytes: Array.from(bytes),
      });
      return entry;
    } catch {
      // Fallback to IndexedDB
    }
  }

  await idbSaveFont({ id, name, fileName, bytes: customFontBytesMap.get(id)! });
  return entry;
}

export async function importCustomFontFile(file: File): Promise<CustomFontEntry> {
  const buf = await file.arrayBuffer();
  return importCustomFontFromBytes(file.name, new Uint8Array(buf));
}

export async function removeCustomFont(idOrChoice: string): Promise<CustomFontEntry[]> {
  const id = idOrChoice.startsWith('custom:') ? idOrChoice.slice(7) : idOrChoice;
  customFontMetaMap.delete(id);
  customFontBytesMap.delete(id);

  if (isTauriDesktop()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('delete_custom_font_file', { id });
    } catch {
      // Ignore
    }
  }
  await idbDeleteFont(id);
  return getCustomFontsSnapshot();
}

export function clearMemoryCustomFontsForTests(): void {
  customFontMetaMap.clear();
  customFontBytesMap.clear();
}

export function getFontFallbackCategory(
  choice?: FontFamilyChoice
): 'sans' | 'serif' | 'mono' | 'script' {
  if (!choice || choice.startsWith('custom:')) return 'sans';
  return BUILTIN_BY_ID.get(choice)?.category || 'sans';
}

export function getFontDisplayLabel(choice?: FontFamilyChoice): string {
  if (!choice) return 'Helvetica (Estándar PDF)';
  if (choice.startsWith('custom:')) {
    const id = choice.slice(7);
    return customFontMetaMap.get(id)?.name || 'Fuente Personalizada';
  }
  return BUILTIN_BY_ID.get(choice)?.label || 'Helvetica (Estándar PDF)';
}

export function cssFontForChoice(choice?: FontFamilyChoice): string {
  if (!choice) return 'var(--font-sans)';
  if (choice.startsWith('custom:')) {
    const id = choice.slice(7);
    const entry = customFontMetaMap.get(id);
    if (entry) {
      return `"${entry.cssFamily}", Arial, sans-serif`;
    }
    return 'Arial, var(--font-sans)';
  }
  return BUILTIN_BY_ID.get(choice)?.cssFamily || 'var(--font-sans)';
}

export function canvasFontForChoice(choice?: FontFamilyChoice): string {
  if (!choice) return 'Arial, sans-serif';
  if (choice.startsWith('custom:')) {
    const id = choice.slice(7);
    const entry = customFontMetaMap.get(id);
    if (entry) {
      return `"${entry.cssFamily}", Arial, sans-serif`;
    }
    return 'Arial, sans-serif';
  }
  return BUILTIN_BY_ID.get(choice)?.canvasFamily || 'Arial, sans-serif';
}

export function matchPdfFontNameToChoice(rawHint: string): {
  family: FontFamilyChoice;
  weight: 'normal' | 'bold';
  style: 'normal' | 'italic';
} {
  const lower = (rawHint || '').toLowerCase();
  const weight: 'normal' | 'bold' =
    lower.includes('bold') ||
    lower.includes('black') ||
    lower.includes('demi') ||
    lower.includes('semibold') ||
    lower.includes('heavy')
      ? 'bold'
      : 'normal';
  const style: 'normal' | 'italic' =
    lower.includes('italic') || lower.includes('oblique') ? 'italic' : 'normal';

  // 1. Check if any user-uploaded custom font matches the embedded PDF font name
  const normalizedHint = lower.replace(/[^a-z0-9]/g, '');
  if (normalizedHint.length >= 4) {
    for (const entry of customFontMetaMap.values()) {
      const normalizedCustom = entry.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (normalizedCustom.length >= 4 && normalizedHint.includes(normalizedCustom)) {
        return { family: entry.choice, weight, style };
      }
    }
  }

  // 2. Match real office font families embedded in quotations, invoices, Word/Excel & ERP PDFs
  let family: FontFamilyChoice = 'sans';
  if (lower.includes('calibri')) {
    family = 'calibri';
  } else if (lower.includes('arial') || lower.includes('arimo') || lower.includes('liberationsans')) {
    family = 'arial';
  } else if (lower.includes('roboto')) {
    family = 'roboto';
  } else if (lower.includes('segoe')) {
    family = 'segoe';
  } else if (lower.includes('tahoma')) {
    family = 'tahoma';
  } else if (lower.includes('verdana')) {
    family = 'verdana';
  } else if (lower.includes('trebuchet') || lower.includes('trebuc')) {
    family = 'trebuchet';
  } else if (lower.includes('georgia')) {
    family = 'georgia';
  } else if (lower.includes('consolas') || lower.includes('consola') || lower.includes('cascadia')) {
    family = 'consolas';
  } else if (
    lower.includes('times') ||
    lower.includes('garamond') ||
    lower.includes('cambria') ||
    (lower.includes('serif') && !lower.includes('sans'))
  ) {
    family = 'serif';
  } else if (lower.includes('courier') || lower.includes('mono')) {
    family = 'mono';
  }

  return { family, weight, style };
}

async function loadBundledWebFontBytes(webPath: string): Promise<Uint8Array | null> {
  const cacheKey = `bundled:${webPath}`;
  if (systemFontBytesCache.has(cacheKey)) {
    return systemFontBytesCache.get(cacheKey) || null;
  }

  const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';
  if (isBrowser && typeof fetch === 'function') {
    try {
      const res = await fetch(webPath);
      if (res.ok) {
        const bytes = new Uint8Array(await res.arrayBuffer());
        if (isValidFontBinary(bytes)) {
          systemFontBytesCache.set(cacheKey, bytes);
          return bytes;
        }
      }
    } catch {
      // Ignore fetch error
    }
  } else {
    // Node.js automated test environment: read directly from public/fonts/
    try {
      const pfx = 'node:';
      const fsMod = await import(/* @vite-ignore */ `${pfx}fs`);
      const urlMod = await import(/* @vite-ignore */ `${pfx}url`);
      const pathMod = await import(/* @vite-ignore */ `${pfx}path`);
      const here = pathMod.dirname(urlMod.fileURLToPath(import.meta.url));
      const diskPath = pathMod.resolve(here, '../../public', webPath.replace(/^\/+/, ''));
      if (fsMod.existsSync(diskPath)) {
        const buf = fsMod.readFileSync(diskPath);
        const bytes = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
        if (isValidFontBinary(bytes)) {
          const copy = new Uint8Array(bytes.byteLength);
          copy.set(bytes);
          systemFontBytesCache.set(cacheKey, copy);
          return copy;
        }
      }
    } catch {
      // Ignore in non-Node runtimes
    }
  }

  systemFontBytesCache.set(cacheKey, null);
  return null;
}

export async function resolveFontBytesForPdfExport(
  choice: FontFamilyChoice | undefined,
  weight: 'normal' | 'bold' = 'normal',
  style: 'normal' | 'italic' = 'normal'
): Promise<{ bytes: Uint8Array; simulateBold: boolean } | null> {
  if (!choice || choice === 'sans') {
    return null;
  }

  if (choice.startsWith('custom:')) {
    const id = choice.slice(7);
    const customBytes = customFontBytesMap.get(id);
    if (customBytes && isValidFontBinary(customBytes)) {
      return { bytes: customBytes, simulateBold: weight === 'bold' };
    }
    return null;
  }

  const desc = BUILTIN_BY_ID.get(choice);
  if (!desc) return null;

  const variantKey: 'normal' | 'bold' | 'italic' | 'boldItalic' =
    weight === 'bold' && style === 'italic'
      ? 'boldItalic'
      : weight === 'bold'
        ? 'bold'
        : style === 'italic'
          ? 'italic'
          : 'normal';

  if (desc.bundledWebPaths) {
    const webBytes = await loadBundledWebFontBytes(desc.bundledWebPaths[variantKey]);
    if (webBytes) {
      return { bytes: webBytes, simulateBold: false };
    }
  }

  if (desc.winFiles && isTauriDesktop()) {
    const candidates = desc.winFiles[variantKey];
    const cacheKey = `win:${choice}:${variantKey}`;
    if (systemFontBytesCache.has(cacheKey)) {
      const cached = systemFontBytesCache.get(cacheKey);
      return cached ? { bytes: cached, simulateBold: false } : null;
    }

    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const raw = await invoke<number[] | null>('read_system_font_bytes', { candidates });
      if (raw && raw.length > 512) {
        const bytes = new Uint8Array(raw);
        if (isValidFontBinary(bytes)) {
          systemFontBytesCache.set(cacheKey, bytes);
          return { bytes, simulateBold: false };
        }
      }
    } catch {
      // Fallback gracefully to StandardFonts if unavailable
    }
    systemFontBytesCache.set(cacheKey, null);
  }

  return null;
}
