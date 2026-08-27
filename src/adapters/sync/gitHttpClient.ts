import { invoke } from '@tauri-apps/api/core';
import webHttp from 'isomorphic-git/http/web';
import { isTauri } from '@/platform/detect';

type GitHttpRequest = {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: AsyncIterableIterator<Uint8Array>;
};

type GitHttpResponse = {
  url: string;
  method?: string;
  headers: Record<string, string>;
  body?: AsyncIterableIterator<Uint8Array>;
  statusCode: number;
  statusMessage: string;
};

type GitHttpBinaryResult = {
  url: string;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  bodyBase64: string;
};

function fromValue(value: Uint8Array): AsyncIterableIterator<Uint8Array> {
  let consumed = false;
  return {
    next() {
      if (consumed) {
        return Promise.resolve({ done: true, value: undefined });
      }
      consumed = true;
      return Promise.resolve({ done: false, value });
    },
    return() {
      consumed = true;
      return Promise.resolve({ done: true, value: undefined });
    },
    [Symbol.asyncIterator]() {
      return this;
    },
  };
}

async function collect(iterable?: AsyncIterableIterator<Uint8Array>): Promise<Uint8Array | undefined> {
  if (!iterable) return undefined;
  const chunks: Uint8Array[] = [];
  let size = 0;
  for await (const chunk of iterable) {
    chunks.push(chunk);
    size += chunk.byteLength;
  }
  const result = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}

function bytesToBase64(bytes: Uint8Array): string {
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  if (!value) return new Uint8Array();
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

const tauriGitHttp = {
  async request({
    url,
    method = 'GET',
    headers = {},
    body,
  }: GitHttpRequest): Promise<GitHttpResponse> {
    const payload = await collect(body);
    const result = await invoke<GitHttpBinaryResult>('git_http_binary', {
      method,
      url,
      headers: {
        'User-Agent': 'git/isomorphic-git TinyNote',
        ...headers,
      },
      bodyBase64: payload && payload.byteLength > 0 ? bytesToBase64(payload) : null,
    });
    return {
      url: result.url || url,
      method,
      headers: result.headers ?? {},
      statusCode: result.status,
      statusMessage: result.statusText || '',
      body: fromValue(base64ToBytes(result.bodyBase64 ?? '')),
    };
  },
};

export function getGitHttpClient() {
  return isTauri() ? tauriGitHttp : webHttp;
}
