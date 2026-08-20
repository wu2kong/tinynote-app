type FlushFn = () => Promise<void> | void;

const flushers = new Set<FlushFn>();

/** Panels with debounced document saves register here so rename/convert can persist first. */
export function registerDocumentSaveFlusher(flush: FlushFn): () => void {
  flushers.add(flush);
  return () => {
    flushers.delete(flush);
  };
}

export async function flushPendingDocumentSaves(): Promise<void> {
  await Promise.all([...flushers].map((flush) => Promise.resolve(flush())));
}
