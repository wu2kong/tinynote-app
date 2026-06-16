export async function homeDir(): Promise<string> {
  return '/';
}

export async function join(...paths: string[]): Promise<string> {
  return paths.filter(Boolean).join('/').replace(/\/+/g, '/');
}
