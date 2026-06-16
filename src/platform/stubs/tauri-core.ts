export async function invoke<T>(_cmd: string, _args?: Record<string, unknown>): Promise<T> {
  throw new Error('Tauri invoke is not available in web build');
}

export const Channel = class {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(_type: string) {}
};

export function transformCallback(_callback: (...args: unknown[]) => unknown, _once?: boolean) {
  return 0;
}
