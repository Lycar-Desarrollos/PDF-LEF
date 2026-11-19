import { isTauriDesktop } from './tauriBridge';

export const CURRENT_APP_VERSION = '2.3.3';

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
  isRollback?: boolean;
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

export interface ManifestPayload {
  version?: string;
  minRequiredVersion?: string;
  mandatory?: boolean;
  autoInstall?: boolean;
  allowDowngrade?: boolean;
  exeUrl?: string;
  msiUrl?: string;
  releaseUrl?: string;
  notesEs?: string;
  announcement?: string;
}

export interface ReleaseSnapshot {
  tag?: string | null;
  exeUrl?: string;
  msiUrl?: string;
  htmlUrl?: string;
  body?: string;
}

export function evaluateUpdateDecision(
  localVersion: string,
  manifestData: ManifestPayload | null,
  release: ReleaseSnapshot | null
): RemoteUpdateInfo {
  const cleanLocal = localVersion.replace(/^v/i, '');
  const releaseTag = release?.tag ? release.tag.replace(/^v/i, '') : null;

  if (!manifestData && !releaseTag) {
    return {
      status: 'error',
      currentVersion: `v${cleanLocal}`,
      latestVersion: `v${cleanLocal}`,
      mandatory: false,
    };
  }

  const manifestVer = manifestData?.version?.replace(/^v/i, '') || '';
  const localTuple = parseSemver(cleanLocal).slice(0, 3).join('.');
  const manifestTuple = manifestVer ? parseSemver(manifestVer).slice(0, 3).join('.') : '';

  // Instant Remote Fleet Rollback: if allowDowngrade is enabled in manifest, pin directly to manifest version
  if (manifestData?.allowDowngrade && manifestVer && manifestTuple !== localTuple) {
    return {
      status: 'available',
      currentVersion: `v${cleanLocal}`,
      latestVersion: `v${manifestVer}`,
      mandatory: Boolean(manifestData.mandatory),
      autoInstall: Boolean(manifestData.autoInstall ?? true),
      isRollback: isNewerVersion(cleanLocal, manifestVer),
      downloadUrl: manifestData.exeUrl || manifestData.releaseUrl,
      msiUrl: manifestData.msiUrl,
      releaseUrl: manifestData.releaseUrl,
      notes: manifestData.notesEs || '',
      announcement: manifestData.announcement || '',
    };
  }

  const useReleaseOverManifest =
    Boolean(releaseTag) &&
    !manifestData?.allowDowngrade &&
    (!manifestVer || isNewerVersion(releaseTag!, manifestVer));

  const bestVersion = (useReleaseOverManifest ? releaseTag : manifestVer) || cleanLocal;
  const minReq = manifestData?.minRequiredVersion?.replace(/^v/i, '') || '0.0.0';
  const forcedByMinReq = isNewerVersion(minReq, cleanLocal);
  const mandatory = Boolean(manifestData?.mandatory || forcedByMinReq);

  const downloadUrl = useReleaseOverManifest
    ? release?.exeUrl || manifestData?.exeUrl || release?.htmlUrl
    : manifestData?.exeUrl || release?.exeUrl || manifestData?.releaseUrl || release?.htmlUrl;

  const msiUrl = useReleaseOverManifest
    ? release?.msiUrl || manifestData?.msiUrl
    : manifestData?.msiUrl || release?.msiUrl;

  const notes = useReleaseOverManifest
    ? release?.body || manifestData?.notesEs || ''
    : manifestData?.notesEs || release?.body || '';

  if (isNewerVersion(bestVersion, cleanLocal)) {
    return {
      status: 'available',
      currentVersion: `v${cleanLocal}`,
      latestVersion: `v${bestVersion.replace(/^v/i, '')}`,
      mandatory,
      autoInstall: Boolean(manifestData?.autoInstall),
      isRollback: false,
      downloadUrl,
      msiUrl,
      releaseUrl: manifestData?.releaseUrl || release?.htmlUrl,
      notes,
      announcement: manifestData?.announcement || '',
    };
  }

  return {
    status: 'latest',
    currentVersion: `v${cleanLocal}`,
    latestVersion: `v${bestVersion.replace(/^v/i, '')}`,
    mandatory: false,
    announcement: manifestData?.announcement || '',
  };
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

  // 1. Primary Global CDN Manifest (Unlimited rate, instant remote control & rollback)
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

  return evaluateUpdateDecision(localVersion, manifestData, {
    tag: releaseTag,
    exeUrl: releaseExeUrl,
    msiUrl: releaseMsiUrl,
    htmlUrl: releaseHtmlUrl,
    body: releaseBody,
  });
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
