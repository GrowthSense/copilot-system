'use client';

import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { SendHorizonal, Square } from 'lucide-react';

interface Props {
  onSend: (text: string) => void;
  onStop: () => void;
  disabled: boolean;
}

export default function ChatInput({ onSend, onStop, disabled }: Props) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-grow
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [value]);

  // Re-focus after reply
  useEffect(() => {
    if (!disabled) textareaRef.current?.focus();
  }, [disabled]);

  const submit = () => {
    const text = value.trim();
    if (!text || disabled) return;
    setValue('');
    onSend(text);
  };

  const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div
      style={{
        padding: '12px 16px 16px',
        borderTop: '1px solid var(--border)',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: 10,
          background: 'var(--bg-input)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          padding: '8px 10px 8px 14px',
          transition: 'border-color 0.15s',
        }}
      >
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKey}
          placeholder={disabled ? 'Processing…' : 'Ask about your codebase…'}
          disabled={disabled}
          rows={1}
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            resize: 'none',
            color: 'var(--text-primary)',
            fontSize: 14,
            lineHeight: 1.5,
            minHeight: 24,
            maxHeight: 200,
            fontFamily: 'inherit',
          }}
        />

        {disabled ? (
          /* Stop button — shown while a request is in-flight */
          <button
            onClick={onStop}
            title="Stop"
            style={{
              width: 32,
              height: 32,
              borderRadius: 7,
              border: '1px solid var(--border)',
              background: 'transparent',
              color: '#f87171',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0,
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-message)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <Square size={13} fill="#f87171" />
          </button>
        ) : (
          /* Send button */
          <button
            onClick={submit}
            disabled={!value.trim()}
            style={{
              width: 32,
              height: 32,
              borderRadius: 7,
              border: 'none',
              background: !value.trim() ? 'var(--bg-message)' : 'var(--accent)',
              color: !value.trim() ? 'var(--text-muted)' : '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: !value.trim() ? 'not-allowed' : 'pointer',
              flexShrink: 0,
              transition: 'background 0.15s',
            }}
          >
            <SendHorizonal size={14} />
          </button>
        )}
      </div>
      <div style={{ textAlign: 'center', marginTop: 8, fontSize: 11, color: 'var(--text-muted)' }}>
        {disabled ? 'Click ■ to stop' : 'Enter to send · Shift+Enter for new line'}
      </div>
    </div>
  );
}
