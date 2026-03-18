'use client';

import { CodeReview, ReviewFinding, Severity } from '@/lib/types';

interface Props {
  review: CodeReview;
  compact?: boolean;
}

const SEVERITY_STYLE: Record<Severity | 'NONE', { bg: string; border: string; text: string; label: string }> = {
  CRITICAL: { bg: '#3d0f0f', border: '#7a1f1f', text: '#fca5a5', label: 'CRITICAL' },
  HIGH:     { bg: '#3d1f0f', border: '#7a3f1f', text: '#f97316', label: 'HIGH' },
  MEDIUM:   { bg: '#3d2f0f', border: '#7a5f1f', text: '#fbbf24', label: 'MEDIUM' },
  LOW:      { bg: '#0f243d', border: '#1f3f7a', text: '#60a5fa', label: 'LOW' },
  NONE:     { bg: '#0f2a1a', border: '#1f5a3a', text: '#4ade80', label: 'NONE' },
};

function SeverityBadge({ severity }: { severity: Severity | 'NONE' }) {
  const s = SEVERITY_STYLE[severity] ?? SEVERITY_STYLE.LOW;
  return (
    <span style={{
      display: 'inline-block',
      padding: '1px 7px',
      borderRadius: 4,
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: '0.05em',
      background: s.bg,
      border: `1px solid ${s.border}`,
      color: s.text,
    }}>
      {s.label}
    </span>
  );
}

function FindingCard({ finding }: { finding: ReviewFinding }) {
  const s = SEVERITY_STYLE[finding.severity];
  const loc = finding.lineStart
    ? ` · line ${finding.lineStart}${finding.lineEnd && finding.lineEnd !== finding.lineStart ? `–${finding.lineEnd}` : ''}`
    : '';

  return (
    <div style={{
      background: s.bg,
      border: `1px solid ${s.border}`,
      borderRadius: 8,
      padding: '10px 14px',
      marginBottom: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <SeverityBadge severity={finding.severity} />
        <span style={{ fontSize: 11, color: '#9a8070', background: '#1e1410', border: '1px solid #3a2418', borderRadius: 4, padding: '1px 6px' }}>
          {finding.category}
        </span>
        <span style={{ fontSize: 12, fontWeight: 600, color: s.text, flex: 1 }}>{finding.title}</span>
        {loc && <span style={{ fontSize: 10, color: '#6a5040' }}>{loc}</span>}
      </div>

      <p style={{ margin: '0 0 6px', fontSize: 12, color: '#e8d5b0', lineHeight: 1.6 }}>
        {finding.description}
      </p>

      {finding.codeSnippet && (
        <pre style={{
          margin: '6px 0',
          padding: '6px 10px',
          background: '#0f0a06',
          borderRadius: 5,
          fontSize: 11,
          color: '#e8d5b0',
          fontFamily: 'monospace',
          overflowX: 'auto',
          whiteSpace: 'pre',
        }}>
          {finding.codeSnippet}
        </pre>
      )}

      <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
        <span style={{ fontSize: 12, color: '#fbbf24' }}>💡</span>
        <span style={{ fontSize: 12, color: '#b8a890', lineHeight: 1.5 }}>{finding.suggestion}</span>
      </div>
    </div>
  );
}

const SEVERITY_ORDER: (Severity | 'NONE')[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

export default function ReviewFindings({ review, compact = false }: Props) {
  const grouped = SEVERITY_ORDER.reduce<Record<string, ReviewFinding[]>>((acc, sev) => {
    acc[sev] = review.findings.filter((f) => f.severity === sev);
    return acc;
  }, {});

  return (
    <div style={{ fontSize: 13 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <SeverityBadge severity={review.overallRisk} />
        <span style={{ color: '#e8d5b0', fontWeight: 600 }}>
          {review.findings.length} finding{review.findings.length !== 1 ? 's' : ''}
        </span>
        <span style={{ color: '#6a5040', fontSize: 11 }}>· {review.filePath}</span>
      </div>

      {/* Summary */}
      <p style={{ margin: '0 0 12px', color: '#b8a890', lineHeight: 1.6 }}>{review.summary}</p>

      {/* Findings by severity */}
      {SEVERITY_ORDER.map((sev) => {
        const items = grouped[sev];
        if (!items || items.length === 0) return null;
        return (
          <div key={sev} style={{ marginBottom: 10 }}>
            {!compact && (
              <div style={{ fontSize: 11, color: SEVERITY_STYLE[sev].text, marginBottom: 6, fontWeight: 600 }}>
                {sev} ({items.length})
              </div>
            )}
            {items.map((f, i) => <FindingCard key={i} finding={f} />)}
          </div>
        );
      })}

      {/* Positives */}
      {review.positives.length > 0 && (
        <div style={{ marginTop: 10, padding: '8px 12px', background: '#0f2a1a', border: '1px solid #1f5a3a', borderRadius: 8 }}>
          <div style={{ fontSize: 11, color: '#4ade80', fontWeight: 600, marginBottom: 4 }}>What&apos;s done well</div>
          {review.positives.map((p, i) => (
            <div key={i} style={{ fontSize: 12, color: '#b8d8b0', marginBottom: 2 }}>✓ {p}</div>
          ))}
        </div>
      )}

      {/* Testing recommendations */}
      {review.testingRecommendations.length > 0 && (
        <div style={{ marginTop: 8, padding: '8px 12px', background: '#0f1a2a', border: '1px solid #1f3a5a', borderRadius: 8 }}>
          <div style={{ fontSize: 11, color: '#60a5fa', fontWeight: 600, marginBottom: 4 }}>Testing recommendations</div>
          {review.testingRecommendations.map((t, i) => (
            <div key={i} style={{ fontSize: 12, color: '#a0b8d0', marginBottom: 2 }}>→ {t}</div>
          ))}
        </div>
      )}
    </div>
  );
}
