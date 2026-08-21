import { invoke } from '@tauri-apps/api/core';
import { isTauri } from '@/platform/detect';

export interface GitHttpRequest {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH';
  url: string;
  headers?: Record<string, string>;
  body?: string;
}

export interface GitHttpResponse {
  status: number;
  text: string;
}

const DEFAULT_UA = 'TinyNote-App';

export async function gitHttpRequest(request: GitHttpRequest): Promise<GitHttpResponse> {
  const headers = {
    'User-Agent': DEFAULT_UA,
    ...request.headers,
  };

  if (isTauri()) {
    return invoke<GitHttpResponse>('git_http_request', {
      method: request.method,
      url: request.url,
      headers,
      body: request.body ?? null,
    });
  }

  const response = await fetch(request.url, {
    method: request.method,
    headers,
    body: request.body,
  });
  return {
    status: response.status,
    text: await response.text(),
  };
}

export function parseJsonBody<T>(text: string): T {
  if (!text.trim()) {
    return {} as T;
  }
  return JSON.parse(text) as T;
}
