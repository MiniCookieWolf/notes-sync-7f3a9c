import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';

export const APP_VERSION = '1.3.1';
export const VERSION_JSON_URL =
  'https://github.com/MiniCookieWolf/notes-sync-7f3a9c/releases/latest/download/version.json';
export const UPDATE_API_URL =
  'https://api.github.com/repos/MiniCookieWolf/notes-sync-7f3a9c/releases/latest';

const LAST_CHECK_KEY = 'ws_last_update_check_v1';
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

export interface DownloadProgress {
  percent: number;
  downloadedMb: number;
  totalMb: number;
}

interface AppUpdaterPlugin {
  checkLatestVersion(opts: { url: string }): Promise<{ status: number; raw: string }>;
  downloadAndInstall(opts: { url: string }): Promise<{ status: 'installing' | 'needs_permission' }>;
  installCachedApk(): Promise<{ status: 'installing' | 'needs_permission' }>;
  addListener(
    eventName: 'downloadProgress',
    listenerFunc: (info: DownloadProgress) => void
  ): Promise<PluginListenerHandle>;
}

const AppUpdater = registerPlugin<AppUpdaterPlugin>('AppUpdater');

export function isNativeAndroid(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

export interface UpdateCheckResult {
  status: 'update_available' | 'up_to_date' | 'error';
  currentVersion: string;
  latestVersion: string;
  downloadUrl: string;
  releaseUrl: string;
  notes: string;
  publishedAt: string;
  errorMessage?: string;
}

export function compareSemver(a: string, b: string): number {
  const pa = a.replace(/^v/i, '').split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.replace(/^v/i, '').split('.').map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length, 3);
  for (let i = 0; i < len; i++) {
    const va = pa[i] || 0;
    const vb = pb[i] || 0;
    if (va > vb) return 1;
    if (va < vb) return -1;
  }
  return 0;
}

export function shouldAutoCheck(): boolean {
  try {
    const raw = localStorage.getItem(LAST_CHECK_KEY);
    if (!raw) return true;
    const last = Number(raw);
    return !Number.isFinite(last) || Date.now() - last > CHECK_INTERVAL_MS;
  } catch {
    return true;
  }
}

export async function checkForAppUpdate(): Promise<UpdateCheckResult> {
  try {
    localStorage.setItem(LAST_CHECK_KEY, String(Date.now()));
  } catch {
    // ignore
  }

  // Primary path on native Android: fetch version.json via native HTTP (zero CORS, zero API rate limit)
  if (isNativeAndroid()) {
    try {
      const resp = await AppUpdater.checkLatestVersion({ url: VERSION_JSON_URL });
      if (resp.status >= 200 && resp.status < 300 && resp.raw) {
        const meta = JSON.parse(resp.raw) as {
          version?: string;
          downloadUrl?: string;
          notes?: string;
          publishedAt?: string;
        };
        const latestRaw = (meta.version || APP_VERSION).replace(/^v/i, '');
        const cmp = compareSemver(latestRaw, APP_VERSION);
        return {
          status: cmp > 0 ? 'update_available' : 'up_to_date',
          currentVersion: APP_VERSION,
          latestVersion: latestRaw,
          downloadUrl: meta.downloadUrl || '',
          releaseUrl: meta.downloadUrl || '',
          notes: meta.notes || '',
          publishedAt: meta.publishedAt || '',
        };
      }
    } catch {
      // Fall through to GitHub API fallback
    }
  }

  try {
    const res = await fetch(UPDATE_API_URL, {
      cache: 'no-store',
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!res.ok) {
      return {
        status: 'error',
        currentVersion: APP_VERSION,
        latestVersion: APP_VERSION,
        downloadUrl: '',
        releaseUrl: '',
        notes: '',
        publishedAt: '',
        errorMessage: `Gagal memeriksa update (HTTP ${res.status})`,
      };
    }

    const data = (await res.json()) as {
      tag_name?: string;
      html_url?: string;
      body?: string;
      published_at?: string;
      assets?: Array<{ name?: string; browser_download_url?: string }>;
    };

    const latestRaw = (data.tag_name || APP_VERSION).replace(/^v/i, '');
    const apkAsset = (data.assets || []).find((a) =>
      (a.name || '').toLowerCase().endsWith('.apk')
    );
    const downloadUrl = apkAsset?.browser_download_url || data.html_url || '';
    const releaseUrl = data.html_url || downloadUrl;
    const cmp = compareSemver(latestRaw, APP_VERSION);

    return {
      status: cmp > 0 ? 'update_available' : 'up_to_date',
      currentVersion: APP_VERSION,
      latestVersion: latestRaw,
      downloadUrl,
      releaseUrl,
      notes: data.body || '',
      publishedAt: data.published_at || '',
    };
  } catch {
    return {
      status: 'error',
      currentVersion: APP_VERSION,
      latestVersion: APP_VERSION,
      downloadUrl: '',
      releaseUrl: '',
      notes: '',
      publishedAt: '',
      errorMessage: 'Tidak dapat terhubung ke server update (cek koneksi internet).',
    };
  }
}

export async function startInAppUpdate(
  downloadUrl: string,
  onProgress: (prog: DownloadProgress) => void
): Promise<{ status: 'installing' | 'needs_permission' | 'browser_fallback' | 'error'; error?: string }> {
  if (!isNativeAndroid()) {
    window.open(downloadUrl, '_blank', 'noopener,noreferrer');
    return { status: 'browser_fallback' };
  }
  let handle: PluginListenerHandle | null = null;
  try {
    handle = await AppUpdater.addListener('downloadProgress', onProgress);
    const res = await AppUpdater.downloadAndInstall({ url: downloadUrl });
    return { status: res.status };
  } catch (err) {
    return { status: 'error', error: err instanceof Error ? err.message : String(err) };
  } finally {
    if (handle) {
      await handle.remove().catch(() => {});
    }
  }
}

export async function retryInstallCachedApk(): Promise<{
  status: 'installing' | 'needs_permission' | 'error';
  error?: string;
}> {
  try {
    const res = await AppUpdater.installCachedApk();
    return { status: res.status };
  } catch (err) {
    return { status: 'error', error: err instanceof Error ? err.message : String(err) };
  }
}
