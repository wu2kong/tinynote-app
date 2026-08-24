import React from 'react';
import { Crown, Loader2, RotateCcw, ShoppingBag } from 'lucide-react';
import {
  APP_STORE_LIFETIME_PRODUCT_ID,
  APP_STORE_SUBSCRIPTION_PRODUCT_IDS,
  type AppStoreProductId,
} from '@/constants/appStoreIap';
import { useLicenseStore } from '@/store/useLicenseStore';
import { useI18n } from '@/i18n/useI18n';
import { showToast } from './Toast';

const FALLBACK_PRICES: Record<AppStoreProductId, string> = {
  'com.wu2kong.tinynote.app.pro.monthly': '¥6 / 月',
  'com.wu2kong.tinynote.app.pro.yearly': '¥68 / 年',
  'com.wu2kong.tinynote.app.pro.lifetime': '¥128',
};

export const AppStorePurchaseControls: React.FC<{ onSuccess?: () => void }> = ({ onSuccess }) => {
  const { t } = useI18n();
  const isPro = useLicenseStore((s) => s.isPro);
  const products = useLicenseStore((s) => s.appStoreProducts);
  const busy = useLicenseStore((s) => s.busy);
  const error = useLicenseStore((s) => s.error);
  const purchaseProduct = useLicenseStore((s) => s.purchaseAppStoreProduct);
  const restorePurchases = useLicenseStore((s) => s.restoreAppStorePurchases);

  const priceFor = (productId: AppStoreProductId) => (
    products.find((product) => product.productId === productId)?.formattedPrice
      ?? FALLBACK_PRICES[productId]
  );

  const handlePurchase = async (productId: AppStoreProductId) => {
    const ok = await purchaseProduct(productId);
    if (ok) {
      showToast(t('pro.store.purchaseComplete'));
      onSuccess?.();
    }
  };

  const handleRestore = async () => {
    const ok = await restorePurchases();
    showToast(t(ok ? 'pro.store.restoreComplete' : 'pro.store.restoreEmpty'));
    if (ok) onSuccess?.();
  };

  if (isPro) {
    return (
      <div className="pro-settings-active">
        <span className="pro-plan-status is-pro">
          <Crown size={15} strokeWidth={2.25} className="pro-plan-crown" />
          <span className="pro-plan-name">{t('pro.store.active')}</span>
        </span>
        <button type="button" className="btn btn-secondary" onClick={() => void handleRestore()} disabled={busy}>
          {busy ? <Loader2 size={14} className="settings-spin" /> : <RotateCcw size={14} />}
          {t('pro.store.restore')}
        </button>
      </div>
    );
  }

  return (
    <div className="pro-activate-form">
      <p className="pro-upgrade-hint">{t('pro.store.hint')}</p>
      <div className="modal-actions pro-upgrade-actions">
        <button type="button" className="btn btn-primary" onClick={() => void handlePurchase(APP_STORE_SUBSCRIPTION_PRODUCT_IDS[0])} disabled={busy}>
          {busy ? <Loader2 size={14} className="settings-spin" /> : <ShoppingBag size={14} />}
          {t('pro.store.monthly', { price: priceFor(APP_STORE_SUBSCRIPTION_PRODUCT_IDS[0]) })}
        </button>
        <button type="button" className="btn btn-primary" onClick={() => void handlePurchase(APP_STORE_SUBSCRIPTION_PRODUCT_IDS[1])} disabled={busy}>
          {busy ? <Loader2 size={14} className="settings-spin" /> : <ShoppingBag size={14} />}
          {t('pro.store.yearly', { price: priceFor(APP_STORE_SUBSCRIPTION_PRODUCT_IDS[1]) })}
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => void handlePurchase(APP_STORE_LIFETIME_PRODUCT_ID)} disabled={busy}>
          {busy ? <Loader2 size={14} className="settings-spin" /> : <Crown size={14} />}
          {t('pro.store.lifetime', { price: priceFor(APP_STORE_LIFETIME_PRODUCT_ID) })}
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => void handleRestore()} disabled={busy}>
          <RotateCcw size={14} />
          {t('pro.store.restore')}
        </button>
      </div>
      {error && <p className="pro-activate-error">{error}</p>}
    </div>
  );
};
