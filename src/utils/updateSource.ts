/** Keep in sync with scripts/lib/update-sources.mjs. */

export type ForcedUpdateSource = 'auto' | 'qiniu' | 'github';

export function forcedUpdateSource(
  value: string | undefined = import.meta.env.VITE_TINYNOTE_UPDATE_SOURCE,
): ForcedUpdateSource {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'qiniu' || normalized === 'github') return normalized;
  return 'auto';
}

/** GitHub first; Qiniu only when testing or as the fallback list. */
export function updateSourceOrder<T>(
  github: T,
  qiniu: T,
  forced: ForcedUpdateSource = 'auto',
): T[] {
  if (forced === 'qiniu') return [qiniu, github];
  if (forced === 'github') return [github];
  return [github, qiniu];
}
