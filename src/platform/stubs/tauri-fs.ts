export enum BaseDirectory {
  Home = 1,
}

export async function readTextFile(_path: string): Promise<string> {
  throw new Error('Tauri fs is not available in web build');
}

export async function writeTextFile(_path: string, _contents: string): Promise<void> {
  throw new Error('Tauri fs is not available in web build');
}

export async function mkdir(_path: string): Promise<void> {
  throw new Error('Tauri fs is not available in web build');
}

export async function exists(_path: string): Promise<boolean> {
  return false;
}

export async function readDir(_path: string): Promise<unknown[]> {
  return [];
}

export async function remove(_path: string): Promise<void> {
  throw new Error('Tauri fs is not available in web build');
}

export async function rename(_oldPath: string, _newPath: string): Promise<void> {
  throw new Error('Tauri fs is not available in web build');
}

export async function stat(_path: string): Promise<{ isFile: boolean; isDirectory: boolean }> {
  throw new Error('Tauri fs is not available in web build');
}
