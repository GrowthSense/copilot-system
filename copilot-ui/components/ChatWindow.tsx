'use client';

import { useEffect, useRef, useState } from 'react';
import { Message } from '@/lib/types';
import MessageBubble from './MessageBubble';
import { Zap } from 'lucide-react';

interface Props {
  messages: Message[];
  loading: boolean;
  onSend?: (text: string) => void;
}

const SUGGESTIONS = [
  'Explain how this repo is structured',
  'Find files related to authentication',
  'What does the LLM service do?',
  'Show me how runs are tracked',
];

const THINKING_STAGES = [
  { label: 'Searching codebase…',   ms: 0 },
  { label: 'Reading relevant files…', ms: 2500 },
  { label: 'Thinking…',              ms: 6000 },
  { label: 'Writing response…',      ms: 11000 },
];

function ThinkingIndicator() {
  const [stageIndex, setStageIndex] = useState(0);

  useEffect(() => {
    setStageIndex(0);
    const timers = THINKING_STAGES.slice(1).map((s, i) =>
      setTimeout(() => setStageIndex(i + 1), s.ms),
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  const label = THINKING_STAGES[stageIndex].label;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px' }}>
      {/* Pulsing dots */}
      <div style={{ display: 'flex', gap: 4 }}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: 'var(--accent)',
              animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
            }}
          />
        ))}
      </div>
      {/* Stage label */}
      <span
        key={label}
        style={{
          fontSize: 12,
          color: 'var(--text-muted)',
          animation: 'fadeIn 0.3s ease',
        }}
      >
        {label}
      </span>
      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-5px); opacity: 1; }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(3px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

export default function ChatWindow({ messages, loading, onSend }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  if (messages.length === 0 && !loading) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 24,
          padding: 32,
          overflowY: 'auto',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: '#1a2744',
              border: '1px solid #2a3f6f',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
            }}
          >
            <Zap size={22} color="var(--accent)" />
          </div>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
            How can I help?
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 320 }}>
            Ask me anything about your codebase — files, logic, architecture, or how to fix something.
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 8,
            width: '100%',
            maxWidth: 480,
          }}
        >
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => onSend?.(s)}
              style={{
                padding: '10px 12px',
                background: 'var(--bg-message)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                fontSize: 12,
                color: 'var(--text-subtle)',
                cursor: onSend ? 'pointer' : 'default',
                lineHeight: 1.4,
                textAlign: 'left',
                transition: 'border-color 0.15s, background 0.15s',
              }}
              onMouseEnter={(e) => {
                if (onSend) {
                  e.currentTarget.style.background = 'var(--bg-input)';
                  e.currentTarget.style.borderColor = 'var(--accent)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--bg-message)';
                e.currentTarget.style.borderColor = 'var(--border)';
              }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        flex: 1,
        overflowY: 'auto',
        padding: '16px 0',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {messages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} />
      ))}
      {loading && (
        <div
          style={{
            display: 'flex',
            padding: '6px 20px',
          }}
        >
          <div
            style={{
              background: 'var(--bg-message)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              borderTopLeftRadius: 2,
            }}
          >
            <ThinkingIndicator />
          </div>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
