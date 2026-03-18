'use client';

import { TestRunResult } from '@/lib/types';
import { CheckCircle2, XCircle, Clock } from 'lucide-react';

interface Props {
  result: TestRunResult;
}

export default function TestResultPanel({ result }: Props) {
  const color = result.passed ? '#4ade80' : '#f87171';
  const bg = result.passed ? '#0f2a1a' : '#2d1515';
  const border = result.passed ? '#1f5a3a' : '#5c2020';

  return (
    <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: 10, overflow: 'hidden' }}>
      {/* Banner */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: `1px solid ${border}` }}>
        {result.passed
          ? <CheckCircle2 size={18} color="#4ade80" />
          : <XCircle size={18} color="#f87171" />
        }
        <span style={{ fontSize: 14, fontWeight: 700, color }}>{result.passed ? 'Tests Passed' : 'Tests Failed'}</span>
        <span style={{ fontSize: 12, color: '#9a8070', marginLeft: 'auto' }}>
          Exit code {result.exitCode}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#9a8070' }}>
          <Clock size={12} />
          {(result.durationMs / 1000).toFixed(1)}s
        </span>
        {result.timedOut && (
          <span style={{ fontSize: 11, color: '#fbbf24', background: '#3d2f0f', border: '1px solid #7a5f1f', borderRadius: 4, padding: '1px 6px' }}>
            TIMED OUT
          </span>
        )}
      </div>

      {/* Command */}
      <div style={{ padding: '6px 16px', background: '#0f0a06', borderBottom: `1px solid ${border}`, fontFamily: 'monospace', fontSize: 11, color: '#6a5040' }}>
        $ {result.command}
      </div>

      {/* stdout */}
      {result.stdout && (
        <div style={{ padding: '10px 16px' }}>
          <div style={{ fontSize: 11, color: '#6a5040', marginBottom: 4 }}>stdout</div>
          <pre style={{ margin: 0, padding: '8px 10px', background: '#0f0a06', borderRadius: 6, fontSize: 11, color: '#e8d5b0', overflowX: 'auto', maxHeight: 300, overflowY: 'auto', fontFamily: 'monospace' }}>
            {result.stdout}
          </pre>
        </div>
      )}

      {/* stderr */}
      {result.stderr && (
        <div style={{ padding: '0 16px 10px' }}>
          <div style={{ fontSize: 11, color: '#f87171', marginBottom: 4 }}>stderr</div>
          <pre style={{ margin: 0, padding: '8px 10px', background: '#180a0a', borderRadius: 6, fontSize: 11, color: '#fca5a5', overflowX: 'auto', maxHeight: 200, overflowY: 'auto', fontFamily: 'monospace' }}>
            {result.stderr}
          </pre>
        </div>
      )}
    </div>
  );
}
