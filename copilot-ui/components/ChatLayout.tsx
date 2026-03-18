'use client';

import { Message } from '@/lib/types';
import ChatSidebar from './ChatSidebar';
import ChatWindow from './ChatWindow';
import ChatInput from './ChatInput';
import { Bot } from 'lucide-react';

interface Props {
  messages: Message[];
  loading: boolean;
  onSend: (text: string) => void;
  onStop: () => void;
  repoId: string;
  repoName?: string;
  sessionId: string;
  sessionsVersion: number;
  onSelectSession: (sessionId: string) => void;
  onNewSession: () => void;
}

export default function ChatLayout({
  messages,
  loading,
  onSend,
  onStop,
  repoId,
  repoName,
  sessionId,
  sessionsVersion,
  onSelectSession,
  onNewSession,
}: Props) {
  return (
    <div
      style={{
        display: 'flex',
        height: '100%',
        background: 'var(--bg-base)',
        overflow: 'hidden',
      }}
    >
      {/* Chat history sidebar */}
      <ChatSidebar
        repoId={repoId}
        activeSessionId={sessionId}
        sessionsVersion={sessionsVersion}
        onSelectSession={onSelectSession}
        onNewSession={onNewSession}
      />

      {/* Main area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Header */}
        <div
          style={{
            height: 52,
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '0 20px',
            flexShrink: 0,
          }}
        >
          <Bot size={18} color="var(--accent)" />
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
            Chat
          </span>
          {repoName && (
            <span
              style={{
                marginLeft: 8,
                fontSize: 11,
                color: 'var(--text-muted)',
                background: 'var(--bg-input)',
                border: '1px solid var(--border)',
                borderRadius: 4,
                padding: '1px 6px',
              }}
            >
              {repoName}
            </span>
          )}
        </div>

        {/* Messages */}
        <ChatWindow messages={messages} loading={loading} onSend={onSend} />

        {/* Input */}
        <ChatInput onSend={onSend} onStop={onStop} disabled={loading} />
      </div>
    </div>
  );
}
