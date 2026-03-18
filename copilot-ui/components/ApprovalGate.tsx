'use client';

import { ApprovalRequest } from '@/lib/types';
import { ShieldCheck, ShieldX, Clock } from 'lucide-react';

interface Props {
  approval: ApprovalRequest;
  onApprove: () => void;
  onReject: () => void;
  loading?: boolean;
}

const RISK_STYLE: Record<string, { bg: string; border: string; text: string }> = {
  CRITICAL: { bg: '#3d0f0f', border: '#7a1f1f', text: '#fca5a5' },
  HIGH:     { bg: '#3d1f0f', border: '#7a3f1f', text: '#f97316' },
  MEDIUM:   { bg: '#3d2f0f', border: '#7a5f1f', text: '#fbbf24' },
  LOW:      { bg: '#0f243d', border: '#1f3f7a', text: '#60a5fa' },
};

export default function ApprovalGate({ approval, onApprove, onReject, loading }: Props) {
  const rs = RISK_STYLE[approval.riskLevel] ?? RISK_STYLE.LOW;

  if (approval.status === 'APPROVED') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', background: '#0f2a1a', border: '1px solid #1f5a3a', borderRadius: 8 }}>
        <ShieldCheck size={15} color="#4ade80" />
        <span style={{ fontSize: 13, color: '#4ade80' }}>Approved — running tests…</span>
      </div>
    );
  }

  if (approval.status === 'REJECTED') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', background: '#2d1515', border: '1px solid #5c2020', borderRadius: 8 }}>
        <ShieldX size={15} color="#f87171" />
        <span style={{ fontSize: 13, color: '#f87171' }}>Rejected{approval.reviewNotes ? `: ${approval.reviewNotes}` : ''}</span>
      </div>
    );
  }

  return (
    <div style={{ padding: '12px 16px', background: '#1a1005', border: `1px solid ${rs.border}`, borderRadius: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <Clock size={14} color={rs.text} />
        <span style={{ fontSize: 13, color: rs.text, fontWeight: 600 }}>Approval Required</span>
        <span style={{
          fontSize: 10, fontWeight: 700,
          padding: '1px 6px',
          background: rs.bg, border: `1px solid ${rs.border}`, borderRadius: 4,
          color: rs.text,
        }}>
          {approval.riskLevel}
        </span>
      </div>

      <p style={{ margin: '0 0 10px', fontSize: 12, color: '#b8a890' }}>{approval.reason}</p>

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={onApprove}
          disabled={loading}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '6px 14px',
            background: '#1f5a3a', border: '1px solid #4ade80',
            borderRadius: 6, color: '#4ade80', fontSize: 13,
            cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 600,
          }}
        >
          <ShieldCheck size={13} />
          Approve &amp; Run
        </button>
        <button
          onClick={onReject}
          disabled={loading}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '6px 14px',
            background: 'transparent', border: '1px solid #5c2020',
            borderRadius: 6, color: '#f87171', fontSize: 13,
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          <ShieldX size={13} />
          Reject
        </button>
      </div>
    </div>
  );
}
