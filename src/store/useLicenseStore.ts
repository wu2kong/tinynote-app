import { create } from 'zustand';
import type { ProFeature } from '@/constants/pro';
import type { NotebookFormatId } from '@/types';
import {
  activateLicenseKey,
  computeIsPro,
  deactivateLicenseKey,
  loadStoredLicense,
  saveStoredLicense,
  validateLicenseKey,
  type StoredLicense,
} from '@/utils/license';

export interface GateContext {
  parentPath: string;
  format: NotebookFormatId;
}

interface LicenseState {
  hydrated: boolean;
  isPro: boolean;
  license: StoredLicense | null;
  busy: boolean;
  error: string | null;
  gateOpen: boolean;
  gateFeature: ProFeature | null;
  gateContext: GateContext | null;
  hydrate: () => Promise<void>;
  refreshValidation: () => Promise<void>;
  activate: (licenseKey: string) => Promise<boolean>;
  deactivate: () => Promise<boolean>;
  clearError: () => void;
  openGate: (feature: ProFeature, context?: GateContext | null) => void;
  closeGate: () => void;
  /** Returns true if Pro or free-tier allows the action; otherwise opens gate. */
  requirePro: (feature: ProFeature) => boolean;
}

export const useLicenseStore = create<LicenseState>((set, get) => ({
  hydrated: false,
  isPro: false,
  license: null,
  busy: false,
  error: null,
  gateOpen: false,
  gateFeature: null,
  gateContext: null,

  hydrate: async () => {
    const license = await loadStoredLicense();
    set({
      hydrated: true,
      license,
      isPro: computeIsPro(license),
      error: null,
    });
    if (license?.licenseKey) {
      void get().refreshValidation();
    }
  },

  refreshValidation: async () => {
    const current = get().license;
    if (!current?.licenseKey) return;
    const updated = await validateLicenseKey(current);
    await saveStoredLicense(updated);
    set({
      license: updated,
      isPro: computeIsPro(updated),
    });
  },

  activate: async (licenseKey) => {
    set({ busy: true, error: null });
    try {
      const license = await activateLicenseKey(licenseKey);
      await saveStoredLicense(license);
      set({
        license,
        isPro: true,
        busy: false,
        error: null,
        gateOpen: false,
        gateFeature: null,
        gateContext: null,
      });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'ACTIVATE_FAILED';
      set({ busy: false, error: message });
      return false;
    }
  },

  deactivate: async () => {
    const current = get().license;
    if (!current) return true;
    set({ busy: true, error: null });
    try {
      try {
        await deactivateLicenseKey(current);
      } catch {
        // Still clear local license if remote deactivate fails (e.g. offline).
      }
      await saveStoredLicense(null);
      set({
        license: null,
        isPro: false,
        busy: false,
        error: null,
      });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'DEACTIVATE_FAILED';
      set({ busy: false, error: message });
      return false;
    }
  },

  clearError: () => set({ error: null }),

  openGate: (feature, context = null) => set({
    gateOpen: true,
    gateFeature: feature,
    gateContext: context ?? null,
  }),

  closeGate: () => set({ gateOpen: false, gateFeature: null, gateContext: null }),

  requirePro: (feature) => {
    if (get().isPro) return true;
    set({ gateOpen: true, gateFeature: feature, gateContext: null });
    return false;
  },
}));
