import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
import { readFileSync } from 'node:fs';

const host = process.env.TAURI_DEV_HOST;
const pkg = JSON.parse(readFileSync(path.resolve(__dirname, 'package.json'), 'utf8')) as { version: string };

const tauriStub = (file: string) => path.resolve(__dirname, `src/platform/stubs/${file}`);

function removeObjectProperty(source: string, marker: string): string {
  const start = source.indexOf(marker);
  if (start < 0) return source;

  const braceStart = source.indexOf('{', start + marker.length - 1);
  let depth = 0;
  let quote = '';
  let escaped = false;
  let end = -1;
  for (let index = braceStart; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === quote) quote = '';
      continue;
    }
    if (character === '"' || character === "'" || character === '`') {
      quote = character;
      continue;
    }
    if (character === '{') depth += 1;
    if (character === '}') {
      depth -= 1;
      if (depth === 0) {
        end = index + 1;
        break;
      }
    }
  }
  if (end < 0) throw new Error(`Could not remove ${marker}`);
  if (source[end] === ',') end += 1;
  if (source[end] === '\n') end += 1;
  return source.slice(0, start) + source.slice(end);
}

function stripAppStoreAiContent() {
  return {
    name: 'strip-app-store-ai-content',
    enforce: 'pre' as const,
    transform(source: string, id: string) {
      const normalizedId = id.replace(/\?.*$/, '').replace(/\\/g, '/');
      if (/\/src\/i18n\/[\w-]+\.ts$/.test(normalizedId)) {
        let transformed = removeObjectProperty(source, '\n    "ai": {');
        transformed = removeObjectProperty(transformed, '\n  "aiChat": {');
        transformed = removeObjectProperty(transformed, '\n    "aiChatSessions": {');
        transformed = transformed
          .replace(/^      "ai":.*\n/m, '')
          .replace(/^      "aiChat":.*\n/m, '');
        return { code: transformed, map: null };
      }
      if (normalizedId.endsWith('/src/utils/configTypes.ts')) {
        return {
          code: source.replace(
            /export const DEFAULT_LLM_PROVIDERS: LLMProviderConfig\[\] = \[[\s\S]*?\n\];/,
            'export const DEFAULT_LLM_PROVIDERS: LLMProviderConfig[] = [];',
          ),
          map: null,
        };
      }
      if (normalizedId.endsWith('/src/utils/officialSampleLibraryLocales.ts')) {
        return { code: source.replaceAll('AI', ''), map: null };
      }
      if (normalizedId.endsWith('/src/utils/officialSampleLibraryContent.ts')) {
        return { code: source.replace('• Cmd/Ctrl + I — open AI chat\n', ''), map: null };
      }
      return null;
    },
  };
}

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
  const macAppStoreBuild = process.env.VITE_DISTRIBUTION === 'mac-app-store';

  return {
    plugins: [
      ...(macAppStoreBuild ? [stripAppStoreAiContent()] : []),
      react(),
      tailwindcss(),
    ],
    resolve: {
      alias: {
        ...(macAppStoreBuild
          ? {
              '@/store/useLicenseStore': path.resolve(__dirname, 'src/store/useLicenseStore.appstore.ts'),
              '@/components/AIChatModal': path.resolve(__dirname, 'src/components/AIChatModal.appstore.tsx'),
              '@/components/AISettings': path.resolve(__dirname, 'src/components/AISettings.appstore.tsx'),
            }
          : {}),
        '@': path.resolve(__dirname, 'src'),
        buffer: path.resolve(__dirname, 'node_modules/buffer'),
        ...(webBuild ? webStubs : {}),
      },
      // Prevent duplicate CodeMirror runtime copies (breaks instanceof / extensions).
      dedupe: [
        '@codemirror/state',
        '@codemirror/view',
        '@codemirror/language',
        '@codemirror/commands',
        '@codemirror/autocomplete',
        '@codemirror/lint',
        '@codemirror/search',
      ],
    },
    optimizeDeps: {
      include: [
        '@uiw/react-codemirror',
        '@codemirror/state',
        '@codemirror/view',
        '@codemirror/language',
        '@codemirror/lang-markdown',
        '@codemirror/lang-json',
        '@codemirror/lang-sql',
        '@codemirror/lang-python',
        '@codemirror/lang-yaml',
        '@codemirror/lang-javascript',
        '@codemirror/lang-html',
        '@codemirror/lang-css',
        '@codemirror/lang-java',
        '@codemirror/lang-rust',
        '@codemirror/lang-go',
        '@codemirror/theme-one-dark',
        '@codemirror/legacy-modes/mode/properties',
        'marked',
        '@milkdown/crepe',
        '@milkdown/react',
        '@milkdown/kit',
        'buffer',
        'isomorphic-git',
      ],
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
