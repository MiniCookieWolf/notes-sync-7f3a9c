import { exportProgressJSON } from './storage';
import type { UserProgress } from './types';

export const DRIVE_BACKUP_FILENAME = 'studypro-backup-v1.json';
export const DRIVE_SCOPES =
  'https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile';

const SESSION_KEY = 'studypro_google_session_v1';
const CUSTOM_CLIENT_ID_KEY = 'studypro_google_client_id_v1';
const AUTO_SYNC_KEY = 'studypro_drive_autosync_v1';
const LAST_CLOUD_SYNC_KEY = 'studypro_drive_last_sync_v1';

export interface GoogleUserProfile {
  name: string;
  email: string;
  picture?: string;
}

export interface GoogleSession {
  accessToken: string;
  expiresAt: number;
  user: GoogleUserProfile;
}

export interface DriveBackupMeta {
  id: string;
  name: string;
  modifiedTime: string;
  size?: string;
}

interface GisTokenResponse {
  access_token?: string;
  expires_in?: number | string;
  error?: string;
  error_description?: string;
}

interface GisErrorResponse {
  type?: string;
  message?: string;
}

interface GisTokenClient {
  requestAccessToken(overrideConfig?: { prompt?: '' | 'select_account' | 'consent' }): void;
}

interface GoogleAccountsWindow {
  google?: {
    accounts?: {
      oauth2?: {
        initTokenClient(config: {
          client_id: string;
          scope: string;
          callback: (resp: GisTokenResponse) => void;
          error_callback?: (err: GisErrorResponse) => void;
        }): GisTokenClient;
        revoke?(accessToken: string, done?: () => void): void;
      };
    };
  };
}

let gsiLoadPromise: Promise<void> | null = null;

export function getBakedGoogleClientId(): string {
  return (import.meta.env.VITE_GOOGLE_CLIENT_ID || '').trim();
}

export function getGoogleClientId(): string {
  const baked = getBakedGoogleClientId();
  if (baked) return baked;
  try {
    return (localStorage.getItem(CUSTOM_CLIENT_ID_KEY) || '').trim();
  } catch {
    return '';
  }
}

export function saveCustomGoogleClientId(id: string): void {
  try {
    const clean = id.trim();
    if (clean) {
      localStorage.setItem(CUSTOM_CLIENT_ID_KEY, clean);
    } else {
      localStorage.removeItem(CUSTOM_CLIENT_ID_KEY);
    }
  } catch {
    // ignore storage error
  }
}

export function isGoogleDriveConfigured(): boolean {
  return Boolean(getGoogleClientId());
}

export function getGoogleSession(): GoogleSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GoogleSession;
    if (!parsed || typeof parsed.accessToken !== 'string' || !parsed.user?.email) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function saveGoogleSession(session: GoogleSession): void {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // ignore storage error
  }
}

function invalidateStoredToken(): void {
  const session = getGoogleSession();
  if (!session) return;
  saveGoogleSession({ ...session, expiresAt: 0 });
}

export function hasValidGoogleToken(session?: GoogleSession | null): boolean {
  const target = session ?? getGoogleSession();
  if (!target || !target.accessToken) return false;
  return Date.now() < target.expiresAt - 60_000;
}

export function getDriveAutoSync(): boolean {
  try {
    return localStorage.getItem(AUTO_SYNC_KEY) !== '0';
  } catch {
    return true;
  }
}

export function setDriveAutoSync(enabled: boolean): void {
  try {
    localStorage.setItem(AUTO_SYNC_KEY, enabled ? '1' : '0');
  } catch {
    // ignore
  }
}

export function getLastCloudSyncAt(): string | null {
  try {
    return localStorage.getItem(LAST_CLOUD_SYNC_KEY);
  } catch {
    return null;
  }
}

function markLastCloudSyncAt(iso: string): void {
  try {
    localStorage.setItem(LAST_CLOUD_SYNC_KEY, iso);
  } catch {
    // ignore
  }
}

export function loadGsiScript(): Promise<void> {
  const win = window as unknown as GoogleAccountsWindow;
  if (win.google?.accounts?.oauth2) {
    return Promise.resolve();
  }
  if (gsiLoadPromise) return gsiLoadPromise;

  gsiLoadPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src^="https://accounts.google.com/gsi/client"]'
    );
    const timer = window.setTimeout(() => {
      gsiLoadPromise = null;
      reject(new Error('Timeout memuat Google Sign-In. Pastikan internet aktif.'));
    }, 12_000);

    const finish = () => {
      window.clearTimeout(timer);
      if (win.google?.accounts?.oauth2) {
        resolve();
      } else {
        gsiLoadPromise = null;
        reject(new Error('Layanan Google Sign-In tidak tersedia.'));
      }
    };

    const fail = () => {
      window.clearTimeout(timer);
      gsiLoadPromise = null;
      reject(new Error('Gagal memuat Google Sign-In. Pastikan HP terhubung ke internet.'));
    };

    if (existing) {
      existing.addEventListener('load', finish, { once: true });
      existing.addEventListener('error', fail, { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = finish;
    script.onerror = fail;
    document.head.appendChild(script);
  });

  return gsiLoadPromise;
}

async function fetchGoogleProfile(accessToken: string): Promise<GoogleUserProfile> {
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const existing = getGoogleSession();
    if (existing?.user?.email) return existing.user;
    throw new Error('Gagal mengambil profil akun Google.');
  }
  const data = (await res.json()) as {
    name?: string;
    email?: string;
    picture?: string;
  };
  return {
    name: data.name || data.email || 'Pengguna Google',
    email: data.email || '',
    picture: data.picture,
  };
}

export async function signInWithGoogle(options?: {
  prompt?: '' | 'select_account' | 'consent';
}): Promise<GoogleSession> {
  const clientId = getGoogleClientId();
  if (!clientId) {
    throw new Error(
      'Google OAuth Client ID belum dikonfigurasi. Isi Client ID terlebih dahulu.'
    );
  }
  if (!navigator.onLine) {
    throw new Error('Tidak ada koneksi internet untuk login Google.');
  }

  await loadGsiScript();
  const oauth2 = (window as unknown as GoogleAccountsWindow).google?.accounts?.oauth2;
  if (!oauth2) {
    throw new Error('Google Identity Services gagal diinisialisasi.');
  }

  const tokenResp = await new Promise<{ accessToken: string; expiresInSec: number }>(
    (resolve, reject) => {
      let settled = false;
      const client = oauth2.initTokenClient({
        client_id: clientId,
        scope: DRIVE_SCOPES,
        callback: (resp) => {
          if (settled) return;
          settled = true;
          if (resp.error || !resp.access_token) {
            reject(
              new Error(resp.error_description || resp.error || 'Login Google dibatalkan.')
            );
            return;
          }
          resolve({
            accessToken: resp.access_token,
            expiresInSec: Number(resp.expires_in || 3500),
          });
        },
        error_callback: (err) => {
          if (settled) return;
          settled = true;
          reject(
            new Error(
              err?.message ||
                (err?.type === 'popup_closed'
                  ? 'Jendela login Google ditutup.'
                  : 'Popup login Google diblokir atau dibatalkan.')
            )
          );
        },
      });
      client.requestAccessToken({ prompt: options?.prompt ?? 'select_account' });
    }
  );

  const user = await fetchGoogleProfile(tokenResp.accessToken);
  const session: GoogleSession = {
    accessToken: tokenResp.accessToken,
    expiresAt: Date.now() + tokenResp.expiresInSec * 1000,
    user,
  };
  saveGoogleSession(session);
  return session;
}

export async function ensureValidAccessToken(allowPrompt = true): Promise<GoogleSession> {
  const existing = getGoogleSession();
  if (hasValidGoogleToken(existing) && existing) {
    return existing;
  }
  if (!allowPrompt) {
    throw new Error('TOKEN_EXPIRED');
  }
  return signInWithGoogle({ prompt: '' });
}

export function signOutGoogle(): void {
  const session = getGoogleSession();
  try {
    if (session?.accessToken) {
      (window as unknown as GoogleAccountsWindow).google?.accounts?.oauth2?.revoke?.(
        session.accessToken,
        () => {}
      );
    }
  } catch {
    // ignore revoke errors
  }
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore
  }
}

export async function findDriveBackupMeta(
  accessToken: string
): Promise<DriveBackupMeta | null> {
  const q = encodeURIComponent(`name='${DRIVE_BACKUP_FILENAME}' and trashed=false`);
  const url = `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${q}&fields=files(id,name,modifiedTime,size)&orderBy=modifiedTime%20desc&pageSize=5`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (res.status === 401) {
    invalidateStoredToken();
    throw new Error('Sesi Google kedaluwarsa. Silakan login Google ulang.');
  }
  if (!res.ok) {
    throw new Error(`Gagal memeriksa Google Drive (${res.status}).`);
  }
  const data = (await res.json()) as { files?: DriveBackupMeta[] };
  return data.files && data.files.length > 0 ? data.files[0] : null;
}

export async function uploadBackupToDrive(
  progress: UserProgress,
  options?: { silent?: boolean }
): Promise<{ meta: DriveBackupMeta; syncedAt: string }> {
  const session = await ensureValidAccessToken(!options?.silent);
  const content = exportProgressJSON(progress);
  const existing = await findDriveBackupMeta(session.accessToken);

  let res: Response;
  if (existing) {
    res = await fetch(
      `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(existing.id)}?uploadType=media&fields=id,name,modifiedTime,size`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: content,
      }
    );
  } else {
    const boundary = `studypro_${Date.now()}`;
    const metadata = JSON.stringify({
      name: DRIVE_BACKUP_FILENAME,
      parents: ['appDataFolder'],
      mimeType: 'application/json',
    });
    const multipartBody =
      `--${boundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${metadata}\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${content}\r\n` +
      `--${boundary}--`;

    res = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,modifiedTime,size',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body: multipartBody,
      }
    );
  }

  if (res.status === 401) {
    invalidateStoredToken();
    throw new Error('Sesi Google kedaluwarsa. Silakan login Google ulang.');
  }
  if (!res.ok) {
    throw new Error(`Gagal upload backup ke Google Drive (${res.status}).`);
  }

  const meta = (await res.json()) as DriveBackupMeta;
  const syncedAt = meta.modifiedTime || new Date().toISOString();
  markLastCloudSyncAt(syncedAt);
  return { meta, syncedAt };
}

export async function downloadBackupFromDrive(): Promise<{
  raw: string;
  meta: DriveBackupMeta;
} | null> {
  const session = await ensureValidAccessToken(true);
  const meta = await findDriveBackupMeta(session.accessToken);
  if (!meta) return null;

  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(meta.id)}?alt=media`,
    {
      headers: { Authorization: `Bearer ${session.accessToken}` },
    }
  );
  if (res.status === 401) {
    invalidateStoredToken();
    throw new Error('Sesi Google kedaluwarsa. Silakan login Google ulang.');
  }
  if (!res.ok) {
    throw new Error(`Gagal mengunduh backup dari Google Drive (${res.status}).`);
  }
  const raw = await res.text();
  return { raw, meta };
}
