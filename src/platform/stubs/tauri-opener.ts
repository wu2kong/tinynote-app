export async function openUrl(url: string): Promise<void> {
  window.open(url, '_blank', 'noopener,noreferrer');
}

export async function openPath(_path: string): Promise<void> {
  console.warn('[tinynote-web] openPath is not supported');
}

export async function revealItemInDir(_path: string): Promise<void> {
  console.warn('[tinynote-web] revealItemInDir is not supported');
}
