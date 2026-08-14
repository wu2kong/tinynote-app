import { readTextFile, writeTextFile, mkdir, exists, BaseDirectory, remove } from '@tauri-apps/plugin-fs';
import { DODO_API_BASE } from '@/constants/app';
import { LICENSE_OFFLINE_GRACE_DAYS } from '@/constants/pro';
import { isWeb } from '@/platform/detect';

const LICENSE_FILE = '.tinynotes/license.json';
const HOME = BaseDirectory.Home;
const WEB_LICENSE_KEY = 'tinynote.license.v1';

export type LicenseStatus = 'unlicensed' | 'active' | 'expired' | 'invalid';

export interface StoredLicense {
  licenseKey: string;
  instanceId: string | null;
  status: LicenseStatus;
  lastValidatedAt: string | null;
  activatedAt: string | null;
}

export interface LicenseSnapshot {
  license: StoredLicense | null;
  isPro: boolean;
}

const EMPTY_SNAPSHOT: LicenseSnapshot = { license: null, isPro: false };

async function ensureHomeConfigDir(): Promise<void> {
  if (isWeb()) return;
  try {
    if (!(await exists('.tinynotes', { baseDir: HOME }))) {
      await mkdir('.tinynotes', { baseDir: HOME, recursive: true });
    }
  } catch {
    // ignore
  }
}

function isStoredLicense(value: unknown): value is StoredLicense {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return typeof record.licenseKey === 'string'
    && (record.instanceId === null || typeof record.instanceId === 'string')
    && (record.status === 'unlicensed'
      || record.status === 'active'
      || record.status === 'expired'
      || record.status === 'invalid')
    && (record.lastValidatedAt === null || typeof record.lastValidatedAt === 'string')
    && (record.activatedAt === null || typeof record.activatedAt === 'string');
}

function withinGracePeriod(lastValidatedAt: string | null): boolean {
  if (!lastValidatedAt) return false;
  const validated = Date.parse(lastValidatedAt);
  if (Number.isNaN(validated)) return false;
  const graceMs = LICENSE_OFFLINE_GRACE_DAYS * 24 * 60 * 60 * 1000;
  return Date.now() - validated <= graceMs;
}

export function computeIsPro(license: StoredLicense | null): boolean {
  if (!license || !license.licenseKey.trim()) return false;
  if (license.status === 'active') return true;
  if (license.status === 'expired' || license.status === 'invalid') {
    return withinGracePeriod(license.lastValidatedAt);
  }
  return false;
}

export async function loadStoredLicense(): Promise<StoredLicense | null> {
  try {
    if (isWeb()) {
      const raw = localStorage.getItem(WEB_LICENSE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as unknown;
      return isStoredLicense(parsed) ? parsed : null;
    }
    if (!(await exists(LICENSE_FILE, { baseDir: HOME }))) return null;
    const raw = await readTextFile(LICENSE_FILE, { baseDir: HOME });
    const parsed = JSON.parse(raw) as unknown;
    return isStoredLicense(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function saveStoredLicense(license: StoredLicense | null): Promise<void> {
  if (isWeb()) {
    if (!license) {
      localStorage.removeItem(WEB_LICENSE_KEY);
      return;
    }
    localStorage.setItem(WEB_LICENSE_KEY, JSON.stringify(license));
    return;
  }
  await ensureHomeConfigDir();
  if (!license) {
    try {
      if (await exists(LICENSE_FILE, { baseDir: HOME })) {
        await remove(LICENSE_FILE, { baseDir: HOME });
      }
    } catch {
      // ignore
    }
    return;
  }
  await writeTextFile(LICENSE_FILE, JSON.stringify(license, null, 2), {
    baseDir: HOME,
    create: true,
  });
}

export function getDeviceName(): string {
  const platform = typeof navigator !== 'undefined' ? navigator.platform || 'desktop' : 'desktop';
  return `TinyNote / ${platform}`;
}

async function postLicense<T>(path: string, body: Record<string, unknown>): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${DODO_API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error('NETWORK');
  }

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const message = extractErrorMessage(payload) || `HTTP_${response.status}`;
    throw new Error(message);
  }
  return payload as T;
}

function extractErrorMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const record = payload as Record<string, unknown>;
  if (typeof record.message === 'string' && record.message.trim()) return record.message;
  if (typeof record.error === 'string' && record.error.trim()) return record.error;
  if (typeof record.code === 'string' && record.code.trim()) return record.code;
  return null;
}

interface ActivateResponse {
  id?: string;
  license_key_instance_id?: string;
}

interface ValidateResponse {
  valid?: boolean;
}

export async function activateLicenseKey(licenseKey: string): Promise<StoredLicense> {
  const key = licenseKey.trim();
  if (!key) throw new Error('EMPTY_KEY');

  const response = await postLicense<ActivateResponse>('/licenses/activate', {
    license_key: key,
    name: getDeviceName(),
  });

  const instanceId = response.id ?? response.license_key_instance_id ?? null;
  const now = new Date().toISOString();
  return {
    licenseKey: key,
    instanceId,
    status: 'active',
    lastValidatedAt: now,
    activatedAt: now,
  };
}

export async function validateLicenseKey(license: StoredLicense): Promise<StoredLicense> {
  const key = license.licenseKey.trim();
  if (!key) {
    return { ...license, status: 'unlicensed', lastValidatedAt: license.lastValidatedAt };
  }

  try {
    const body: Record<string, unknown> = { license_key: key };
    if (license.instanceId) {
      body.license_key_instance_id = license.instanceId;
    }
    const response = await postLicense<ValidateResponse>('/licenses/validate', body);
    const valid = response.valid === true;
    const now = new Date().toISOString();
    return {
      ...license,
      status: valid ? 'active' : 'expired',
      lastValidatedAt: valid ? now : license.lastValidatedAt,
    };
  } catch (error) {
    if (error instanceof Error && error.message === 'NETWORK') {
      if (license.status === 'active' || withinGracePeriod(license.lastValidatedAt)) {
        return license;
      }
    }
    return {
      ...license,
      status: license.status === 'active' ? 'invalid' : license.status,
    };
  }
}

export async function deactivateLicenseKey(license: StoredLicense): Promise<void> {
  if (!license.licenseKey.trim() || !license.instanceId) return;
  await postLicense('/licenses/deactivate', {
    license_key: license.licenseKey.trim(),
    license_key_instance_id: license.instanceId,
  });
}

export async function loadLicenseSnapshot(): Promise<LicenseSnapshot> {
  const license = await loadStoredLicense();
  return { license, isPro: computeIsPro(license) };
}

export { EMPTY_SNAPSHOT };
