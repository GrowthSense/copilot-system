'use client';

import { useEffect, useState, useCallback } from 'react';
import { Bell, ShieldCheck, ShieldX, RefreshCw } from 'lucide-react';
import { getPendingApprovals, approveRequest, rejectRequest } from '@/lib/api';
import { ApprovalRequest } from '@/lib/types';

const RISK_STYLE: Record<string, { bg: string; border: string; text: string }> = {
  CRITICAL: { bg: '#3d0f0f', border: '#7a1f1f', text: '#fca5a5' },
  HIGH:     { bg: '#3d1f0f', border: '#7a3f1f', text: '#f97316' },
  MEDIUM:   { bg: '#3d2f0f', border: '#7a5f1f', text: '#fbbf24' },
  LOW:      { bg: '#0f243d', border: '#1f3f7a', text: '#60a5fa' },
};

function ApprovalRow({
  approval,
  onApprove,
  onReject,
}: {
  approval: ApprovalRequest;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}) {
  const rs = RISK_STYLE[approval.riskLevel] ?? RISK_STYLE.LOW;
  const createdAt = new Date(approval.createdAt).toLocaleString();

  return (
    <div style={{
      padding: '12px 16px',
      background: 'var(--bg-message)',
      border: '1px solid var(--border)',
      borderRadius: 10,
      marginBottom: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{
          fontSize: 10, fontWeight: 700, padding: '1px 7px',
          background: rs.bg, border: `1px solid ${rs.border}`, borderRadius: 4, color: rs.text,
        }}>
          {approval.riskLevel}
        </span>
        {approval.testgenId && (
          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
            testgen: {approval.testgenId.slice(0, 12)}…
          </span>
        )}
        {approval.patchId && (
          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
            patch: {approval.patchId.slice(0, 12)}…
          </span>
        )}
        <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 'auto' }}>{createdAt}</span>
      </div>

      <p style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5 }}>
        {approval.reason}
      </p>

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={() => onApprove(approval.id)}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '5px 12px',
            background: '#1f5a3a', border: '1px solid #4ade80',
            borderRadius: 6, color: '#4ade80', fontSize: 12, cursor: 'pointer', fontWeight: 600,
          }}
        >
          <ShieldCheck size={12} /> Approve
        </button>
        <button
          onClick={() => onReject(approval.id)}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '5px 12px',
            background: 'transparent', border: '1px solid #5c2020',
            borderRadius: 6, color: '#f87171', fontSize: 12, cursor: 'pointer',
          }}
        >
          <ShieldX size={12} /> Reject
        </button>
      </div>
    </div>
  );
}

export default function ApprovalsPage() {
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await getPendingApprovals();
      setApprovals(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load approvals');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // Poll every 30s
  useEffect(() => {
    const iv = setInterval(() => void load(), 30_000);
    return () => clearInterval(iv);
  }, [load]);

  const handleApprove = async (id: string) => {
    try {
      await approveRequest(id);
      setApprovals((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve');
    }
  };

  const handleReject = async (id: string) => {
    try {
      await rejectRequest(id);
      setApprovals((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject');
    }
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-base)' }}>
      {/* Header */}
      <div style={{ padding: '16px 24px 12px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <Bell size={18} color="var(--accent)" />
        <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
          Pending Approvals
          {approvals.length > 0 && (
            <span style={{ marginLeft: 8, fontSize: 12, background: '#f97316', color: '#fff', borderRadius: 10, padding: '1px 7px' }}>
              {approvals.length}
            </span>
          )}
        </span>
        <button
          onClick={() => void load()}
          title="Refresh"
          style={{ marginLeft: 'auto', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}
        >
          <RefreshCw size={15} />
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
        <div style={{ maxWidth: 680, margin: '0 auto' }}>
          {error && (
            <div style={{ padding: '10px 14px', background: '#2d1515', border: '1px solid #5c2020', borderRadius: 8, color: '#fca5a5', fontSize: 13, marginBottom: 16 }}>
              {error}
            </div>
          )}

          {loading && <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading…</div>}

          {!loading && approvals.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, marginTop: 60 }}>
              No pending approvals.
            </div>
          )}

          {approvals.map((a) => (
            <ApprovalRow
              key={a.id}
              approval={a}
              onApprove={(id) => void handleApprove(id)}
              onReject={(id) => void handleReject(id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
