export async function open(_options?: unknown): Promise<string | string[] | null> {
  return null;
}

export async function save(_options?: unknown): Promise<string | null> {
  return null;
}

export async function message(_message: string): Promise<void> {
  window.alert(_message);
}

export async function ask(_message: string): Promise<boolean> {
  return window.confirm(_message);
}
