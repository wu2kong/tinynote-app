import { create } from 'zustand';
import type { ProFeature } from '@/constants/pro';
import type { NotebookFormatId } from '@/types';
import type { StoredLicense } from '@/utils/license';

export interface GateContext {
  parentPath: string;
  format: NotebookFormatId;
}

interface AppStoreLicenseState {
  hydrated: boolean;
  isPro: true;
  license: StoredLicense | null;
  busy: false;
  error: null;
  gateOpen: false;
  gateFeature: ProFeature | null;
  gateContext: GateContext | null;
  hydrate: () => Promise<void>;
  refreshValidation: () => Promise<void>;
  activate: (_licenseKey: string) => Promise<boolean>;
  deactivate: () => Promise<boolean>;
  clearError: () => void;
  openGate: (_feature: ProFeature, _context?: GateContext | null) => void;
  closeGate: () => void;
  requirePro: (_feature: ProFeature) => boolean;
}

/**
 * The Mac App Store build is sold as a complete product. It never contacts the
 * external license service and never exposes license-key or purchase flows.
 */
export const useLicenseStore = create<AppStoreLicenseState>((set) => ({
  hydrated: true,
  isPro: true,
  license: null,
  busy: false,
  error: null,
  gateOpen: false,
  gateFeature: null,
  gateContext: null,
  hydrate: async () => {
    set({ hydrated: true, isPro: true });
  },
  refreshValidation: async () => {},
  activate: async () => true,
  deactivate: async () => true,
  clearError: () => {},
  openGate: () => {},
  closeGate: () => {},
  requirePro: () => true,
}));

