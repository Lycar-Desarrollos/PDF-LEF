export function isTauriDesktop(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export async function minimizeNativeWindow(): Promise<void> {
  if (!isTauriDesktop()) return;
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    await getCurrentWindow().minimize();
  } catch {
    // Fallback noop in browser preview
  }
}

export async function toggleMaximizeNativeWindow(): Promise<void> {
  if (!isTauriDesktop()) {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen().catch(() => {});
    } else {
      await document.exitFullscreen().catch(() => {});
    }
    return;
  }
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    await getCurrentWindow().toggleMaximize();
  } catch {
    // Ignore
  }
}

export async function closeNativeWindow(): Promise<void> {
  if (!isTauriDesktop()) return;
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    await getCurrentWindow().close();
  } catch {
    // Ignore
  }
}

export interface OpenedPdfPayload {
  fileName: string;
  filePath?: string;
  bytes: Uint8Array;
}

export async function openPdfFilesWithDialog(multiple = true): Promise<OpenedPdfPayload[]> {
  if (isTauriDesktop()) {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const { invoke } = await import('@tauri-apps/api/core');
      const selected = await open({
        multiple,
        filters: [{ name: 'Documentos PDF', extensions: ['pdf'] }],
      });
      if (!selected) return [];
      const paths = Array.isArray(selected) ? selected : [selected];
      const results: OpenedPdfPayload[] = [];
      for (const p of paths) {
        const rawBytes = await invoke<number[]>('read_pdf_bytes', { path: p });
        const fileName = p.split(/[\\/]/).pop() || 'Documento.pdf';
        results.push({
          fileName,
          filePath: p,
          bytes: new Uint8Array(rawBytes),
        });
      }
      return results;
    } catch {
      // Fall back to standard file picker if plugin not active
    }
  }

  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,application/pdf';
    input.multiple = multiple;
    input.onchange = async () => {
      const files = Array.from(input.files || []);
      const payloads: OpenedPdfPayload[] = [];
      for (const file of files) {
        const buf = await file.arrayBuffer();
        payloads.push({
          fileName: file.name,
          bytes: new Uint8Array(buf),
        });
      }
      resolve(payloads);
    };
    input.oncancel = () => resolve([]);
    input.click();
  });
}

export async function savePdfBytesToDisk(
  bytes: Uint8Array,
  suggestedName: string,
  directPath?: string
): Promise<{ saved: boolean; filePath?: string; fileName: string }> {
  const cleanName = suggestedName.toLowerCase().endsWith('.pdf')
    ? suggestedName
    : `${suggestedName}.pdf`;

  if (isTauriDesktop()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      let targetPath = directPath;
      if (!targetPath) {
        const { save } = await import('@tauri-apps/plugin-dialog');
        const chosen = await save({
          defaultPath: cleanName,
          filters: [{ name: 'Documento PDF', extensions: ['pdf'] }],
        });
        if (!chosen) return { saved: false, fileName: cleanName };
        targetPath = chosen;
      }
      await invoke('write_pdf_bytes', {
        path: targetPath,
        bytes: Array.from(bytes),
      });
      const finalName = targetPath.split(/[\\/]/).pop() || cleanName;
      return { saved: true, filePath: targetPath, fileName: finalName };
    } catch {
      // Fallback to browser download
    }
  }

  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const blob = new Blob([copy.buffer], { type: 'application/pdf' });
  downloadBlobInBrowser(blob, cleanName);
  return { saved: true, fileName: cleanName };
}

export function downloadBlobInBrowser(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

export async function saveExportBlobOrBytes(
  payload: Blob | Uint8Array,
  suggestedName: string,
  filterLabel: string,
  extension: string
): Promise<{ saved: boolean; filePath?: string; fileName: string }> {
  const cleanExt = extension.replace(/^\./, '').toLowerCase();
  const cleanName = suggestedName.toLowerCase().endsWith(`.${cleanExt}`)
    ? suggestedName
    : `${suggestedName}.${cleanExt}`;

  if (isTauriDesktop()) {
    try {
      const { save } = await import('@tauri-apps/plugin-dialog');
      const { invoke } = await import('@tauri-apps/api/core');
      const chosen = await save({
        defaultPath: cleanName,
        filters: [{ name: filterLabel, extensions: [cleanExt] }],
      });
      if (!chosen) return { saved: false, fileName: cleanName };
      const targetPath = chosen.toLowerCase().endsWith(`.${cleanExt}`)
        ? chosen
        : `${chosen}.${cleanExt}`;
      const bytes =
        payload instanceof Uint8Array
          ? payload
          : new Uint8Array(await payload.arrayBuffer());
      await invoke('write_export_bytes', {
        path: targetPath,
        bytes: Array.from(bytes),
      });
      const finalName = targetPath.split(/[\\/]/).pop() || cleanName;
      return { saved: true, filePath: targetPath, fileName: finalName };
    } catch {
      // Fallback to standard browser download below
    }
  }

  const blob =
    payload instanceof Blob
      ? payload
      : (() => {
          const copy = new Uint8Array(payload.byteLength);
          copy.set(payload);
          return new Blob([copy.buffer]);
        })();
  downloadBlobInBrowser(blob, cleanName);
  return { saved: true, fileName: cleanName };
}

export async function copyTextToClipboardSafe(text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fallback below
    }
  }
  if (typeof document !== 'undefined') {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
  return false;
}

export async function checkStartupOpenedPdfFromWindows(): Promise<OpenedPdfPayload | null> {
  if (!isTauriDesktop()) return null;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const startupPath = await invoke<string | null>('get_startup_pdf_path');
    if (!startupPath) return null;
    const rawBytes = await invoke<number[]>('read_pdf_bytes', { path: startupPath });
    const fileName = startupPath.split(/[\\/]/).pop() || 'Documento.pdf';
    return {
      fileName,
      filePath: startupPath,
      bytes: new Uint8Array(rawBytes),
    };
  } catch {
    return null;
  }
}

export async function readPdfFromLocalPath(filePath: string): Promise<OpenedPdfPayload | null> {
  if (!isTauriDesktop() || !filePath) return null;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const rawBytes = await invoke<number[]>('read_pdf_bytes', { path: filePath });
    const fileName = filePath.split(/[\\/]/).pop() || 'Documento.pdf';
    return {
      fileName,
      filePath,
      bytes: new Uint8Array(rawBytes),
    };
  } catch {
    return null;
  }
}

export async function registerDefaultPdfApp(): Promise<{ native: boolean; message: string }> {
  if (isTauriDesktop()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const msg = await invoke<string>('register_default_pdf_app');
      return { native: true, message: msg };
    } catch (err) {
      return {
        native: false,
        message: err instanceof Error ? err.message : 'No se pudo abrir Configuración de Windows.',
      };
    }
  }
  return {
    native: false,
    message:
      'En Windows 10 y 11, el instalador nativo de Kova PDF registra la asociación oficial para abrir cualquier archivo .pdf con doble clic.',
  };
}

