export const APP_VERSION = '1.5.1';

// Stealth public repo storing Releases & latest APK metadata
export const UPDATE_REPO = 'MiniCookieWolf/notes-sync-7f3a9c';
const GITHUB_API_LATEST = `https://api.github.com/repos/${UPDATE_REPO}/releases/latest`;
const LAST_CHECK_KEY = 'studypro_last_update_check_v1';

export type UpdateStatus = 'up_to_date' | 'update_available' | 'error';

export interface UpdateCheckResult {
  status: UpdateStatus;
  currentVersion: string;
  latestVersion?: string;
  downloadUrl?: string;
  releaseUrl?: string;
  notes?: string;
  checkedAt: number;
  error?: string;
}

export function compareVersions(a: string, b: string): number {
  const clean = (v: string) =>
    v
      .replace(/^v/i, '')
      .split('-')[0]
      .split('.')
      .map((n) => parseInt(n, 10) || 0);
  const pa = clean(a);
  const pb = clean(b);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const da = pa[i] ?? 0;
    const db = pb[i] ?? 0;
    if (da > db) return 1;
    if (da < db) return -1;
  }
  return 0;
}

export function shouldAutoCheck(autoEnabled: boolean): boolean {
  if (!autoEnabled) return false;
  try {
    const raw = localStorage.getItem(LAST_CHECK_KEY);
    if (!raw) return true;
    const last = Number(raw);
    return Date.now() - last > 6 * 60 * 60 * 1000; // check at most every 6h automatically
  } catch {
    return true;
  }
}

export async function checkForAppUpdate(): Promise<UpdateCheckResult> {
  const checkedAt = Date.now();
  try {
    localStorage.setItem(LAST_CHECK_KEY, String(checkedAt));
  } catch {
    // ignore storage errors
  }

  try {
    const res = await fetch(GITHUB_API_LATEST, {
      headers: { Accept: 'application/vnd.github+json' },
      cache: 'no-store',
    });

    if (!res.ok) {
      return {
        status: 'error',
        currentVersion: APP_VERSION,
        checkedAt,
        error: `HTTP ${res.status}`,
      };
    }

    const data = await res.json();
    const rawTag: string = data.tag_name || data.name || '';
    const latestVersion = rawTag.replace(/^v/i, '').trim() || APP_VERSION;

    const assets: Array<{ name?: string; browser_download_url?: string }> = Array.isArray(data.assets)
      ? data.assets
      : [];
    const apkAsset =
      assets.find((a) => typeof a.name === 'string' && /^StudyPro-v.*\.apk$/i.test(a.name)) ??
      assets.find((a) => typeof a.name === 'string' && a.name.toLowerCase().endsWith('.apk'));

    const downloadUrl: string =
      apkAsset?.browser_download_url ||
      data.html_url ||
      `https://github.com/${UPDATE_REPO}/releases/latest`;

    const isNewer = compareVersions(latestVersion, APP_VERSION) > 0;

    return {
      status: isNewer ? 'update_available' : 'up_to_date',
      currentVersion: APP_VERSION,
      latestVersion,
      downloadUrl,
      releaseUrl: data.html_url,
      notes: typeof data.body === 'string' ? data.body : '',
      checkedAt,
    };
  } catch (err) {
    return {
      status: 'error',
      currentVersion: APP_VERSION,
      checkedAt,
      error: err instanceof Error ? err.message : 'Gagal menghubungi server update',
    };
  }
}
