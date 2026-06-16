export async function getVersion(): Promise<string> {
  return import.meta.env.VITE_APP_VERSION ?? 'web';
}
