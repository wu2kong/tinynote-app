export const GITHUB_REPO = 'wu2kong/tinynote-app';
export const HOMEPAGE_URL = 'https://tinynote.wu2kong.com/';
export const DOCS_URL = `${HOMEPAGE_URL}docs`;
export const APP_DESCRIPTION = 'TinyNote - scattered note management';
export const AUTHOR_NAME = '悟二空';
export const AUTHOR_URL = 'https://wu2kong.com';
export const FEEDBACK_EMAIL = 'tinynote-app@wu2kong.com';
export const GITHUB_RELEASES_API = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;
export const GITHUB_APPCAST_URL = `https://github.com/${GITHUB_REPO}/releases/latest/download/appcast.xml`;
/** Qiniu fallback CDN. Public files live under /tinynote/. */
export const QINIU_CDN_BASE =
  (import.meta.env.VITE_QINIU_CDN_BASE as string | undefined)?.replace(/\/+$/, '')
  || 'https://qin.wu2kong.com/tinynote';
export const QINIU_APPCAST_URL = `${QINIU_CDN_BASE}/updates/appcast.xml`;
export const QINIU_LATEST_JSON_URL = `${QINIU_CDN_BASE}/updates/latest.json`;
/** Mirror download page for users who cannot access GitHub or Qiniu. */
export const MIRROR_DOWNLOAD_URL = 'https://www.ilanzou.com/s/B6uXlvhu';

/**
 * Live Dodo product id (Products → Live → copy ID).
 * Keep in sync with landing/js/dodo-config.js
 */
export const DODO_PRODUCT_ID =
  (import.meta.env.VITE_DODO_PRODUCT_ID as string | undefined)?.trim()
  || 'pdt_0NlM2WA3UNj0dcg3HeQvo';

/** Direct Live checkout link (fallback if homepage purchase section is unavailable). */
export const DODO_CHECKOUT_URL =
  (import.meta.env.VITE_DODO_CHECKOUT_URL as string | undefined)?.trim()
  || 'https://checkout.dodopayments.com/buy/pdt_0NlM2WA3UNj0dcg3HeQvo?quantity=1';

/** Pro purchase page on the marketing site. */
export const PURCHASE_URL = `${HOMEPAGE_URL}#pricing`;

/**
 * Dodo Payments public license API host (Live by default).
 * Override with VITE_DODO_API_BASE=https://test.dodopayments.com for local testing.
 */
export const DODO_API_BASE =
  (import.meta.env.VITE_DODO_API_BASE as string | undefined)?.replace(/\/+$/, '')
  || 'https://live.dodopayments.com';
