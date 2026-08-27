import { Buffer } from 'buffer';

type BufferGlobals = typeof globalThis & { Buffer: typeof Buffer };

// isomorphic-git 把 Buffer 当全局变量用；Safari / Tauri WKWebView 没有 Node Buffer。
(globalThis as BufferGlobals).Buffer = Buffer;
