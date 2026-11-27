import { Capacitor } from '@capacitor/core';
import { APP_VERSION, compareVersions } from './updater';

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt(): Promise<void>;
}

export interface PwaState {
  isStandalone: boolean;
  canInstall: boolean;
  installed: boolean;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let installedFlag = false;
let swReg: ServiceWorkerRegistration | undefined;
const subscribers = new Set<(state: PwaState) => void>();

export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}

export function isStandaloneMode(): boolean {
  if (typeof window === 'undefined') return false;
  const standaloneMedia = window.matchMedia?.('(display-mode: standalone)').matches ?? false;
  const iosStandalone = Boolean((navigator as { standalone?: boolean }).standalone);
  return standaloneMedia || iosStandalone || isNativeApp();
}

export function getPwaState(): PwaState {
  const standalone = isStandaloneMode();
  return {
    isStandalone: standalone,
    canInstall: !standalone && deferredPrompt !== null,
    installed: installedFlag || standalone,
  };
}

function notifySubscribers() {
  const snapshot = getPwaState();
  for (const cb of subscribers) cb(snapshot);
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    notifySubscribers();
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    installedFlag = true;
    notifySubscribers();
  });
}

export function subscribePwaState(cb: (state: PwaState) => void): () => void {
  subscribers.add(cb);
  cb(getPwaState());
  return () => {
    subscribers.delete(cb);
  };
}

export async function triggerPwaInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!deferredPrompt) return 'unavailable';
  try {
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    deferredPrompt = null;
    if (outcome === 'accepted') {
      installedFlag = true;
    }
    notifySubscribers();
    return outcome;
  } catch {
    deferredPrompt = null;
    notifySubscribers();
    return 'unavailable';
  }
}

export function setSwRegistration(reg: ServiceWorkerRegistration | undefined): void {
  swReg = reg;
}

export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (navigator.storage?.persist) {
      return await navigator.storage.persist();
    }
  } catch {
    // ignore
  }
  return false;
}

export async function getStorageInfo(): Promise<{
  persisted: boolean;
  usageMb: number | null;
  quotaMb: number | null;
}> {
  let persisted = false;
  let usageMb: number | null = null;
  let quotaMb: number | null = null;
  try {
    if (navigator.storage?.persisted) {
      persisted = await navigator.storage.persisted();
    }
    if (navigator.storage?.estimate) {
      const est = await navigator.storage.estimate();
      if (typeof est.usage === 'number') usageMb = Number((est.usage / (1024 * 1024)).toFixed(1));
      if (typeof est.quota === 'number') quotaMb = Number((est.quota / (1024 * 1024)).toFixed(0));
    }
  } catch {
    // ignore
  }
  return { persisted, usageMb, quotaMb };
}

export async function checkAndApplyPwaUpdate(): Promise<{
  status: 'updated' | 'up_to_date' | 'error';
  message: string;
}> {
  try {
    let hasSwUpdate = false;
    const reg = swReg ?? (await navigator.serviceWorker?.getRegistration());
    if (reg) {
      await reg.update();
      if (reg.waiting || reg.installing) {
        hasSwUpdate = true;
      }
    }

    let hasNewerRemoteVersion = false;
    let remoteVersion = APP_VERSION;
    try {
      const base = import.meta.env.BASE_URL || './';
      const res = await fetch(`${base}version.json?t=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) {
        const meta = (await res.json()) as { version?: string };
        if (meta.version && compareVersions(meta.version, APP_VERSION) > 0) {
          hasNewerRemoteVersion = true;
          remoteVersion = meta.version;
        }
      }
    } catch {
      // ignore network error when checking version.json if SW already checked
    }

    if (hasSwUpdate || hasNewerRemoteVersion) {
      await new Promise((r) => setTimeout(r, 900));
      window.location.reload();
      return {
        status: 'updated',
        message: `Memuat versi terbaru v${remoteVersion}...`,
      };
    }

    return {
      status: 'up_to_date',
      message: `Aplikasi web sudah versi terbaru (v${APP_VERSION}).`,
    };
  } catch {
    return {
      status: 'error',
      message: 'Gagal memeriksa pembaruan. Pastikan internet aktif.',
    };
  }
}
