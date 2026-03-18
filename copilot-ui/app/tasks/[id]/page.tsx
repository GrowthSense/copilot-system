'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  BrainCircuit, ChevronLeft, RefreshCw, ShieldCheck, ShieldX,
  Brain, Globe, Wrench, CheckCircle2, XCircle, Clock, Loader2, SkipForward, Trash2,
} from 'lucide-react';
import {
  getAgentTask, approvePlan, resumeAgentTask, cancelAgentTask,
  approveRequest, rejectRequest, listMemories, deleteMemory,
} from '@/lib/api';
import { AgentTask, AgentTaskStep, AgentTaskStatus, AgentTaskStepStatus, AgentMemory, AgentMemoryType } from '@/lib/types';

// ─── Status helpers ───────────────────────────────────────────────────────────

const TASK_STATUS_STYLE: Record<AgentTaskStatus, { text: string; label: string }> = {
  AWAITING_PLAN_APPROVAL: { text: '#60a5fa', label: 'Awaiting Plan Approval' },
  PLAN_APPROVED:          { text: '#86efac', label: 'Plan Approved' },
  PLAN_REJECTED:          { text: '#f87171', label: 'Plan Rejected' },
  RUNNING:                { text: '#fbbf24', label: 'Running' },
  AWAITING_STEP_APPROVAL: { text: '#60a5fa', label: 'Awaiting Step Approval' },
  COMPLETED:              { text: '#4ade80', label: 'Completed' },
  FAILED:                 { text: '#fca5a5', label: 'Failed' },
  CANCELLED:              { text: '#6b7280', label: 'Cancelled' },
};

const STEP_ICON: Record<AgentTaskStepStatus, React.ReactNode> = {
  PENDING:           <Clock size={14} color="#6b7280" />,
  AWAITING_APPROVAL: <ShieldCheck size={14} color="#60a5fa" />,
  APPROVED:          <CheckCircle2 size={14} color="#86efac" />,
  RUNNING:           <Loader2 size={14} color="#fbbf24" className="animate-spin" />,
  COMPLETED:         <CheckCircle2 size={14} color="#4ade80" />,
  FAILED:            <XCircle size={14} color="#f87171" />,
  SKIPPED:           <SkipForward size={14} color="#6b7280" />,
};

const MEMORY_TYPE_COLOR: Record<AgentMemoryType, string> = {
  FACT:        '#60a5fa',
  OBSERVATION: '#86efac',
  DECISION:    '#fbbf24',
  INSIGHT:     '#c084fc',
  RESEARCH:    '#f97316',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function StepCard({ step, taskStatus, onApprove, onReject }: {
  step: AgentTaskStep;
  taskStatus: AgentTaskStatus;
  onApprove: (approvalId: string) => void;
  onReject: (approvalId: string) => void;
}) {
  const [expanded, setExpanded] = useState(step.status === 'RUNNING' || step.status === 'FAILED');
  const isActive = step.status === 'RUNNING';
  const isCurrent = taskStatus === 'AWAITING_STEP_APPROVAL' && step.status === 'AWAITING_APPROVAL';

  return (
    <div style={{
      border: `1px solid ${isActive ? '#5a3a0a' : isCurrent ? '#2a4a6a' : 'var(--border)'}`,
      borderRadius: 8, marginBottom: 8, overflow: 'hidden',
      background: isActive ? '#1a1204' : isCurrent ? '#0a141e' : 'var(--bg-message)',
    }}>
      <div
        onClick={() => setExpanded((v) => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 14px', cursor: 'pointer',
        }}
      >
        <span style={{ color: 'var(--text-muted)', fontSize: 11, width: 20, textAlign: 'right', flexShrink: 0 }}>
          {step.stepIndex + 1}
        </span>
        {STEP_ICON[step.status]}
        <span style={{ flex: 1, fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>
          {step.title}
        </span>
        {step.requiresApproval && (
          <span style={{ fontSize: 10, padding: '1px 6px', background: '#1a2a1a', border: '1px solid #2a5a2a', borderRadius: 4, color: '#86efac' }}>
            approval required
          </span>
        )}
        {step.toolName && (
          <span style={{ fontSize: 10, padding: '1px 6px', background: '#1a1a2a', border: '1px solid #2a2a5a', borderRadius: 4, color: '#818cf8' }}>
            {step.toolName}
          </span>
        )}
        <span style={{ fontSize: 18, color: 'var(--text-muted)', transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>›</span>
      </div>

      {expanded && (
        <div style={{ padding: '0 14px 12px', borderTop: '1px solid var(--border)' }}>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '10px 0 6px', lineHeight: 1.6 }}>
            {step.description}
          </p>
          <p style={{ fontSize: 11, color: '#818cf8', margin: '0 0 6px', fontStyle: 'italic' }}>
            Reasoning: {step.reasoning}
          </p>

          {/* Step approval buttons */}
          {isCurrent && step.approvalId && (
            <div style={{ display: 'flex', gap: 8, margin: '10px 0' }}>
              <button
                onClick={() => onApprove(step.approvalId!)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px',
                  background: '#1f5a3a', border: '1px solid #4ade80',
                  borderRadius: 6, color: '#4ade80', fontSize: 12, cursor: 'pointer', fontWeight: 600,
                }}
              >
                <ShieldCheck size={12} /> Approve Step
              </button>
              <button
                onClick={() => onReject(step.approvalId!)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px',
                  background: 'transparent', border: '1px solid #5c2020',
                  borderRadius: 6, color: '#f87171', fontSize: 12, cursor: 'pointer',
                }}
              >
                <ShieldX size={12} /> Skip Step
              </button>
            </div>
          )}

          {step.observation && (
            <div style={{ marginTop: 10, padding: '8px 10px', background: '#0a140a', border: '1px solid #1f3a1f', borderRadius: 6 }}>
              <span style={{ fontSize: 10, color: '#4ade80', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Observation</span>
              <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.6 }}>{step.observation}</p>
            </div>
          )}

          {step.errorMessage && (
            <div style={{ marginTop: 10, padding: '8px 10px', background: '#2d1515', border: '1px solid #5c2020', borderRadius: 6 }}>
              <span style={{ fontSize: 10, color: '#f87171', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Error</span>
              <p style={{ margin: '4px 0 0', fontSize: 12, color: '#fca5a5', lineHeight: 1.6, fontFamily: 'monospace' }}>{step.errorMessage}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MemoryCard({ memory, onDelete }: { memory: AgentMemory; onDelete: (id: string) => void }) {
  const color = MEMORY_TYPE_COLOR[memory.type] ?? '#6b7280';
  return (
    <div style={{
      padding: '10px 12px', background: 'var(--bg-message)',
      border: '1px solid var(--border)', borderRadius: 8, marginBottom: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span style={{
          fontSize: 9, fontWeight: 700, padding: '1px 6px',
          background: `${color}22`, border: `1px solid ${color}55`,
          borderRadius: 4, color,
        }}>
          {memory.type}
        </span>
        <span style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 600 }}>{memory.subject}</span>
        <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 'auto' }}>
          conf: {Math.round(memory.confidence * 100)}%
        </span>
        <button
          onClick={() => onDelete(memory.id)}
          title="Delete memory"
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2 }}
        >
          <Trash2 size={12} />
        </button>
      </div>
      <p style={{ margin: '0 0 4px', fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>{memory.content}</p>
      {memory.tags.length > 0 && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {memory.tags.map((t) => (
            <span key={t} style={{ fontSize: 10, padding: '1px 6px', background: '#1a1a2a', border: '1px solid #2a2a4a', borderRadius: 4, color: '#818cf8' }}>
              {t}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [task, setTask] = useState<AgentTask | null>(null);
  const [memories, setMemories] = useState<AgentMemory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [activeTab, setActiveTab] = useState<'steps' | 'memories'>('steps');

  const load = useCallback(async () => {
    try {
      const [t, mems] = await Promise.all([
        getAgentTask(id),
        listMemories(undefined, undefined).catch(() => [] as AgentMemory[]),
      ]);
      setTask(t);
      // Filter memories belonging to this task
      setMemories(mems.filter((m) => m.taskId === id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load task');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  // Poll while task is active
  useEffect(() => {
    const active = task && ['RUNNING', 'AWAITING_STEP_APPROVAL', 'PLAN_APPROVED'].includes(task.status);
    if (!active) return;
    const iv = setInterval(() => void load(), 8_000);
    return () => clearInterval(iv);
  }, [task, load]);

  const handleApprovePlan = async () => {
    setActionError('');
    try {
      const updated = await approvePlan(id);
      setTask(updated);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to approve plan');
    }
  };

  const handleStepApprove = async (approvalId: string) => {
    setActionError('');
    try {
      await approveRequest(approvalId);
      const updated = await resumeAgentTask(id);
      setTask(updated);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to approve step');
    }
  };

  const handleStepReject = async (approvalId: string) => {
    setActionError('');
    try {
      await rejectRequest(approvalId);
      const updated = await resumeAgentTask(id);
      setTask(updated);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to reject step');
    }
  };

  const handleCancel = async () => {
    setActionError('');
    try {
      const updated = await cancelAgentTask(id);
      setTask(updated);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to cancel task');
    }
  };

  const handleDeleteMemory = async (memId: string) => {
    try {
      await deleteMemory(memId);
      setMemories((prev) => prev.filter((m) => m.id !== memId));
    } catch {
      // Silently ignore
    }
  };

  if (loading) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
        Loading…
      </div>
    );
  }

  if (error || !task) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <p style={{ color: '#fca5a5', fontSize: 14 }}>{error || 'Task not found'}</p>
        <button onClick={() => router.push('/tasks')} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 14px', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13 }}>
          Back to tasks
        </button>
      </div>
    );
  }

  const ts = TASK_STATUS_STYLE[task.status] ?? { text: '#6b7280', label: task.status };
  const steps: AgentTaskStep[] = task.steps ?? task.planJson?.steps ?? [];
  const canCancel = ['AWAITING_PLAN_APPROVAL', 'PLAN_APPROVED', 'RUNNING', 'AWAITING_STEP_APPROVAL'].includes(task.status);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-base)' }}>
      {/* Header */}
      <div style={{ padding: '14px 24px 12px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <button
          onClick={() => router.push('/tasks')}
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px 0', display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}
        >
          <ChevronLeft size={16} /> <span style={{ fontSize: 12 }}>Tasks</span>
        </button>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
            <BrainCircuit size={16} color="var(--accent)" />
            <span style={{ fontSize: 11, fontWeight: 700, color: ts.text }}>{ts.label}</span>
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{new Date(task.createdAt).toLocaleString()}</span>
          </div>
          <h1 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.4 }}>
            {task.goal}
          </h1>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
          <button
            onClick={() => void load()}
            title="Refresh"
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}
          >
            <RefreshCw size={14} />
          </button>
          {canCancel && (
            <button
              onClick={() => void handleCancel()}
              style={{
                padding: '5px 12px', background: 'transparent',
                border: '1px solid #5c2020', borderRadius: 6,
                color: '#f87171', fontSize: 12, cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {actionError && (
        <div style={{ margin: '0 24px', marginTop: 10, padding: '8px 12px', background: '#2d1515', border: '1px solid #5c2020', borderRadius: 6, color: '#fca5a5', fontSize: 12 }}>
          {actionError}
        </div>
      )}

      {/* Plan approval banner */}
      {task.status === 'AWAITING_PLAN_APPROVAL' && (
        <div style={{ margin: '12px 24px 0', padding: '14px 16px', background: '#0a1420', border: '1px solid #2a4a6a', borderRadius: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Brain size={15} color="#60a5fa" />
            <span style={{ fontSize: 13, fontWeight: 600, color: '#60a5fa' }}>Plan ready — review and approve to start execution</span>
          </div>
          <p style={{ margin: '0 0 12px', fontSize: 12, color: 'var(--text-muted)' }}>
            The agent has generated a {task.totalSteps || steps.length}-step plan below. Review each step before proceeding.
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => void handleApprovePlan()}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px',
                background: '#1f5a3a', border: '1px solid #4ade80',
                borderRadius: 7, color: '#4ade80', fontSize: 13, cursor: 'pointer', fontWeight: 600,
              }}
            >
              <ShieldCheck size={14} /> Approve &amp; Run
            </button>
            <button
              onClick={() => void handleCancel()}
              style={{
                padding: '7px 16px', background: 'transparent',
                border: '1px solid #5c2020', borderRadius: 7,
                color: '#f87171', fontSize: 13, cursor: 'pointer',
              }}
            >
              Reject Plan
            </button>
          </div>
        </div>
      )}

      {/* Tab bar */}
      <div style={{ padding: '12px 24px 0', display: 'flex', gap: 16, borderBottom: '1px solid var(--border)' }}>
        {(['steps', 'memories'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              padding: '4px 0 10px',
              color: activeTab === tab ? 'var(--text-primary)' : 'var(--text-muted)',
              fontSize: 13, fontWeight: activeTab === tab ? 600 : 400,
              borderBottom: activeTab === tab ? '2px solid var(--accent)' : '2px solid transparent',
              transition: 'color 0.15s',
            }}
          >
            {tab === 'steps' ? `Steps (${steps.length})` : `Memories (${memories.length})`}
          </button>
        ))}
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>

          {activeTab === 'steps' && (
            <>
              {steps.length === 0 && (
                <div style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', marginTop: 40 }}>
                  No steps yet — plan is being generated…
                </div>
              )}
              {steps.map((step) => (
                <StepCard
                  key={step.id ?? step.stepIndex}
                  step={step}
                  taskStatus={task.status}
                  onApprove={(approvalId) => void handleStepApprove(approvalId)}
                  onReject={(approvalId) => void handleStepReject(approvalId)}
                />
              ))}
              {task.errorMessage && (
                <div style={{ padding: '12px 16px', background: '#2d1515', border: '1px solid #5c2020', borderRadius: 8, marginTop: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <XCircle size={14} color="#f87171" />
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#f87171' }}>Task failed</span>
                  </div>
                  <p style={{ margin: 0, fontSize: 12, color: '#fca5a5', fontFamily: 'monospace' }}>{task.errorMessage}</p>
                </div>
              )}
              {task.status === 'COMPLETED' && (
                <div style={{ padding: '12px 16px', background: '#0f3a1f', border: '1px solid #1f7a3a', borderRadius: 8, marginTop: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <CheckCircle2 size={14} color="#4ade80" />
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#4ade80' }}>Task completed successfully</span>
                    {task.completedAt && (
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>
                        {new Date(task.completedAt).toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {activeTab === 'memories' && (
            <>
              {memories.length === 0 && (
                <div style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', marginTop: 40 }}>
                  No memories recorded for this task yet.
                </div>
              )}

              {/* Group by type */}
              {(['INSIGHT', 'DECISION', 'RESEARCH', 'OBSERVATION', 'FACT'] as AgentMemoryType[]).map((type) => {
                const group = memories.filter((m) => m.type === type);
                if (group.length === 0) return null;
                const color = MEMORY_TYPE_COLOR[type];
                return (
                  <div key={type} style={{ marginBottom: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                      {type === 'INSIGHT' && <Brain size={13} color={color} />}
                      {type === 'RESEARCH' && <Globe size={13} color={color} />}
                      {type === 'DECISION' && <Wrench size={13} color={color} />}
                      <span style={{ fontSize: 11, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        {type} ({group.length})
                      </span>
                    </div>
                    {group.map((m) => (
                      <MemoryCard key={m.id} memory={m} onDelete={(mid) => void handleDeleteMemory(mid)} />
                    ))}
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
