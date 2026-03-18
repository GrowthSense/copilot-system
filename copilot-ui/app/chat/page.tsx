'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import ChatLayout from '@/components/ChatLayout';
import { Message } from '@/lib/types';
import { sendChatMessage, getChatMessages } from '@/lib/api';
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

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [repoId, setRepoId] = useState('');
  const [repoName, setRepoName] = useState('');
  const [sessionId, setSessionId] = useState<string>('');
  const [sessionsVersion, setSessionsVersion] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const s = loadSettings();
    setRepoId(s.activeRepoId);
    setRepoName(s.activeRepoName);
    setSessionId(getOrCreateSessionId());
  }, []);

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
    const currentRepoId = loadSettings().activeRepoId;
    const currentSessionId = sessionStorage.getItem(SESSION_STORAGE_KEY) ?? sessionId;

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await sendChatMessage(currentSessionId, currentRepoId, text, controller.signal);
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: res.reply,
          relevantFiles: res.relevantFiles,
          sources: res.sources,
          timestamp: new Date(),
          agentAction: res.agentAction,
        },
      ]);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: 'Stopped.',
            timestamp: new Date(),
          },
        ]);
      } else {
        const message = err instanceof Error ? err.message : 'Something went wrong';
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: message,
            timestamp: new Date(),
            error: true,
          },
        ]);
      }
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
      onSend={handleSend}
      onStop={handleStop}
      repoId={repoId}
      repoName={repoName}
      sessionId={sessionId}
      sessionsVersion={sessionsVersion}
      onSelectSession={handleSelectSession}
      onNewSession={handleNewSession}
    />
  );
}
