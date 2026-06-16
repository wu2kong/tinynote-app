export async function writeText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
  }
}

export async function readText(): Promise<string | null> {
  if (navigator.clipboard?.readText) {
    return navigator.clipboard.readText();
  }
  return null;
}
