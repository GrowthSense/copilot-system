'use client';

import { useState } from 'react';
import { Message, CodeReview } from '@/lib/types';
import FileReference from './FileReference';
import SourceReference from './SourceReference';
import ReviewFindings from './ReviewFindings';
import { User, Bot, Copy, Check } from 'lucide-react';

interface Props {
  message: Message;
}

interface TextPart {
  type: 'text';
  content: string;
}
interface CodePart {
  type: 'code';
  lang: string;
  content: string;
}
type Part = TextPart | CodePart;

function parseContent(raw: string): Part[] {
  const parts: Part[] = [];
  const fenceRe = /```(\w*)\n?([\s\S]*?)```/g;
  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = fenceRe.exec(raw)) !== null) {
    if (match.index > last) parts.push({ type: 'text', content: raw.slice(last, match.index) });
    parts.push({ type: 'code', lang: match[1] || 'text', content: match[2].trimEnd() });
    last = match.index + match[0].length;
  }
  if (last < raw.length) parts.push({ type: 'text', content: raw.slice(last) });
  return parts;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      title={copied ? 'Copied!' : 'Copy code'}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 7px',
        background: copied ? '#2a4a2a' : 'transparent',
        border: `1px solid ${copied ? '#3a6a3a' : '#3a2418'}`,
        borderRadius: 4,
        color: copied ? '#7ec87e' : '#9a8070',
        fontSize: 11,
        cursor: 'pointer',
        transition: 'all 0.15s',
      }}
    >
      {copied ? <Check size={11} /> : <Copy size={11} />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

function InlineText({ text }: { text: string }) {
  const segments = text.split(/(`[^`]+`)/g);
  return (
    <>
      {segments.map((seg, i) =>
        seg.startsWith('`') && seg.endsWith('`') ? (
          <code
            key={i}
            style={{
              background: '#1e1410',
              border: '1px solid #3a2418',
              borderRadius: 3,
              padding: '1px 5px',
              fontSize: '0.85em',
              fontFamily: 'monospace',
              color: '#e8d5b0',
            }}
          >
            {seg.slice(1, -1)}
          </code>
        ) : (
          <span key={i}>{seg}</span>
        ),
      )}
    </>
  );
}

export default function MessageBubble({ message }: Props) {
  const isUser = message.role === 'user';
  const parts = parseContent(message.content);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: isUser ? 'row-reverse' : 'row',
        gap: 10,
        padding: '6px 20px',
        alignItems: 'flex-start',
      }}
    >
      {/* Avatar */}
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: '50%',
          background: isUser ? 'var(--accent)' : '#3d1f15',
          border: `1px solid ${isUser ? 'var(--accent-hover)' : 'var(--border)'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          marginTop: 2,
        }}
      >
        {isUser ? <User size={13} color="#fff" /> : <Bot size={13} color="var(--accent)" />}
      </div>

      {/* Bubble */}
      <div style={{ maxWidth: '72%', minWidth: 0 }}>
        <div
          style={{
            background: isUser ? 'var(--accent)' : message.error ? '#2d1515' : 'var(--bg-message)',
            border: `1px solid ${isUser ? 'var(--accent-hover)' : message.error ? '#5c2020' : 'var(--border)'}`,
            borderRadius: 10,
            borderTopRightRadius: isUser ? 2 : 10,
            borderTopLeftRadius: isUser ? 10 : 2,
            padding: '10px 14px',
            fontSize: 14,
            lineHeight: 1.6,
            color: isUser ? '#fff' : message.error ? '#fca5a5' : 'var(--text-primary)',
            wordBreak: 'break-word',
          }}
        >
          {parts.map((part, i) =>
            part.type === 'code' ? (
              <div key={i} style={{ margin: '8px 0' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: '#1e1410',
                    borderRadius: '6px 6px 0 0',
                    padding: '4px 10px',
                    fontSize: 11,
                    color: '#9a8070',
                    borderBottom: '1px solid #3a2418',
                  }}
                >
                  <span>{part.lang || 'code'}</span>
                  <CopyButton text={part.content} />
                </div>
                <pre
                  style={{
                    background: '#1e1410',
                    margin: 0,
                    padding: '10px 12px',
                    borderRadius: '0 0 6px 6px',
                    fontSize: 12,
                    lineHeight: 1.6,
                    overflowX: 'auto',
                    color: '#e8d5b0',
                    fontFamily: 'monospace',
                  }}
                >
                  {part.content}
                </pre>
              </div>
            ) : (
              <p key={i} style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                <InlineText text={part.content} />
              </p>
            ),
          )}
        </div>

        {/* File refs */}
        {!isUser && message.relevantFiles && message.relevantFiles.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
            {message.relevantFiles.map((f) => (
              <FileReference key={f} path={f} />
            ))}
          </div>
        )}

        {/* Sources */}
        {!isUser && message.sources && message.sources.length > 0 && (
          <SourceReference sources={message.sources} />
        )}

        {/* Agent action cards */}
        {!isUser && message.agentAction?.type === 'review' && (
          <div style={{ marginTop: 8, background: '#1a100a', border: '1px solid #3a2418', borderRadius: 8, padding: '12px 14px' }}>
            <ReviewFindings review={message.agentAction.data as CodeReview} compact />
          </div>
        )}

        {/* Timestamp */}
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, textAlign: isUser ? 'right' : 'left' }}>
          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  );
}
