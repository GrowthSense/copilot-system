'use client';

import { useState, useCallback, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import ChatLayout from '@/components/ChatLayout';
import { Message } from '@/lib/types';
import { sendChatMessageStream, getChatMessages, StreamProgressEvent } from '@/lib/api';
import { ToolStep } from '@/lib/types';
import { loadSettings } from '@/lib/settings';

const SESSION_STORAGE_KEY = 'buntu_chat_session_id';

function getOrCreateSessionId(): string {
  if (typeof window === 'undefined') return `sess_${crypto.randomUUID().slice(0, 8)}`;
  const stored = sessionStorage.getItem(SESSION_STORAGE_KEY);
  if (stored) return stored;
  const newId = `sess_${crypto.randomUUID().slice(0, 8)}`;
  sessionStorage.setItem(SESSION_STORAGE_KEY, newId);
  return newId;
}

function ChatPageInner() {
  const searchParams = useSearchParams();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [liveSteps, setLiveSteps] = useState<ToolStep[]>([]);
  const [repoId, setRepoId] = useState('');
  const [repoName, setRepoName] = useState('');
  const [sessionId, setSessionId] = useState<string>('');
  const [sessionsVersion, setSessionsVersion] = useState(0);
  const [initialMessage, setInitialMessage] = useState<string | undefined>();
  const abortRef = useRef<AbortController | null>(null);

  // Run once on mount — init session ID, repo settings, and restore messages on reload
  useEffect(() => {
    const s = loadSettings();
    setRepoId(s.activeRepoId);
    setRepoName(s.activeRepoName);

    const existingId = sessionStorage.getItem(SESSION_STORAGE_KEY);
    const sid = getOrCreateSessionId();
    setSessionId(sid);

    if (existingId) {
      getChatMessages(existingId).then((rows) => {
        if (rows.length > 0) {
          setMessages(rows.map((r) => ({
            id: crypto.randomUUID(),
            role: r.role,
            content: r.content,
            timestamp: new Date(r.timestamp),
          })));
        }
      }).catch(() => {});
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle ?prefill= query param separately so it doesn't re-trigger session init
  useEffect(() => {
    const prefill = searchParams.get('prefill');
    if (prefill) {
      try {
        setInitialMessage(decodeURIComponent(prefill));
      } catch {
        setInitialMessage(prefill);
      }
    }
  }, [searchParams]);

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  /** Load a previous session's messages into the chat window. */
  const handleSelectSession = useCallback(async (sid: string) => {
    try {
      const rows = await getChatMessages(sid);
      const loaded: Message[] = rows.map((r) => ({
        id: crypto.randomUUID(),
        role: r.role,
        content: r.content,
        timestamp: new Date(r.timestamp),
      }));
      setMessages(loaded);
      setSessionId(sid);
      sessionStorage.setItem(SESSION_STORAGE_KEY, sid);
    } catch {
      // silently ignore
    }
  }, []);

  /** Start a brand new session. */
  const handleNewSession = useCallback(() => {
    const newId = `sess_${crypto.randomUUID().slice(0, 8)}`;
    sessionStorage.setItem(SESSION_STORAGE_KEY, newId);
    setSessionId(newId);
    setMessages([]);
  }, []);

  const handleSend = useCallback(async (text: string) => {
    const { activeRepoId: currentRepoId, activePathPrefix } = loadSettings();
    const currentSessionId = sessionStorage.getItem(SESSION_STORAGE_KEY) ?? sessionId;

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);
    setLiveSteps([]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await sendChatMessageStream(
        currentSessionId,
        currentRepoId,
        text,
        (event: StreamProgressEvent) => {
          if (event.type === 'tool_start') {
            setLiveSteps((prev) => [
              ...prev,
              { toolName: event.toolName!, label: event.label!, input: event.input ?? {}, output: '', success: false },
            ]);
          } else if (event.type === 'tool_done') {
            setLiveSteps((prev) =>
              prev.map((s, i) =>
                i === prev.length - 1 && s.toolName === event.toolName
                  ? { ...s, output: event.output ?? '', success: event.success ?? false }
                  : s,
              ),
            );
          } else if (event.type === 'done') {
            setMessages((prev) => [
              ...prev,
              {
                id: crypto.randomUUID(),
                role: 'assistant',
                content: event.reply ?? '',
                relevantFiles: event.relevantFiles,
                sources: event.sources,
                timestamp: new Date(),
                toolSteps: event.toolSteps,
              },
            ]);
            setLiveSteps([]);
          } else if (event.type === 'error') {
            setMessages((prev) => [
              ...prev,
              {
                id: crypto.randomUUID(),
                role: 'assistant',
                content: event.message ?? 'Something went wrong',
                timestamp: new Date(),
                error: true,
              },
            ]);
            setLiveSteps([]);
          }
        },
        controller.signal,
        activePathPrefix || undefined,
      );
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        setMessages((prev) => [
          ...prev,
          { id: crypto.randomUUID(), role: 'assistant', content: 'Stopped.', timestamp: new Date() },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: err instanceof Error ? err.message : 'Something went wrong',
            timestamp: new Date(),
            error: true,
          },
        ]);
      }
      setLiveSteps([]);
    } finally {
      abortRef.current = null;
      setLoading(false);
      setSessionsVersion((v) => v + 1);
    }
  }, [sessionId]);

  return (
    <ChatLayout
      messages={messages}
      loading={loading}
      liveSteps={liveSteps}
      onSend={handleSend}
      onStop={handleStop}
      repoId={repoId}
      repoName={repoName}
      sessionId={sessionId}
      sessionsVersion={sessionsVersion}
      onSelectSession={handleSelectSession}
      onNewSession={handleNewSession}
      initialMessage={initialMessage}
    />
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={null}>
      <ChatPageInner />
    </Suspense>
  );
}
