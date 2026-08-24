import { create } from 'zustand';
import {
  getProducts,
  getProductStatus,
  purchase,
  PurchaseState,
  restorePurchases,
  type Product,
} from '@choochmeque/tauri-plugin-iap-api';
import type { ProFeature } from '@/constants/pro';
import type { NotebookFormatId } from '@/types';
import type { StoredLicense } from '@/utils/license';
import {
  APP_STORE_LIFETIME_PRODUCT_ID,
  APP_STORE_PRODUCT_IDS,
  APP_STORE_SUBSCRIPTION_PRODUCT_IDS,
  type AppStoreProduct,
  type AppStoreProductId,
} from '@/constants/appStoreIap';

export interface GateContext {
  parentPath: string;
  format: NotebookFormatId;
}

interface AppStoreLicenseState {
  hydrated: boolean;
  isPro: boolean;
  license: StoredLicense | null;
  busy: boolean;
  error: string | null;
  gateOpen: boolean;
  gateFeature: ProFeature | null;
  gateContext: GateContext | null;
  appStoreProducts: AppStoreProduct[];
  hydrate: () => Promise<void>;
  refreshValidation: () => Promise<void>;
  activate: (_licenseKey: string) => Promise<boolean>;
  deactivate: () => Promise<boolean>;
  clearError: () => void;
  openGate: (feature: ProFeature, context?: GateContext | null) => void;
  closeGate: () => void;
  purchaseAppStoreProduct: (productId: AppStoreProductId) => Promise<boolean>;
  restoreAppStorePurchases: () => Promise<boolean>;
  requirePro: (feature: ProFeature) => boolean;
}

function toAppStoreProduct(product: Product): AppStoreProduct | null {
  if (!APP_STORE_PRODUCT_IDS.includes(product.productId as AppStoreProductId)) return null;
  return {
    productId: product.productId as AppStoreProductId,
    title: product.title,
    description: product.description,
    formattedPrice: product.formattedPrice,
  };
}

async function refreshStoreEntitlements(set: (state: Partial<AppStoreLicenseState>) => void) {
  const [subscriptionProducts, lifetimeProducts, ...statuses] = await Promise.allSettled([
    getProducts([...APP_STORE_SUBSCRIPTION_PRODUCT_IDS], 'subs'),
    getProducts([APP_STORE_LIFETIME_PRODUCT_ID], 'inapp'),
    ...APP_STORE_SUBSCRIPTION_PRODUCT_IDS.map((productId) => getProductStatus(productId, 'subs')),
    getProductStatus(APP_STORE_LIFETIME_PRODUCT_ID, 'inapp'),
  ]);

  const products = [subscriptionProducts, lifetimeProducts]
    .flatMap((result) => result.status === 'fulfilled' ? result.value.products : [])
    .map(toAppStoreProduct)
    .filter((product): product is AppStoreProduct => product !== null);
  const isPro = statuses.some((result) => (
    result.status === 'fulfilled'
      && result.value.isOwned
      && result.value.purchaseState === PurchaseState.PURCHASED
  ));
  const firstFailure = [subscriptionProducts, lifetimeProducts, ...statuses]
    .find((result) => result.status === 'rejected');

  set({
    hydrated: true,
    isPro,
    license: null,
    appStoreProducts: products,
    error: firstFailure && firstFailure.status === 'rejected'
      ? String(firstFailure.reason)
      : null,
  });
}

/**
 * The Mac App Store build verifies entitlements directly with StoreKit 2.
 * License keys and external checkout are deliberately unavailable here.
 */
export const useLicenseStore = create<AppStoreLicenseState>((set, get) => ({
  hydrated: false,
  isPro: false,
  license: null,
  busy: false,
  error: null,
  gateOpen: false,
  gateFeature: null,
  gateContext: null,
  appStoreProducts: [],
  hydrate: async () => {
    set({ busy: true, error: null });
    try {
      await refreshStoreEntitlements(set);
    } finally {
      set({ busy: false, hydrated: true });
    }
  },
  refreshValidation: async () => {
    set({ busy: true, error: null });
    try {
      await refreshStoreEntitlements(set);
    } finally {
      set({ busy: false, hydrated: true });
    }
  },
  activate: async () => {
    set({ error: 'Mac App Store 版本仅支持 App Store 内购。' });
    return false;
  },
  deactivate: async () => {
    set({ error: '请在 App Store 的订阅管理中管理购买项目。' });
    return false;
  },
  clearError: () => set({ error: null }),
  openGate: (feature, context = null) => set({
    gateOpen: true,
    gateFeature: feature,
    gateContext: context ?? null,
  }),
  closeGate: () => set({ gateOpen: false, gateFeature: null, gateContext: null }),
  purchaseAppStoreProduct: async (productId) => {
    if (get().busy) return false;
    set({ busy: true, error: null });
    try {
      const productType = productId === APP_STORE_LIFETIME_PRODUCT_ID ? 'inapp' : 'subs';
      const result = await purchase(productId, productType);
      if (result.purchaseState !== PurchaseState.PURCHASED) {
        set({ error: '购买尚未完成，请稍后重试。' });
        return false;
      }
      await refreshStoreEntitlements(set);
      if (get().isPro) {
        set({ gateOpen: false, gateFeature: null, gateContext: null });
        return true;
      }
      set({ error: '购买已完成，但权益尚未同步，请稍后点按“恢复购买”。' });
      return false;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error) });
      return false;
    } finally {
      set({ busy: false, hydrated: true });
    }
  },
  restoreAppStorePurchases: async () => {
    if (get().busy) return false;
    set({ busy: true, error: null });
    try {
      await Promise.all([
        restorePurchases('subs'),
        restorePurchases('inapp'),
      ]);
      await refreshStoreEntitlements(set);
      return get().isPro;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error) });
      return false;
    } finally {
      set({ busy: false, hydrated: true });
    }
  },
  requirePro: (feature) => {
    if (get().isPro) return true;
    set({ gateOpen: true, gateFeature: feature, gateContext: null });
    return false;
  },
}));
