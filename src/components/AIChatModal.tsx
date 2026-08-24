import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, ArrowDown, Bot, Check, ChevronDown, Copy, Minus, RefreshCw, Search, Send, Square, SquarePen, Trash2, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import hljs from 'highlight.js';
import { Channel, invoke } from '@tauri-apps/api/core';
import { loadConfig } from '@/utils/config';
import type { LLMProviderConfig } from '@/utils/configTypes';
import { customLLMProviderOrdinal, isCustomLLMProviderId } from '@/utils/configTypes';
import { isTauri } from '@/platform/detect';
import { deleteChatSession, listChatSessions, saveChatSession } from '@/utils/aiChatSessions';
import type { ChatMessage, ChatSession } from '@/utils/aiChatSessions';
import ConfirmModal from './ConfirmModal';
import { showToast } from './Toast';
import { useI18n } from '@/i18n/useI18n';
import type { I18nParams } from '@/i18n';

interface AIChatModalProps {
  open: boolean;
  onClose: () => void;
}

const createId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;

function llmProviderGroupTitle(
  provider: LLMProviderConfig,
  providers: LLMProviderConfig[],
  translate: (key: string, params?: I18nParams) => string,
): string {
  if (!isCustomLLMProviderId(provider.id)) return provider.id;
  const ordinal = customLLMProviderOrdinal(providers, provider.id);
  return ordinal > 1 ? translate('settings.ai.customProviderN', { n: ordinal }) : translate('settings.ai.customProvider');
}

const PANEL_SIZE_STORAGE_KEY = 'tinynote-ai-chat-size';
const MIN_PANEL_WIDTH = 380;
const MIN_PANEL_HEIGHT = 300;
const STREAM_SAVE_INTERVAL = 3000;

function clampPanelSize(width: number, height: number): { width: number; height: number } {
  return {
    width: Math.round(Math.min(Math.max(width, MIN_PANEL_WIDTH), window.innerWidth - 16)),
    height: Math.round(Math.min(Math.max(height, MIN_PANEL_HEIGHT), window.innerHeight - 16)),
  };
}

function loadStoredPanelSize(): { width: number; height: number } | null {
  try {
    const raw = window.localStorage.getItem(PANEL_SIZE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { width?: unknown; height?: unknown };
    if (typeof parsed.width === 'number' && typeof parsed.height === 'number') {
      return clampPanelSize(parsed.width, parsed.height);
    }
  } catch { /* 忽略损坏的缓存 */ }
  return null;
}

type Translate = (key: string, params?: I18nParams) => string;

function formatAIError(error: unknown, translate: Translate): string {
  if (typeof error === 'string' && error.trim()) return error;
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') return error.message;
  return translate('aiChat.requestFailed');
}

function formatHistoryTime(ts: number, translate: Translate): string {
  const date = new Date(ts);
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  const time = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  if (date.toDateString() === now.toDateString()) return time;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return translate('aiChat.yesterday', { time });
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** 请求耗时展示：<10s → X.X秒，>=10s → X秒，>=60s → X分Y秒；两端时间戳齐全才返回。 */
function formatDuration(startedAt: number | undefined, completedAt: number | undefined, translate: Translate): string | null {
  if (typeof startedAt !== 'number' || typeof completedAt !== 'number') return null;
  const seconds = (completedAt - startedAt) / 1000;
  if (!Number.isFinite(seconds) || seconds < 0) return null;
  if (seconds < 10) return translate('aiChat.durationSecondsPrecise', { seconds: seconds.toFixed(1) });
  if (seconds < 60) return translate('aiChat.durationSeconds', { seconds: Math.round(seconds) });
  return translate('aiChat.durationMinutes', { minutes: Math.floor(seconds / 60), seconds: Math.round(seconds % 60) });
}

/** `YYYY-MM-DD HH:mm:ss`，用于元数据行的悬浮提示。 */
function formatDateTime(ts: number): string {
  const date = new Date(ts);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

const MarkdownCode: React.FC<React.ComponentPropsWithoutRef<'code'>> = ({ className, children, ...props }) => {
  const source = String(children).replace(/\n$/, '');
  const language = /language-([\w-]+)/.exec(className ?? '')?.[1];
  const isBlock = Boolean(language) || source.includes('\n');
  if (!isBlock) return <code className={className} {...props}>{children}</code>;

  const highlighted = language && hljs.getLanguage(language)
    ? hljs.highlight(source, { language }).value
    : hljs.highlightAuto(source).value;
  return <code className={`hljs${language ? ` language-${language}` : ''}`} dangerouslySetInnerHTML={{ __html: highlighted }} />;
};

const createSession = (title: string): ChatSession => ({
  id: createId(),
  title,
  messages: [],
  createdAt: Date.now(),
  updatedAt: Date.now(),
});

function selectProvider(providers: LLMProviderConfig[]): LLMProviderConfig | undefined {
  return providers.find((provider) => provider.enabled && provider.baseUrl.trim() && provider.apiKey?.trim());
}

function getProviderModel(provider: LLMProviderConfig): string {
  return provider.models?.find((model) => model.enabled)?.id ?? provider.model.trim();
}

async function requestCompletionStream(
  requestId: string,
  provider: LLMProviderConfig,
  model: string,
  messages: ChatMessage[],
  onDelta: (delta: string) => void,
  translate: Translate,
  signal?: AbortSignal,
): Promise<void> {
  if (!model) throw new Error(translate('aiChat.enableModelFirst'));
  const useResponsesApi = provider.id === 'opencode-zen' && model.startsWith('gpt-');
  const requestMessages = messages.map(({ role, content }) => ({ role, content }));

  if (isTauri()) {
    const onEvent = new Channel<{ kind: 'delta' | 'done'; content: string }>((event) => {
      if (event.kind === 'delta') onDelta(event.content);
    });
    await invoke('chat_with_llm_stream', {
      requestId, baseUrl: provider.baseUrl.trim(), apiKey: provider.apiKey, model, messages: requestMessages, useResponsesApi, onEvent,
    });
    return;
  }

  const path = useResponsesApi ? 'responses' : 'chat/completions';
  const response = await fetch(`${provider.baseUrl.trim().replace(/\/+$/, '')}/${path}`, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      ...(provider.apiKey?.trim() ? { Authorization: `Bearer ${provider.apiKey.trim()}` } : {}),
    },
    body: JSON.stringify(useResponsesApi ? { model, input: requestMessages, stream: true } : { model, messages: requestMessages, stream: true }),
  });
  if (!response.ok) throw new Error(`${translate('aiChat.requestFailed')} (HTTP ${response.status})`);
  if (!response.body) throw new Error(translate('aiChat.streamUnsupported'));
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let pending = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    pending += decoder.decode(value, { stream: true });
    const lines = pending.split('\n');
    pending = lines.pop() ?? '';
    for (const line of lines) {
      const data = line.trim().replace(/^data:\s*/, '');
      if (!data || data === '[DONE]') continue;
      try {
        const payload = JSON.parse(data) as { delta?: string; choices?: Array<{ delta?: { content?: string } }> };
        const delta = payload.choices?.[0]?.delta?.content ?? payload.delta;
        if (delta) onDelta(delta);
      } catch { /* Ignore SSE event lines that do not contain a delta. */ }
    }
  }
}

const AIChatModal: React.FC<AIChatModalProps> = ({ open, onClose }) => {
  const { t } = useI18n();
  const [sessions, setSessions] = useState<ChatSession[]>(() => [createSession(t('aiChat.chatTitle'))]);
  const [activeSessionId, setActiveSessionId] = useState(() => sessions[0].id);
  const [input, setInput] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [thinkingSeconds, setThinkingSeconds] = useState(0);
  const [providers, setProviders] = useState<LLMProviderConfig[]>([]);
  const [selectedModel, setSelectedModel] = useState<{ providerId: string; model: string } | null>(null);
  const [showModels, setShowModels] = useState(false);
  const [modelSearch, setModelSearch] = useState('');
  const [panelPosition, setPanelPosition] = useState<{ left: number; top: number } | null>(null);
  const [panelSize, setPanelSize] = useState<{ width: number; height: number } | null>(() => loadStoredPanelSize());
  const [isPointerDown, setIsPointerDown] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [atBottom, setAtBottom] = useState(true);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [sessionErrors, setSessionErrors] = useState<Record<string, string>>({});
  const [pendingDelete, setPendingDelete] = useState<ChatSession | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const dragStartRef = useRef<{ x: number; y: number; left: number; top: number; activated: boolean } | null>(null);
  const resizeStartRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null);
  const currentRequestRef = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isComposingRef = useRef(false);
  const atBottomRef = useRef(true);
  const sessionsRef = useRef<ChatSession[]>(sessions);
  const panelSizeRef = useRef(panelSize);
  const loadedRef = useRef(false);
  const lastStreamSaveRef = useRef(0);
  const streamDirtyRef = useRef(false);
  const chatActiveRef = useRef(true);

  const activeSession = useMemo(
    () => sessions.find((session) => session.id === activeSessionId) ?? sessions[0],
    [activeSessionId, sessions],
  );

  const filteredProviders = useMemo(() => providers.map((provider) => ({
    provider,
    models: getEnabledModels(provider).filter((model) => model.toLowerCase().includes(modelSearch.trim().toLowerCase())),
  })).filter(({ models }) => models.length > 0), [modelSearch, providers]);

  const activeModelLabel = selectedModel?.model ?? t('aiChat.chooseModel');
  const canCreateSession = !isSending && Boolean(activeSession) && activeSession.messages.length > 0;
  const activeError = activeSession ? sessionErrors[activeSession.id] : undefined;

  useEffect(() => {
    sessionsRef.current = sessions;
  }, [sessions]);

  // 挂载时从工作区加载一次历史会话（StrictMode 双挂载守卫）
  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    void listChatSessions().then((loaded) => {
      if (loaded.length === 0) return; // 保留内存中的新会话，不落盘
      setSessions(loaded);
      setActiveSessionId(loaded[0].id);
    });
  }, []);

  useEffect(() => {
    if (open) {
      chatActiveRef.current = true;
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // 跟踪最后一次指针交互是否在弹窗内；点击弹窗外部时收起浮层
  // （capture 阶段监听，不阻断事件，底层笔记 UI 正常响应）
  // 思考中实时计时
  useEffect(() => {
    if (!isSending) {
      setThinkingSeconds(0);
      return;
    }
    const interval = setInterval(() => {
      setThinkingSeconds(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isSending]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      const inside = Boolean((event.target as HTMLElement).closest('.ai-chat-modal, .modal-overlay'));
      chatActiveRef.current = inside;
      if (!inside) { setShowHistory(false); setShowModels(false); }
    };
    document.addEventListener('pointerdown', handlePointerDown, true);
    return () => document.removeEventListener('pointerdown', handlePointerDown, true);
  }, [open]);

  useEffect(() => {
    const textarea = inputRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    const lineHeight = Number.parseFloat(window.getComputedStyle(textarea).lineHeight) || 20;
    const maxHeight = lineHeight * 6 + 8;
    textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
    textarea.style.overflowY = textarea.scrollHeight > maxHeight ? 'auto' : 'hidden';
  }, [input]);

  useEffect(() => {
    if (!open) return;
    void loadConfig().then((config) => {
      const enabledProviders = config.llmProviders.filter((provider) => (
        provider.enabled && provider.baseUrl.trim() && provider.apiKey?.trim()
      ));
      setProviders(enabledProviders);
      setSelectedModel((current) => {
        if (current && enabledProviders.some((provider) => provider.id === current.providerId && getEnabledModels(provider).includes(current.model))) return current;
        const provider = selectProvider(enabledProviders);
        return provider ? { providerId: provider.id, model: getProviderModel(provider) } : null;
      });
    });
  }, [open]);

  const stopGeneration = useCallback(() => {
    const requestId = currentRequestRef.current;
    if (!requestId) return;
    currentRequestRef.current = null;
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setIsSending(false);
    if (isTauri()) void invoke('stop_llm_generation', { requestId });
  }, []);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (!chatActiveRef.current) return;
      event.preventDefault();
      if (showModels) { setShowModels(false); return; }
      if (showHistory) { setShowHistory(false); return; }
      if (pendingDelete) { setPendingDelete(null); return; }
      if (currentRequestRef.current) { stopGeneration(); return; }
      onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose, open, pendingDelete, showHistory, showModels, stopGeneration]);

  useEffect(() => {
    if (!isPointerDown) return;
    const handleMove = (event: PointerEvent) => {
      const dragStart = dragStartRef.current;
      const panel = panelRef.current;
      if (!dragStart || !panel) return;
      const deltaX = event.clientX - dragStart.x;
      const deltaY = event.clientY - dragStart.y;
      if (!dragStart.activated) {
        if (Math.hypot(deltaX, deltaY) < 5) return;
        dragStart.activated = true;
        setPanelPosition({ left: dragStart.left, top: dragStart.top });
        setIsDragging(true);
      }
      const maxLeft = Math.max(8, window.innerWidth - panel.offsetWidth - 8);
      const maxTop = Math.max(8, window.innerHeight - panel.offsetHeight - 8);
      setPanelPosition({
        left: Math.round(Math.min(maxLeft, Math.max(8, dragStart.left + deltaX))),
        top: Math.round(Math.min(maxTop, Math.max(8, dragStart.top + deltaY))),
      });
    };
    const handleUp = () => {
      setIsPointerDown(false);
      setIsDragging(false);
      dragStartRef.current = null;
    };
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
  }, [isPointerDown]);

  useEffect(() => {
    if (!isResizing) return;
    const handleMove = (event: PointerEvent) => {
      const resizeStart = resizeStartRef.current;
      if (!resizeStart) return;
      const next = clampPanelSize(
        resizeStart.width + (event.clientX - resizeStart.x),
        resizeStart.height + (event.clientY - resizeStart.y),
      );
      panelSizeRef.current = next;
      setPanelSize(next);
    };
    const handleUp = () => {
      setIsResizing(false);
      resizeStartRef.current = null;
      const size = panelSizeRef.current;
      if (size) {
        try {
          window.localStorage.setItem(PANEL_SIZE_STORAGE_KEY, JSON.stringify(size));
        } catch { /* 忽略写入失败 */ }
      }
    };
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
  }, [isResizing]);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'auto') => {
    const container = messagesRef.current;
    if (!container) return;
    atBottomRef.current = true;
    setAtBottom(true);
    container.scrollTo({ top: container.scrollHeight, behavior });
  }, []);

  const handleMessagesScroll = useCallback(() => {
    const container = messagesRef.current;
    if (!container) return;
    const next = container.scrollHeight - container.scrollTop - container.clientHeight < 80;
    atBottomRef.current = next;
    setAtBottom(next);
  }, []);

  // 消息更新时：仅当用户本来就在底部时才跟随滚动
  useEffect(() => {
    if (atBottomRef.current) {
      messagesRef.current?.scrollTo({ top: messagesRef.current.scrollHeight });
    }
  }, [activeSession?.messages]);

  // 切换会话 / 打开弹窗时强制回到底部
  useEffect(() => {
    if (!open) return;
    scrollToBottom();
  }, [activeSessionId, open, scrollToBottom]);

  const clearSessionError = useCallback((sessionId: string) => {
    setSessionErrors((current) => {
      if (!(sessionId in current)) return current;
      const next = { ...current };
      delete next[sessionId];
      return next;
    });
  }, []);

  const persistSession = useCallback((session: ChatSession) => {
    if (session.messages.length === 0) return;
    void saveChatSession(session).then((filePath) => {
      if (!filePath) return;
      setSessions((current) => current.map((item) => (
        item.id === session.id && item.filePath !== filePath ? { ...item, filePath } : item
      )));
    }).catch((error) => {
      console.warn('[ai-chat] Failed to save session:', error);
    });
  }, []);

  const requestAssistantReply = useCallback(async (sessionId: string, baseMessages: ChatMessage[]) => {
    if (currentRequestRef.current) return;
    const requestId = createId();
    const abortController = new AbortController();
    currentRequestRef.current = requestId;
    abortControllerRef.current = abortController;
    setIsSending(true);
    clearSessionError(sessionId);

    const assistantMessage: ChatMessage = { id: createId(), role: 'assistant', content: '' };
    const messages: ChatMessage[] = [...baseMessages, assistantMessage];
    let assistantContent = '';
    lastStreamSaveRef.current = Date.now();
    streamDirtyRef.current = false;

    setSessions((current) => current.map((session) => (session.id === sessionId ? {
      ...session,
      messages: [...messages],
      updatedAt: Date.now(),
    } : session)));

    const persist = () => {
      const base = sessionsRef.current.find((session) => session.id === sessionId);
      if (!base) return;
      persistSession({
        ...base,
        messages: messages.map((message) => (message.id === assistantMessage.id
          ? { ...message, content: assistantContent }
          : { ...message })),
        updatedAt: Date.now(),
      });
    };

    try {
      const config = await loadConfig();
      const provider = selectedModel
        ? config.llmProviders.find((item) => item.id === selectedModel.providerId && item.enabled)
        : selectProvider(config.llmProviders);
      if (!provider) throw new Error(t('aiChat.enableProviderFirst'));
      const model = selectedModel?.model ?? getProviderModel(provider);
      assistantMessage.model = model;
      assistantMessage.startedAt = Date.now();
      setSessions((current) => current.map((session) => (session.id === sessionId ? {
        ...session,
        messages: session.messages.map((msg) => msg.id === assistantMessage.id ? { ...msg, model, startedAt: assistantMessage.startedAt } : msg),
        updatedAt: Date.now(),
      } : session)));
      await requestCompletionStream(requestId, provider, model, baseMessages, (delta) => {
        if (currentRequestRef.current !== requestId) return;
        assistantContent += delta;
        streamDirtyRef.current = true;
        setSessions((current) => current.map((session) => (session.id === sessionId ? {
          ...session,
          messages: session.messages.map((message) => (message.id === assistantMessage.id ? {
            ...message,
            content: message.content + delta,
          } : message)),
          updatedAt: Date.now(),
        } : session)));
        const now = Date.now();
        if (streamDirtyRef.current && now - lastStreamSaveRef.current >= STREAM_SAVE_INTERVAL) {
          lastStreamSaveRef.current = now;
          streamDirtyRef.current = false;
          persist(); // 流式期间节流落盘
        }
      }, t, abortController.signal);
    } catch (error) {
      if (currentRequestRef.current === requestId) {
        const message = formatAIError(error, t);
        showToast(message);
        setSessionErrors((current) => ({ ...current, [sessionId]: message }));
      }
    } finally {
      if (currentRequestRef.current === requestId) {
        currentRequestRef.current = null;
        abortControllerRef.current = null;
        setIsSending(false);
      }
      if (assistantContent) {
        assistantMessage.completedAt = Date.now();
        setSessions((current) => current.map((session) => (session.id === sessionId ? {
          ...session,
          messages: session.messages.map((msg) => msg.id === assistantMessage.id ? { ...msg, completedAt: Date.now() } : msg),
          updatedAt: Date.now(),
        } : session)));
        persist(); // 正常结束 / 手动停止 / 失败时把已有内容落盘
      } else {
        // 移除空的 assistant 占位气泡
        setSessions((current) => current.map((session) => (session.id === sessionId ? {
          ...session,
          messages: session.messages.filter((message) => message.id !== assistantMessage.id),
        } : session)));
      }
    }
  }, [clearSessionError, persistSession, selectedModel, t]);

  const sendMessage = () => {
    const content = input.trim();
    if (!content || isSending || !activeSession) return;
    const userMessage: ChatMessage = { id: createId(), role: 'user', content };
    const sessionId = activeSession.id;
    const nextSession: ChatSession = {
      ...activeSession,
      title: activeSession.messages.length === 0 ? content.slice(0, 24) : activeSession.title,
      messages: [...activeSession.messages, userMessage],
      updatedAt: Date.now(),
    };
    setInput('');
    setSessions((current) => current.map((session) => (session.id === sessionId ? nextSession : session)));
    persistSession(nextSession); // 发送后立即落盘
    atBottomRef.current = true;
    setAtBottom(true);
    void requestAssistantReply(sessionId, nextSession.messages);
  };

  const retryFailedRequest = (sessionId: string) => {
    if (isSending) return;
    const session = sessionsRef.current.find((item) => item.id === sessionId);
    if (!session) return;
    let end = session.messages.length;
    while (end > 0 && session.messages[end - 1].role !== 'user') end -= 1;
    if (end === 0) {
      clearSessionError(sessionId);
      return;
    }
    void requestAssistantReply(sessionId, session.messages.slice(0, end));
  };

  const regenerateMessage = (messageId: string) => {
    if (isSending || !activeSession) return;
    const index = activeSession.messages.findIndex((message) => message.id === messageId);
    if (index <= 0) return;
    void requestAssistantReply(activeSession.id, activeSession.messages.slice(0, index));
  };

  const copyMessage = async (message: ChatMessage) => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopiedMessageId(message.id);
      window.setTimeout(() => {
        setCopiedMessageId((current) => (current === message.id ? null : current));
      }, 1500);
    } catch {
      showToast(t('aiChat.copyFailed'));
    }
  };

  const createNewSession = () => {
    if (!canCreateSession) return;
    const session = createSession(t('aiChat.chatTitle'));
    setSessions((current) => [session, ...current]);
    setActiveSessionId(session.id);
    setShowHistory(false);
  };

  const confirmDeleteSession = () => {
    if (!pendingDelete) return;
    const target = pendingDelete;
    if (target.filePath) void deleteChatSession(target.filePath);
    clearSessionError(target.id);
    const remaining = sessionsRef.current.filter((session) => session.id !== target.id);
    const nextSessions = remaining.length > 0 ? remaining : [createSession(t('aiChat.chatTitle'))];
    sessionsRef.current = nextSessions;
    setSessions(nextSessions);
    if (target.id === activeSessionId) setActiveSessionId(nextSessions[0].id);
  };

  const panelStyle: React.CSSProperties = {
    ...(panelPosition ? { position: 'fixed', left: panelPosition.left, top: panelPosition.top, transform: 'none' } : {}),
    ...(panelSize ? { width: panelSize.width, height: panelSize.height } : {}),
  };

  return (
    <div
      className={`ai-chat-overlay ${open ? 'open' : ''}`}
      aria-hidden={!open}
    >
      <section
        ref={panelRef}
        className={`ai-chat-modal ${isDragging ? 'dragging' : ''}`}
        style={panelStyle}
        aria-label={t('aiChat.ariaLabel')}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="ai-chat-header" onPointerDown={(event) => {
          if ((event.target as HTMLElement).closest('button, input, textarea')) return;
          setShowHistory(false);
          setShowModels(false);
          const bounds = panelRef.current?.getBoundingClientRect();
          if (!bounds) return;
          const left = Math.round(bounds.left);
          const top = Math.round(bounds.top);
          dragStartRef.current = { x: event.clientX, y: event.clientY, left, top, activated: false };
          setIsPointerDown(true);
        }}>
          <div className="ai-chat-header-leading">
            <button
              type="button"
              className="ai-chat-icon-btn"
              onClick={createNewSession}
              disabled={!canCreateSession}
              title={canCreateSession ? t('aiChat.newChat') : t('aiChat.blankChat')}
            >
              <SquarePen size={16} />
            </button>
            <button type="button" className={`ai-chat-session-trigger ${showHistory ? 'open' : ''}`} onClick={() => setShowHistory((value) => !value)}>
              <span>{activeSession?.title || t('aiChat.chatTitle')}</span><ChevronDown size={16} />
            </button>
          </div>
          <div className="ai-chat-header-actions">
            <button type="button" className="ai-chat-icon-btn" onClick={onClose} title={t('common.close')}><Minus size={18} /></button>
          </div>
        </header>

        <div className="ai-chat-body">
          {showHistory && (
            <aside className="ai-chat-history">
              <div className="ai-chat-history-title">{t('aiChat.history')}</div>
              {sessions.slice().sort((a, b) => b.updatedAt - a.updatedAt).map((session) => (
                <div className={`ai-chat-history-item ${session.id === activeSession?.id ? 'active' : ''}`} key={session.id}>
                  <button type="button" onClick={() => { setActiveSessionId(session.id); setShowHistory(false); }}>
                    <span className="ai-chat-history-name">{session.title}</span>
                    <span className="ai-chat-history-time">{formatHistoryTime(session.updatedAt, t)}</span>
                  </button>
                  <button type="button" className="ai-chat-history-delete" onClick={() => setPendingDelete(session)} title={t('aiChat.deleteSession')}><Trash2 size={14} /></button>
                </div>
              ))}
            </aside>
          )}

          <div className="ai-chat-main" onClick={() => { setShowHistory(false); setShowModels(false); }}>
            <div className="ai-chat-messages-wrap">
              <div className="ai-chat-messages" ref={messagesRef} onScroll={handleMessagesScroll}>
                {activeSession?.messages.length === 0 ? (
                  <div className="ai-chat-empty"><Bot size={30} /><p>{t('aiChat.emptyTitle')}</p><span>{t('aiChat.emptyDesc')}</span></div>
                ) : activeSession?.messages.map((message, index) => {
                  const isLast = index === activeSession.messages.length - 1;
                  const isStreamingThis = isSending && message.role === 'assistant' && isLast;
                  return (
                    <div className={`ai-chat-message ${message.role}`} key={message.id}>
                      <div className={message.role === 'assistant' ? 'ai-chat-markdown' : undefined}>
                        {message.role === 'assistant'
                          ? <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ code: MarkdownCode }}>{message.content}</ReactMarkdown>
                          : message.content}
                        {isStreamingThis && (message.content.length === 0 ? (
                          <span className="ai-thinking" aria-label={t('aiChat.thinking', { seconds: thinkingSeconds })}>{t('aiChat.thinking', { seconds: thinkingSeconds })}</span>
                        ) : (
                          <span className="ai-stream-cursor" aria-label={t('aiChat.generating')} />
                        ))}
                        {message.role === 'assistant' && !isStreamingThis && (
                          <div className="ai-chat-message-footer">
                            <div className="ai-chat-message-actions">
                              <button type="button" onClick={() => void copyMessage(message)} title={t('aiChat.copy')}>
                                {copiedMessageId === message.id ? <Check size={13} className="copied" /> : <Copy size={13} />}
                              </button>
                              {isLast && (
                                <button type="button" onClick={() => regenerateMessage(message.id)} title={t('aiChat.regenerate')}>
                                  <RefreshCw size={13} />
                                </button>
                              )}
                            </div>
                            {message.content && (message.model || formatDuration(message.startedAt, message.completedAt, t)) && (
                              <div
                                className="ai-chat-message-meta"
                                title={message.startedAt && message.completedAt ? `${formatDateTime(message.startedAt)} → ${formatDateTime(message.completedAt)}` : undefined}
                              >
                                {message.model && <span className="ai-chat-meta-model">{message.model}</span>}
                                {message.model && formatDuration(message.startedAt, message.completedAt, t) && <span className="ai-chat-meta-sep">·</span>}
                                {formatDuration(message.startedAt, message.completedAt, t) && <span className="ai-chat-meta-duration">{formatDuration(message.startedAt, message.completedAt, t)}</span>}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                {activeError && activeSession && (
                  <div className="ai-chat-error">
                    <AlertCircle size={14} />
                    <span>{activeError}</span>
                    <button type="button" className="ai-chat-error-retry" onClick={() => retryFailedRequest(activeSession.id)}>{t('common.retry')}</button>
                    <button type="button" className="ai-chat-error-close" onClick={() => clearSessionError(activeSession.id)} title={t('common.close')}><X size={12} /></button>
                  </div>
                )}
              </div>
              {!atBottom && (
                <button type="button" className="ai-chat-scroll-bottom" onClick={() => scrollToBottom('smooth')}>
                  <ArrowDown size={12} /> {t('aiChat.backToBottom')}
                </button>
              )}
            </div>
            <div className="ai-chat-composer">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onCompositionStart={() => { isComposingRef.current = true; }}
                onCompositionEnd={() => { isComposingRef.current = false; }}
                placeholder={t('aiChat.placeholder')}
                onKeyDown={(event) => {
                  const isComposing = isComposingRef.current || event.nativeEvent.isComposing || event.keyCode === 229;
                  if (event.key === 'Enter' && !event.shiftKey && !isComposing) {
                    event.preventDefault();
                    sendMessage();
                  }
                }}
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
              />
              <div className="ai-chat-composer-footer">
                <button type="button" className="ai-chat-model-trigger" onClick={(event) => { event.stopPropagation(); setShowModels((value) => !value); }}>
                  {activeModelLabel}<ChevronDown size={14} />
                </button>
                {isSending ? (
                  <button type="button" className="btn ai-chat-stop" onClick={stopGeneration} title={t('aiChat.stop')} aria-label={t('aiChat.stop')}><Square size={12} fill="currentColor" /></button>
                ) : (
                  <button type="button" className="btn btn-primary ai-chat-send" disabled={!input.trim()} onClick={sendMessage} title={t('aiChat.send')}><Send size={16} /></button>
                )}
              </div>
              {showModels && (
                <div className="ai-chat-model-menu" onClick={(event) => event.stopPropagation()}>
                  <div className="ai-chat-model-search"><Search size={16} /><input autoFocus value={modelSearch} onChange={(event) => setModelSearch(event.target.value)} placeholder={t('aiChat.searchModel')} autoCorrect="off" autoCapitalize="off" spellCheck={false} /></div>
                  <div className="ai-chat-model-options">
                    {filteredProviders.length === 0 ? <div className="ai-chat-model-none">{t('aiChat.noModels')}</div> : filteredProviders.map(({ provider, models }) => (
                      <div className="ai-chat-model-group" key={provider.id}>
                        <div className="ai-chat-model-group-title">{llmProviderGroupTitle(provider, providers, t)}</div>
                        {models.map((model) => <button type="button" className={selectedModel?.providerId === provider.id && selectedModel.model === model ? 'active' : ''} key={model} onClick={() => { setSelectedModel({ providerId: provider.id, model }); setShowModels(false); setModelSearch(''); }}>{model}</button>)}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        <div
          className="ai-chat-resize-handle"
          onPointerDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
            const bounds = panelRef.current?.getBoundingClientRect();
            if (!bounds) return;
            resizeStartRef.current = { x: event.clientX, y: event.clientY, width: bounds.width, height: bounds.height };
            setIsResizing(true);
          }}
        />
      </section>
      <ConfirmModal
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        onConfirm={confirmDeleteSession}
        title={t('aiChat.deleteSession')}
        message={t('aiChat.deleteSessionConfirm', { title: pendingDelete?.title ?? '' })}
      />
    </div>
  );
};

function getEnabledModels(provider: LLMProviderConfig): string[] {
  const models = provider.models?.filter((model) => model.enabled).map((model) => model.id) ?? [];
  return models.length > 0 ? models : (provider.model.trim() ? [provider.model.trim()] : []);
}

export default AIChatModal;
