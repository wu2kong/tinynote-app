export const IS_MAC_APP_STORE = import.meta.env.VITE_DISTRIBUTION === 'mac-app-store';

export const IS_MICROSOFT_STORE = import.meta.env.VITE_DISTRIBUTION === 'microsoft-store';
export const USES_STORE_UPDATES = IS_MAC_APP_STORE || IS_MICROSOFT_STORE;
