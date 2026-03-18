'use client';

import { useEffect, useState } from 'react';
import { X, Copy, Check, FileCode } from 'lucide-react';
import { getFileContent } from '@/lib/api';
import { loadSettings } from '@/lib/settings';

interface Props {
  filePath: string;
  onClose: () => void;
}

export default function FileViewer({ filePath, onClose }: Props) {
  const [content, setContent] = useState<string | null>(null);
  const [language, setLanguage] = useState<string>('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const repoId = loadSettings().activeRepoId;
    if (!repoId) { setError('No active repo selected'); setLoading(false); return; }

    getFileContent(repoId, filePath)
      .then((res) => { setContent(res.content); setLanguage(res.language ?? ''); })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load file'))
      .finally(() => setLoading(false));
  }, [filePath]);

  const handleCopy = async () => {
    if (!content) return;
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const fileName = filePath.split('/').pop() ?? filePath;

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.35)',
          zIndex: 100,
        }}
      />

      {/* Panel */}
      <div
        style={{
          position: 'fixed',
          top: 0, right: 0, bottom: 0,
          width: 'min(680px, 90vw)',
          background: '#1a100a',
          borderLeft: '1px solid #3a2418',
          zIndex: 101,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-8px 0 32px rgba(0,0,0,0.4)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '12px 16px',
            borderBottom: '1px solid #3a2418',
            flexShrink: 0,
          }}
        >
          <FileCode size={15} color="#a0601f" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#e8d5b0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {fileName}
            </div>
            <div style={{ fontSize: 10, color: '#6a5040', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {filePath}
            </div>
          </div>

          {content && (
            <button
              onClick={handleCopy}
              title="Copy file"
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '4px 9px',
                background: copied ? '#2a4a2a' : 'transparent',
                border: `1px solid ${copied ? '#3a6a3a' : '#3a2418'}`,
                borderRadius: 5,
                color: copied ? '#7ec87e' : '#9a8070',
                fontSize: 11, cursor: 'pointer', transition: 'all 0.15s',
              }}
            >
              {copied ? <Check size={11} /> : <Copy size={11} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          )}

          {language && (
            <span style={{ fontSize: 10, color: '#9a8070', background: '#2a1810', border: '1px solid #3a2418', borderRadius: 4, padding: '2px 7px' }}>
              {language}
            </span>
          )}

          <button
            onClick={onClose}
            title="Close (Esc)"
            style={{
              width: 28, height: 28,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'transparent', border: 'none',
              color: '#6a5040', cursor: 'pointer', borderRadius: 5,
              transition: 'color 0.15s, background 0.15s',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#e8d5b0'; (e.currentTarget as HTMLElement).style.background = '#2a1810'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#6a5040'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto' }}>
          {loading && (
            <div style={{ padding: 24, color: '#6a5040', fontSize: 13 }}>Loading…</div>
          )}
          {error && (
            <div style={{ padding: 24, color: '#f87171', fontSize: 13 }}>{error}</div>
          )}
          {content !== null && !loading && (
            <pre
              style={{
                margin: 0,
                padding: '16px 20px',
                fontSize: 12,
                lineHeight: 1.7,
                color: '#e8d5b0',
                fontFamily: 'monospace',
                whiteSpace: 'pre',
                minHeight: '100%',
              }}
            >
              {content}
            </pre>
          )}
        </div>

        {/* Line count footer */}
        {content && (
          <div style={{ padding: '6px 16px', borderTop: '1px solid #3a2418', fontSize: 10, color: '#6a5040', flexShrink: 0 }}>
            {content.split('\n').length} lines
          </div>
        )}
      </div>
    </>
  );
}
