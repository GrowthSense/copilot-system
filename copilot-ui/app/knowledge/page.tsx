'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  listKnowledgeSources,
  ingestText,
  ingestMarkdown,
  ingestUrl,
  deleteKnowledgeSource,
} from '@/lib/api';
import { KnowledgeSource } from '@/lib/types';
import { BookOpen, Plus, Trash2, Link, FileText, Hash, X } from 'lucide-react';

type Tab = 'text' | 'markdown' | 'url';

const SOURCE_TYPE_ICONS: Record<string, React.ReactNode> = {
  PLAIN_TEXT: <FileText size={12} />,
  MARKDOWN: <Hash size={12} />,
  WEBPAGE: <Link size={12} />,
};

export default function KnowledgePage() {
  const [sources, setSources] = useState<KnowledgeSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [tab, setTab] = useState<Tab>('url');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // form fields
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [url, setUrl] = useState('');
  const [tags, setTags] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listKnowledgeSources();
      setSources(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function parseTags(): string[] {
    return tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
  }

  async function handleSubmit() {
    setError('');
    if (tab === 'url' && !url) { setError('URL is required.'); return; }
    if ((tab === 'text' || tab === 'markdown') && !content) { setError('Content is required.'); return; }
    if ((tab === 'text' || tab === 'markdown') && !title) { setError('Title is required.'); return; }

    setSubmitting(true);
    try {
      if (tab === 'url') {
        await ingestUrl({ url, title: title || undefined, tags: parseTags() });
      } else if (tab === 'markdown') {
        await ingestMarkdown({ content, title, tags: parseTags() });
      } else {
        await ingestText({ content, title, tags: parseTags() });
      }
      setTitle(''); setContent(''); setUrl(''); setTags('');
      setShowForm(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ingestion failed');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleFileLoad(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setContent(text);
    if (!title) setTitle(file.name.replace(/\.[^.]+$/, ''));
  }

  async function handleDelete(id: string) {
    await deleteKnowledgeSource(id);
    setSources((prev) => prev.filter((s) => s.id !== id));
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '32px 40px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
            Knowledge Base
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            Add docs, patterns, and URLs so the AI has context when answering questions.
          </p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '7px 14px',
            background: 'var(--accent)',
            border: 'none',
            borderRadius: 6,
            color: '#fff',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <Plus size={13} />
          Add source
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <div
          style={{
            background: 'var(--bg-sidebar)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: 20,
            marginBottom: 24,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Add Knowledge Source</h3>
            <button
              onClick={() => { setShowForm(false); setError(''); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
            >
              <X size={14} />
            </button>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
            {(['url', 'text', 'markdown'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  padding: '6px 12px',
                  background: 'none',
                  border: 'none',
                  borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent',
                  color: tab === t ? 'var(--accent)' : 'var(--text-muted)',
                  fontSize: 12,
                  fontWeight: tab === t ? 600 : 400,
                  cursor: 'pointer',
                  marginBottom: -1,
                  textTransform: 'capitalize',
                }}
              >
                {t === 'url' ? 'URL' : t === 'text' ? 'Plain text' : 'Markdown'}
              </button>
            ))}
          </div>

          {error && <div style={{ fontSize: 12, color: '#f87171', marginBottom: 10 }}>{error}</div>}

          {tab === 'url' ? (
            <>
              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>URL *</label>
                <input
                  style={inputStyle}
                  placeholder="https://docs.nestjs.com/modules"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>Title (optional)</label>
                <input
                  style={inputStyle}
                  placeholder="NestJS Modules"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
            </>
          ) : (
            <>
              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>Title *</label>
                <input
                  style={inputStyle}
                  placeholder="NestJS service pattern"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div style={{ marginBottom: 8 }}>
                <label style={labelStyle}>
                  Content *{' '}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 10, cursor: 'pointer', textTransform: 'none' }}
                  >
                    (load from file)
                  </button>
                </label>
                <input ref={fileInputRef} type="file" accept=".txt,.md,.ts,.js" style={{ display: 'none' }} onChange={handleFileLoad} />
                <textarea
                  style={{ ...inputStyle, height: 160, resize: 'vertical', fontFamily: 'monospace' }}
                  placeholder={tab === 'markdown' ? '# NestJS Patterns\n\nAlways use `@Injectable()` decorators...' : 'Paste your text here...'}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                />
              </div>
            </>
          )}

          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Tags (comma-separated, optional)</label>
            <input
              style={inputStyle}
              placeholder="nestjs, patterns, services"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={submitting}
            style={{
              padding: '7px 16px',
              background: 'var(--accent)',
              border: 'none',
              borderRadius: 6,
              color: '#fff',
              fontSize: 12,
              fontWeight: 600,
              cursor: submitting ? 'not-allowed' : 'pointer',
              opacity: submitting ? 0.7 : 1,
            }}
          >
            {submitting ? 'Ingesting…' : 'Ingest'}
          </button>
        </div>
      )}

      {/* Source list */}
      {loading ? (
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Loading…</div>
      ) : sources.length === 0 ? (
        <div
          style={{
            padding: 40,
            textAlign: 'center',
            border: '1px dashed var(--border)',
            borderRadius: 8,
            color: 'var(--text-muted)',
            fontSize: 13,
          }}
        >
          No knowledge sources yet. Add NestJS docs, coding patterns, or any reference material.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {sources.map((source) => (
            <div
              key={source.id}
              style={{
                background: 'var(--bg-sidebar)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: '12px 14px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
              }}
            >
              <div style={{ marginTop: 2, color: 'var(--text-muted)', flexShrink: 0 }}>
                {SOURCE_TYPE_ICONS[source.sourceType] ?? <BookOpen size={12} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>
                  {source.title}
                </div>
                {source.sourceRef && (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 4 }}>
                    {source.sourceRef}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  <span
                    style={{
                      fontSize: 10,
                      padding: '1px 5px',
                      borderRadius: 3,
                      background: 'var(--bg-input)',
                      color: 'var(--text-muted)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    {source.sourceType.replace('_', ' ')}
                  </span>
                  {source.tags.map((tag) => (
                    <span
                      key={tag}
                      style={{
                        fontSize: 10,
                        padding: '1px 5px',
                        borderRadius: 3,
                        background: 'rgba(131,79,27,0.15)',
                        color: '#d4a574',
                        border: '1px solid rgba(131,79,27,0.25)',
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
              <button
                onClick={() => handleDelete(source.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 4,
                  color: 'var(--text-muted)',
                  flexShrink: 0,
                }}
                title="Delete"
              >
                <Trash2 size={13} color="#f87171" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 10,
  color: 'var(--text-muted)',
  marginBottom: 4,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '7px 10px',
  background: 'var(--bg-input)',
  border: '1px solid var(--border)',
  borderRadius: 5,
  color: 'var(--text-primary)',
  fontSize: 12,
  outline: 'none',
};
