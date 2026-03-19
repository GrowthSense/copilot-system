'use client';

import { useEffect, useState, useCallback } from 'react';
import { MessageSquare, Plus } from 'lucide-react';
import { ChatSession } from '@/lib/types';
import { listChatSessions } from '@/lib/api';

interface Props {
  repoId: string;
  activeSessionId: string;
  sessionsVersion: number;
  onSelectSession: (sessionId: string) => void;
  onNewSession: () => void;
}

function groupByDate(sessions: ChatSession[]): { label: string; items: ChatSession[] }[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterday = today - 86_400_000;
  const weekAgo = today - 7 * 86_400_000;

  const groups: Record<string, ChatSession[]> = {
    Today: [],
    Yesterday: [],
    'This week': [],
    Older: [],
  };

  for (const s of sessions) {
    const t = new Date(s.updatedAt).getTime();
    if (t >= today) groups['Today'].push(s);
    else if (t >= yesterday) groups['Yesterday'].push(s);
    else if (t >= weekAgo) groups['This week'].push(s);
    else groups['Older'].push(s);
  }

  return Object.entries(groups)
    .filter(([, items]) => items.length > 0)
    .map(([label, items]) => ({ label, items }));
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (d.getTime() >= today) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export default function ChatSidebar({ repoId, activeSessionId, sessionsVersion, onSelectSession, onNewSession }: Props) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);

  const load = useCallback(async () => {
    try {
      // Always load all sessions — don't filter by repo so history is complete
      const data = await listChatSessions();
      setSessions(data);
    } catch {
      // backend not reachable — show nothing
    }
  }, []);

  // Single stable dep: refreshKey encodes both session identity and message version.
  const refreshKey = `${activeSessionId}:${sessionsVersion}`;
  useEffect(() => { void load(); }, [load, refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const groups = groupByDate(sessions);

  return (
    <div
      style={{
        width: 240,
        background: 'var(--bg-sidebar)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
      }}
    >
      {/* Header */}
      <div
        style={{
          height: 52,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '0 16px',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          History
        </span>
      </div>

      {/* New chat button */}
      <div style={{ padding: '12px 10px 8px' }}>
        <button
          onClick={onNewSession}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '7px 10px',
            background: 'transparent',
            border: '1px solid var(--border)',
            borderRadius: 6,
            color: 'var(--text-subtle)',
            fontSize: 12,
            cursor: 'pointer',
            transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-message)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          <Plus size={13} />
          New Chat
        </button>
      </div>

      {/* Session list */}
      <div style={{ flex: 1, padding: '0 10px', overflowY: 'auto' }}>
        {groups.length === 0 && (
          <div style={{ fontSize: 11, color: 'var(--text-muted)', padding: '12px 6px', textAlign: 'center' }}>
            No previous chats
          </div>
        )}
        {groups.map(({ label, items }) => (
          <div key={label}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', padding: '6px 6px 4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {label}
            </div>
            {items.map((s) => {
              const isActive = s.id === activeSessionId;
              return (
                <button
                  key={s.id}
                  onClick={() => onSelectSession(s.id)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 8px',
                    borderRadius: 6,
                    background: isActive ? 'var(--accent-dark)' : 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    marginBottom: 2,
                    textAlign: 'left',
                    transition: 'background 0.12s',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) e.currentTarget.style.background = 'var(--bg-message)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <MessageSquare size={12} color={isActive ? '#fff' : 'var(--text-muted)'} style={{ flexShrink: 0 }} />
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <div style={{ fontSize: 12, color: isActive ? '#fff' : 'var(--text-subtle)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {s.title}
                    </div>
                    {s.repoId && (
                      <div style={{ fontSize: 10, color: isActive ? 'rgba(255,255,255,0.5)' : 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {s.repoId.slice(-8)}
                      </div>
                    )}
                  </div>
                  <span style={{ marginLeft: 4, fontSize: 10, color: isActive ? 'rgba(255,255,255,0.65)' : 'var(--text-muted)', flexShrink: 0 }}>
                    {formatTime(s.updatedAt)}
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Footer */}
      {repoId && (
        <div
          style={{
            padding: '10px 14px',
            borderTop: '1px solid var(--border)',
            fontSize: 11,
            color: 'var(--text-muted)',
          }}
        >
          <span style={{ color: 'var(--text-muted)' }}>repo: </span>
          <span style={{ color: 'var(--text-subtle)' }}>{repoId}</span>
        </div>
      )}
    </div>
  );
}
