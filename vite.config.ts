import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
import { readFileSync } from 'node:fs';

const host = process.env.TAURI_DEV_HOST;
const pkg = JSON.parse(readFileSync(path.resolve(__dirname, 'package.json'), 'utf8')) as { version: string };

const tauriStub = (file: string) => path.resolve(__dirname, `src/platform/stubs/${file}`);

const webStubs: Record<string, string> = {
  '@tauri-apps/api/core': tauriStub('tauri-core.ts'),
  '@tauri-apps/api/app': tauriStub('tauri-app.ts'),
  '@tauri-apps/api/event': tauriStub('tauri-event.ts'),
  '@tauri-apps/api/path': tauriStub('tauri-path.ts'),
  '@tauri-apps/plugin-fs': tauriStub('tauri-fs.ts'),
  '@tauri-apps/plugin-dialog': tauriStub('tauri-dialog.ts'),
  '@tauri-apps/plugin-clipboard-manager': tauriStub('tauri-clipboard.ts'),
  '@tauri-apps/plugin-opener': tauriStub('tauri-opener.ts'),
};

export default defineConfig(({ mode: viteMode }) => {
  const webBuild = viteMode === 'web';

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
        ...(webBuild ? webStubs : {}),
      },
    },
    define: {
      'import.meta.env.VITE_PLATFORM': JSON.stringify(webBuild ? 'web' : 'tauri'),
      'import.meta.env.VITE_APP_VERSION': JSON.stringify(pkg.version),
    },
    clearScreen: false,
    build: webBuild
      ? {
          outDir: 'dist-web',
          emptyOutDir: true,
          rollupOptions: {
            input: path.resolve(__dirname, 'index-web.html'),
          },
        }
      : undefined,
    ...(webBuild
      ? {
          server: {
            port: 5173,
            strictPort: false,
          },
        }
      : {
          server: {
            port: 1420,
            strictPort: true,
            host: host || false,
            hmr: host
              ? {
                  protocol: 'ws',
                  host,
                  port: 1421,
                }
              : undefined,
            watch: {
              ignored: ['**/src-tauri/**'],
            },
          },
        }),
  };
});
