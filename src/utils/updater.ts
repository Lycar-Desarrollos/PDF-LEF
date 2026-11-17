import { isTauriDesktop } from './tauriBridge';

export const CURRENT_APP_VERSION = '2.3.0';

export const GLOBAL_MANIFEST_URL =
  'https://lycar-desarrollos.github.io/PDF-LEF/update-manifest.json';
export const GITHUB_LATEST_RELEASE_API =
  'https://api.github.com/repos/Lycar-Desarrollos/PDF-LEF/releases/latest';

export interface RemoteUpdateInfo {
  status: 'latest' | 'available' | 'error';
  currentVersion: string;
  latestVersion: string;
  mandatory: boolean;
  autoInstall?: boolean;
  downloadUrl?: string;
  msiUrl?: string;
  releaseUrl?: string;
  notes?: string;
  announcement?: string;
}

export function parseSemver(v: string): number[] {
  return String(v || '0.0.0')
    .trim()
    .replace(/^v/i, '')
    .split(/[-+]/)[0]
    .split('.')
    .map((n) => parseInt(n, 10) || 0);
}

export function isNewerVersion(remoteTag: string, localVer: string): boolean {
  const r = parseSemver(remoteTag);
  const l = parseSemver(localVer);
  for (let i = 0; i < 3; i++) {
    if ((r[i] || 0) > (l[i] || 0)) return true;
    if ((r[i] || 0) < (l[i] || 0)) return false;
  }
  return false;
}

interface ManifestPayload {
  version?: string;
  minRequiredVersion?: string;
  mandatory?: boolean;
  autoInstall?: boolean;
  exeUrl?: string;
  msiUrl?: string;
  releaseUrl?: string;
  notesEs?: string;
  announcement?: string;
}

export async function checkGlobalAppUpdate(
  localVersion: string = CURRENT_APP_VERSION
): Promise<RemoteUpdateInfo> {
  let manifestData: ManifestPayload | null = null;
  let releaseTag: string | null = null;
  let releaseExeUrl: string | undefined;
  let releaseMsiUrl: string | undefined;
  let releaseHtmlUrl: string | undefined;
  let releaseBody: string | undefined;

  // 1. Primary Global CDN Manifest (Unlimited rate, instant remote control)
  try {
    const res = await fetch(`${GLOBAL_MANIFEST_URL}?t=${Date.now()}`, {
      cache: 'no-store',
    });
    if (res.ok) {
      manifestData = (await res.json()) as ManifestPayload;
    }
  } catch {
    // Fallback to GitHub Releases API below
  }

  // 2. Secondary GitHub Releases API (Automatic tag detection)
  try {
    const res = await fetch(GITHUB_LATEST_RELEASE_API, {
      headers: { Accept: 'application/vnd.github+json' },
      cache: 'no-store',
    });
    if (res.ok) {
      const release = await res.json();
      releaseTag = String(release.tag_name || '').replace(/^v/i, '') || null;
      releaseHtmlUrl = release.html_url;
      releaseBody = release.body || '';
      if (Array.isArray(release.assets)) {
        const exe = release.assets.find((a: { name?: string }) =>
          a.name?.toLowerCase().endsWith('.exe')
        );
        const msi = release.assets.find((a: { name?: string }) =>
          a.name?.toLowerCase().endsWith('.msi')
        );
        releaseExeUrl = exe?.browser_download_url;
        releaseMsiUrl = msi?.browser_download_url;
      }
    }
  } catch {
    // Ignore if offline or rate-limited when manifest succeeded
  }

  if (!manifestData && !releaseTag) {
    return {
      status: 'error',
      currentVersion: `v${localVersion.replace(/^v/i, '')}`,
      latestVersion: `v${localVersion.replace(/^v/i, '')}`,
      mandatory: false,
    };
  }

  const manifestVer = manifestData?.version?.replace(/^v/i, '') || '';
  const useReleaseOverManifest =
    releaseTag && (!manifestVer || isNewerVersion(releaseTag, manifestVer));

  const bestVersion = (useReleaseOverManifest ? releaseTag : manifestVer) || localVersion;
  const minReq = manifestData?.minRequiredVersion?.replace(/^v/i, '') || '0.0.0';
  const forcedByMinReq = isNewerVersion(minReq, localVersion);
  const mandatory = Boolean(manifestData?.mandatory || forcedByMinReq);

  const downloadUrl = useReleaseOverManifest
    ? releaseExeUrl || manifestData?.exeUrl || releaseHtmlUrl
    : manifestData?.exeUrl || releaseExeUrl || manifestData?.releaseUrl || releaseHtmlUrl;

  const msiUrl = useReleaseOverManifest
    ? releaseMsiUrl || manifestData?.msiUrl
    : manifestData?.msiUrl || releaseMsiUrl;

  const notes = useReleaseOverManifest
    ? releaseBody || manifestData?.notesEs || ''
    : manifestData?.notesEs || releaseBody || '';

  if (isNewerVersion(bestVersion, localVersion)) {
    return {
      status: 'available',
      currentVersion: `v${localVersion.replace(/^v/i, '')}`,
      latestVersion: `v${bestVersion.replace(/^v/i, '')}`,
      mandatory,
      autoInstall: Boolean(manifestData?.autoInstall),
      downloadUrl,
      msiUrl,
      releaseUrl: manifestData?.releaseUrl || releaseHtmlUrl,
      notes,
      announcement: manifestData?.announcement || '',
    };
  }

  return {
    status: 'latest',
    currentVersion: `v${localVersion.replace(/^v/i, '')}`,
    latestVersion: `v${bestVersion.replace(/^v/i, '')}`,
    mandatory: false,
    announcement: manifestData?.announcement || '',
  };
}

export async function openExternalUrl(url: string): Promise<void> {
  if (!url) return;
  if (isTauriDesktop()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('open_external_url', { url });
      return;
    } catch {
      // Fallback below if invoke fails
    }
  }
  if (typeof window !== 'undefined') {
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}

export async function triggerOneClickUpdate(
  downloadUrl: string
): Promise<{ nativeInstalled: boolean; message: string }> {
  if (isTauriDesktop() && downloadUrl.toLowerCase().endsWith('.exe')) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const msg = await invoke<string>('download_and_install_update', {
        downloadUrl,
      });
      return { nativeInstalled: true, message: msg };
    } catch (err) {
      await openExternalUrl(downloadUrl);
      return {
        nativeInstalled: false,
        message:
          err instanceof Error
            ? `${err.message} Se abrió la descarga directa en tu navegador predeterminado.`
            : 'Se abrió la descarga directa del instalador en tu navegador.',
      };
    }
  }

  await openExternalUrl(downloadUrl);
  return {
    nativeInstalled: false,
    message: 'Descarga del instalador oficial iniciada en tu navegador. Ejecútalo para completar la actualización.',
  };
}
