'use client';

import { useState, useEffect, useCallback } from 'react';
import { listRepos, registerRepo, updateRepo, deleteRepo, startRepoIndex, getLatestRepoIndex } from '@/lib/api';
import { Repo, RepoIndex } from '@/lib/types';
import { loadSettings, saveSettings } from '@/lib/settings';
import { GitBranch, Plus, Trash2, RefreshCw, CheckCircle, Loader, FolderOpen, Pencil, X, Save } from 'lucide-react';

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    COMPLETED: '#666d4a',
    PENDING: '#d97706',
    RUNNING: '#834f1b',
    FAILED: '#dc2626',
  };
  return (
    <span
      style={{
        fontSize: 10,
        padding: '1px 6px',
        borderRadius: 3,
        background: `${colors[status] ?? '#6b7280'}22`,
        color: colors[status] ?? '#6b7280',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
      }}
    >
      {status}
    </span>
  );
}

function localPathFromCloneUrl(cloneUrl: string): string {
  if (cloneUrl.startsWith('file://')) return cloneUrl.slice('file://'.length);
  return cloneUrl;
}

export default function ReposPage() {
  const [repos, setRepos] = useState<Repo[]>([]);
  const [indexes, setIndexes] = useState<Record<string, RepoIndex | null>>({});
  const [loading, setLoading] = useState(true);
  const [indexing, setIndexing] = useState<Record<string, boolean>>({});
  const [activeRepoId, setActiveRepoId] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', localPath: '', description: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: '', localPath: '', description: '' });
  const [editSaving, setEditSaving] = useState(false);

  useEffect(() => {
    setActiveRepoId(loadSettings().activeRepoId);
    load();
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listRepos();
      setRepos(data);
      const idx: Record<string, RepoIndex | null> = {};
      await Promise.all(data.map(async (r) => { idx[r.id] = await getLatestRepoIndex(r.id); }));
      setIndexes(idx);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  async function handleRegister() {
    if (!form.name || !form.localPath) {
      setError('Name and local path are required.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const cloneUrl = form.localPath.startsWith('file://')
        ? form.localPath
        : `file://${form.localPath}`;
      await registerRepo({
        name: form.name,
        fullName: form.name,
        cloneUrl,
        description: form.description || undefined,
      });
      setForm({ name: '', localPath: '', description: '' });
      setShowForm(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to register repo');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    await deleteRepo(id);
    if (activeRepoId === id) {
      saveSettings({ activeRepoId: '', activeRepoName: '' });
      setActiveRepoId('');
    }
    await load();
  }

  async function handleIndex(repo: Repo) {
    const localPath = localPathFromCloneUrl(repo.cloneUrl);
    setIndexing((p) => ({ ...p, [repo.id]: true }));
    setError('');
    try {
      await startRepoIndex(repo.id, localPath);
      setTimeout(async () => {
        const idx = await getLatestRepoIndex(repo.id);
        setIndexes((p) => ({ ...p, [repo.id]: idx }));
        setIndexing((p) => ({ ...p, [repo.id]: false }));
      }, 4000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Indexing failed');
      setIndexing((p) => ({ ...p, [repo.id]: false }));
    }
  }

  function handleSetActive(repo: Repo) {
    saveSettings({ activeRepoId: repo.id, activeRepoName: repo.name });
    setActiveRepoId(repo.id);
  }

  function startEdit(repo: Repo) {
    setEditingId(repo.id);
    setEditForm({
      name: repo.name,
      localPath: localPathFromCloneUrl(repo.cloneUrl),
      description: repo.description ?? '',
    });
    setError('');
  }

  function cancelEdit() {
    setEditingId(null);
    setError('');
  }

  async function handleSaveEdit(repo: Repo) {
    if (!editForm.name || !editForm.localPath) {
      setError('Name and path are required.');
      return;
    }
    setEditSaving(true);
    setError('');
    try {
      const cloneUrl = editForm.localPath.startsWith('file://')
        ? editForm.localPath
        : `file://${editForm.localPath}`;
      await updateRepo(repo.id, {
        name: editForm.name,
        cloneUrl,
        description: editForm.description || undefined,
      });
      // If this is the active repo, update its name in settings too
      if (activeRepoId === repo.id) {
        saveSettings({ activeRepoName: editForm.name });
      }
      setEditingId(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setEditSaving(false);
    }
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '32px 40px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
            Repositories
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            Register a local project on disk. Index it so the AI can read your code. The active repo is used in chat.
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
            flexShrink: 0,
            marginLeft: 16,
          }}
        >
          <Plus size={13} />
          Add project
        </button>
      </div>

      {/* Register form */}
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
          <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 14 }}>
            Add Local Project
          </h3>
          {error && <div style={{ fontSize: 12, color: '#f87171', marginBottom: 10 }}>{error}</div>}

          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Project name</label>
            <input
              style={inputStyle}
              placeholder="copilot"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>
              <FolderOpen size={10} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
              Absolute path on disk
            </label>
            <input
              style={{ ...inputStyle, fontFamily: 'monospace' }}
              placeholder="/home/zoe/Documents/Growthsense/BuntuProjects/copilot"
              value={form.localPath}
              onChange={(e) => setForm((p) => ({ ...p, localPath: e.target.value }))}
            />
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
              The backend reads files directly from this path. Must be accessible on the server running the API.
            </div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Description (optional)</label>
            <input
              style={inputStyle}
              placeholder="NestJS copilot backend"
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
            />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleRegister}
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
              {submitting ? 'Registering…' : 'Register'}
            </button>
            <button
              onClick={() => { setShowForm(false); setError(''); }}
              style={{
                padding: '7px 16px',
                background: 'transparent',
                border: '1px solid var(--border)',
                borderRadius: 6,
                color: 'var(--text-muted)',
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && !showForm && (
        <div style={{ fontSize: 12, color: '#f87171', marginBottom: 12 }}>{error}</div>
      )}

      {/* Repo list */}
      {loading ? (
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Loading…</div>
      ) : repos.length === 0 ? (
        <div
          style={{
            padding: 48,
            textAlign: 'center',
            border: '1px dashed var(--border)',
            borderRadius: 8,
            color: 'var(--text-muted)',
            fontSize: 13,
          }}
        >
          No projects registered yet.
          <br />
          <span style={{ fontSize: 12, marginTop: 6, display: 'block' }}>
            Click &ldquo;Add project&rdquo; and enter the absolute path to a project on disk.
          </span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {repos.map((repo) => {
            const index = indexes[repo.id];
            const isActive = activeRepoId === repo.id;
            const localPath = localPathFromCloneUrl(repo.cloneUrl);
            const isEditing = editingId === repo.id;

            if (isEditing) {
              return (
                <div
                  key={repo.id}
                  style={{
                    background: 'var(--bg-sidebar)',
                    border: '1px solid var(--accent)',
                    borderRadius: 8,
                    padding: '14px 16px',
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>
                    Edit — {repo.name}
                  </div>
                  {error && <div style={{ fontSize: 12, color: '#f87171', marginBottom: 8 }}>{error}</div>}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                    <div>
                      <label style={labelStyle}>Name</label>
                      <input
                        style={inputStyle}
                        value={editForm.name}
                        onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Description</label>
                      <input
                        style={inputStyle}
                        value={editForm.description}
                        onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))}
                        placeholder="optional"
                      />
                    </div>
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <label style={labelStyle}>
                      <FolderOpen size={10} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
                      Absolute path on disk
                    </label>
                    <input
                      style={{ ...inputStyle, fontFamily: 'monospace' }}
                      value={editForm.localPath}
                      onChange={(e) => setEditForm((p) => ({ ...p, localPath: e.target.value }))}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => handleSaveEdit(repo)}
                      disabled={editSaving}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '6px 14px', background: 'var(--accent)', border: 'none',
                        borderRadius: 5, color: '#fff', fontSize: 12, fontWeight: 600,
                        cursor: editSaving ? 'not-allowed' : 'pointer', opacity: editSaving ? 0.7 : 1,
                      }}
                    >
                      <Save size={12} />
                      {editSaving ? 'Saving…' : 'Save'}
                    </button>
                    <button
                      onClick={cancelEdit}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '6px 14px', background: 'transparent',
                        border: '1px solid var(--border)', borderRadius: 5,
                        color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer',
                      }}
                    >
                      <X size={12} />
                      Cancel
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={repo.id}
                style={{
                  background: isActive ? 'rgba(131,79,27,0.08)' : 'var(--bg-sidebar)',
                  border: `1px solid ${isActive ? 'rgba(131,79,27,0.4)' : 'var(--border)'}`,
                  borderRadius: 8,
                  padding: '14px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                }}
              >
                <GitBranch size={16} color={isActive ? 'var(--accent)' : 'var(--text-muted)'} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                      {repo.name}
                    </span>
                    {isActive && (
                      <span style={{
                        fontSize: 10, padding: '1px 6px', borderRadius: 3,
                        background: 'rgba(131,79,27,0.25)', color: 'var(--accent)', fontWeight: 600,
                      }}>
                        ACTIVE
                      </span>
                    )}
                    {index && <StatusBadge status={index.status} />}
                  </div>
                  <div style={{
                    fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    marginBottom: index?.totalFiles != null ? 2 : 0,
                  }}>
                    {localPath}
                  </div>
                  {index?.totalFiles != null && (
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {index.indexedFiles ?? 0} / {index.totalFiles} files indexed
                      {index.status === 'RUNNING' && (
                        <span style={{ marginLeft: 6, color: 'var(--accent)' }}>— indexing…</span>
                      )}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  {!isActive && (
                    <button onClick={() => handleSetActive(repo)} title="Set as active repo for chat" style={iconBtn}>
                      <CheckCircle size={14} color="#666d4a" />
                    </button>
                  )}
                  <button onClick={() => startEdit(repo)} title="Edit" style={iconBtn}>
                    <Pencil size={14} color="var(--text-muted)" />
                  </button>
                  <button
                    onClick={() => handleIndex(repo)}
                    disabled={!!indexing[repo.id]}
                    title={`Index ${localPath}`}
                    style={{ ...iconBtn, opacity: indexing[repo.id] ? 0.6 : 1 }}
                  >
                    {indexing[repo.id]
                      ? <Loader size={14} color="var(--accent)" />
                      : <RefreshCw size={14} color="var(--text-muted)" />
                    }
                  </button>
                  <button onClick={() => handleDelete(repo.id)} title="Remove project" style={iconBtn}>
                    <Trash2 size={14} color="#f87171" />
                  </button>
                </div>
              </div>
            );
          })}
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

const iconBtn: React.CSSProperties = {
  width: 30,
  height: 30,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'transparent',
  border: '1px solid var(--border)',
  borderRadius: 5,
  cursor: 'pointer',
};
