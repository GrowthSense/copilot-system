'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { BrainCircuit, Plus, RefreshCw, ChevronRight, X } from 'lucide-react';
import { listAgentTasks, listRepos, createAgentTask, cancelAgentTask } from '@/lib/api';
import { AgentTask, AgentTaskStatus, Repo } from '@/lib/types';

const STATUS_STYLE: Record<AgentTaskStatus, { bg: string; border: string; text: string; label: string }> = {
  AWAITING_PLAN_APPROVAL: { bg: '#1a2a3a', border: '#2a4a6a', text: '#60a5fa', label: 'Awaiting Approval' },
  PLAN_APPROVED:          { bg: '#1a2a1a', border: '#2a5a2a', text: '#86efac', label: 'Plan Approved' },
  PLAN_REJECTED:          { bg: '#3d1515', border: '#5c2020', text: '#f87171', label: 'Plan Rejected' },
  RUNNING:                { bg: '#2a1a0a', border: '#5a3a0a', text: '#fbbf24', label: 'Running' },
  AWAITING_STEP_APPROVAL: { bg: '#1a2a3a', border: '#2a4a6a', text: '#60a5fa', label: 'Step Approval' },
  COMPLETED:              { bg: '#0f3a1f', border: '#1f7a3a', text: '#4ade80', label: 'Completed' },
  FAILED:                 { bg: '#3d0f0f', border: '#7a1f1f', text: '#fca5a5', label: 'Failed' },
  CANCELLED:              { bg: '#1a1a1a', border: '#3a3a3a', text: '#6b7280', label: 'Cancelled' },
};

function StatusBadge({ status }: { status: AgentTaskStatus }) {
  const s = STATUS_STYLE[status] ?? STATUS_STYLE.CANCELLED;
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '1px 7px',
      background: s.bg, border: `1px solid ${s.border}`,
      borderRadius: 4, color: s.text, whiteSpace: 'nowrap',
    }}>
      {s.label}
    </span>
  );
}

function CreateTaskModal({
  repos,
  onClose,
  onCreate,
}: {
  repos: Repo[];
  onClose: () => void;
  onCreate: (task: AgentTask) => void;
}) {
  const [goal, setGoal] = useState('');
  const [repoId, setRepoId] = useState('');
  const [context, setContext] = useState('');
  const [pathPrefix, setPathPrefix] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!goal.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      const task = await createAgentTask({
        goal: goal.trim(),
        ...(repoId ? { repoId } : {}),
        ...(context.trim() ? { context: context.trim() } : {}),
        ...(pathPrefix.trim() ? { pathPrefix: pathPrefix.trim() } : {}),
      });
      onCreate(task);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create task');
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50,
      }}
      onClick={onClose}
    >
      <form
        onSubmit={(e) => void handleSubmit(e)}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg-sidebar)', border: '1px solid var(--border)',
          borderRadius: 12, padding: 24, width: 520, maxWidth: '90vw',
          display: 'flex', flexDirection: 'column', gap: 14,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <BrainCircuit size={18} color="var(--accent)" />
          <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>New Agent Task</span>
          <button
            type="button"
            onClick={onClose}
            style={{ marginLeft: 'auto', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
          >
            <X size={16} />
          </button>
        </div>

        {error && (
          <div style={{ padding: '8px 12px', background: '#2d1515', border: '1px solid #5c2020', borderRadius: 6, color: '#fca5a5', fontSize: 12 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Goal *
          </label>
          <textarea
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="Describe what you want the agent to do..."
            required
            rows={3}
            style={{
              background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: 7,
              color: 'var(--text-primary)', fontSize: 13, padding: '8px 10px',
              resize: 'vertical', outline: 'none', fontFamily: 'inherit',
            }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Repository
          </label>
          <select
            value={repoId}
            onChange={(e) => setRepoId(e.target.value)}
            style={{
              background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: 7,
              color: 'var(--text-primary)', fontSize: 13, padding: '8px 10px', outline: 'none',
            }}
          >
            <option value="">— global (no repo) —</option>
            {repos.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Path prefix
            </label>
            <input
              type="text"
              value={pathPrefix}
              onChange={(e) => setPathPrefix(e.target.value)}
              placeholder="src/modules/auth"
              style={{
                background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: 7,
                color: 'var(--text-primary)', fontSize: 13, padding: '8px 10px', outline: 'none',
              }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Extra context (optional)
          </label>
          <textarea
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder="Any additional context or constraints..."
            rows={2}
            style={{
              background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: 7,
              color: 'var(--text-primary)', fontSize: 13, padding: '8px 10px',
              resize: 'vertical', outline: 'none', fontFamily: 'inherit',
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '7px 16px', background: 'transparent',
              border: '1px solid var(--border)', borderRadius: 7,
              color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || !goal.trim()}
            style={{
              padding: '7px 16px', background: 'var(--accent)',
              border: 'none', borderRadius: 7,
              color: '#fff', fontSize: 13, cursor: submitting ? 'not-allowed' : 'pointer',
              fontWeight: 600, opacity: submitting ? 0.7 : 1,
            }}
          >
            {submitting ? 'Creating…' : 'Create Task'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function TasksPage() {
  const router = useRouter();
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [repos, setRepos] = useState<Repo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [taskList, repoList] = await Promise.all([
        listAgentTasks(undefined, statusFilter || undefined),
        listRepos(),
      ]);
      setTasks(taskList);
      setRepos(repoList);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { void load(); }, [load]);

  // Poll every 15s for live status updates
  useEffect(() => {
    const iv = setInterval(() => void load(), 15_000);
    return () => clearInterval(iv);
  }, [load]);

  const handleCreated = (task: AgentTask) => {
    setShowCreate(false);
    router.push(`/tasks/${task.id}`);
  };

  const handleCancel = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      const updated = await cancelAgentTask(id);
      setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
    } catch {
      // Ignore — let the poll refresh it
    }
  };

  const repoName = (id: string | null) => repos.find((r) => r.id === id)?.name ?? id?.slice(0, 12) ?? '—';

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-base)' }}>
      {/* Header */}
      <div style={{ padding: '16px 24px 12px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <BrainCircuit size={18} color="var(--accent)" />
        <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
          Agent Tasks
          {tasks.length > 0 && (
            <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--text-muted)' }}>({tasks.length})</span>
          )}
        </span>

        {/* Status filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{
            marginLeft: 16, background: 'var(--bg-message)', border: '1px solid var(--border)',
            borderRadius: 6, color: 'var(--text-primary)', fontSize: 12, padding: '4px 8px', outline: 'none',
          }}
        >
          <option value="">All statuses</option>
          {Object.entries(STATUS_STYLE).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>

        <button
          onClick={() => void load()}
          title="Refresh"
          style={{ marginLeft: 'auto', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}
        >
          <RefreshCw size={15} />
        </button>

        <button
          onClick={() => setShowCreate(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 14px', background: 'var(--accent)', border: 'none',
            borderRadius: 7, color: '#fff', fontSize: 13, cursor: 'pointer', fontWeight: 600,
          }}
        >
          <Plus size={14} /> New Task
        </button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          {error && (
            <div style={{ padding: '10px 14px', background: '#2d1515', border: '1px solid #5c2020', borderRadius: 8, color: '#fca5a5', fontSize: 13, marginBottom: 16 }}>
              {error}
            </div>
          )}

          {loading && <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading…</div>}

          {!loading && tasks.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, marginTop: 60 }}>
              No tasks found. Create one to get started.
            </div>
          )}

          {tasks.map((task) => {
            const canCancel = ['AWAITING_PLAN_APPROVAL', 'PLAN_APPROVED', 'RUNNING', 'AWAITING_STEP_APPROVAL'].includes(task.status);
            const stepTotal = task.totalSteps ?? task.planJson?.steps?.length ?? 0;
            const stepDone = task.currentStepIndex;

            return (
              <div
                key={task.id}
                onClick={() => router.push(`/tasks/${task.id}`)}
                style={{
                  padding: '14px 16px',
                  background: 'var(--bg-message)',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  marginBottom: 10,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12,
                  transition: 'border-color 0.15s',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, flexWrap: 'wrap' }}>
                    <StatusBadge status={task.status} />
                    <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                      {task.repoId ? repoName(task.repoId) : 'global'}
                    </span>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 'auto' }}>
                      {new Date(task.createdAt).toLocaleString()}
                    </span>
                  </div>

                  <p style={{ margin: '0 0 6px', fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5, fontWeight: 500 }}>
                    {task.goal}
                  </p>

                  {stepTotal > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ flex: 1, height: 3, background: 'var(--border)', borderRadius: 4 }}>
                        <div style={{
                          height: '100%', borderRadius: 4,
                          background: task.status === 'COMPLETED' ? '#4ade80' : task.status === 'FAILED' ? '#f87171' : 'var(--accent)',
                          width: `${Math.round((stepDone / stepTotal) * 100)}%`,
                          transition: 'width 0.3s',
                        }} />
                      </div>
                      <span style={{ fontSize: 10, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {stepDone}/{stepTotal} steps
                      </span>
                    </div>
                  )}

                  {task.errorMessage && (
                    <p style={{ margin: '6px 0 0', fontSize: 11, color: '#f87171' }}>{task.errorMessage}</p>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  {canCancel && (
                    <button
                      onClick={(e) => void handleCancel(e, task.id)}
                      title="Cancel task"
                      style={{
                        background: 'transparent', border: '1px solid #5c2020',
                        borderRadius: 5, color: '#f87171', fontSize: 11,
                        padding: '3px 8px', cursor: 'pointer',
                      }}
                    >
                      Cancel
                    </button>
                  )}
                  <ChevronRight size={16} color="var(--text-muted)" />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {showCreate && (
        <CreateTaskModal
          repos={repos}
          onClose={() => setShowCreate(false)}
          onCreate={handleCreated}
        />
      )}
    </div>
  );
}
