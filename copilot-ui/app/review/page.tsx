'use client';

import { useState } from 'react';
import { ShieldCheck, Search } from 'lucide-react';
import { reviewCode } from '@/lib/api';
import { CodeReview } from '@/lib/types';
import { loadSettings } from '@/lib/settings';
import ReviewFindings from '@/components/ReviewFindings';

const FOCUS_OPTIONS = [
  'SECURITY',
  'PERFORMANCE',
  'CORRECTNESS',
  'ERROR_HANDLING',
  'TESTING',
  'MAINTAINABILITY',
];

export default function ReviewPage() {
  const [filePath, setFilePath] = useState('');
  const [focusAreas, setFocusAreas] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<CodeReview | null>(null);

  const toggleFocus = (area: string) => {
    setFocusAreas((prev) =>
      prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area],
    );
  };

  const handleReview = async () => {
    const repoId = loadSettings().activeRepoId;
    if (!repoId) { setError('No active repo selected. Go to Settings.'); return; }
    if (!filePath.trim()) { setError('Enter a file path.'); return; }

    setError('');
    setLoading(true);
    setResult(null);

    try {
      const review = await reviewCode({ repoId, filePath: filePath.trim(), focusAreas: focusAreas.length ? focusAreas : undefined });
      setResult(review);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Review failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-base)' }}>
      {/* Header */}
      <div style={{ padding: '16px 24px 12px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <ShieldCheck size={18} color="var(--accent)" />
        <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>Code Review</span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
        {/* Input panel */}
        <div style={{ maxWidth: 680, margin: '0 auto' }}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>
              File path (relative to repo root)
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={filePath}
                onChange={(e) => setFilePath(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void handleReview(); }}
                placeholder="src/modules/auth/auth.service.ts"
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border)',
                  borderRadius: 7,
                  fontSize: 13,
                  color: 'var(--text-primary)',
                  outline: 'none',
                  fontFamily: 'monospace',
                }}
              />
              <button
                onClick={() => void handleReview()}
                disabled={loading}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '8px 16px',
                  background: loading ? '#3d1f15' : 'var(--accent)',
                  border: 'none',
                  borderRadius: 7,
                  color: '#fff',
                  fontSize: 13,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontWeight: 600,
                }}
              >
                <Search size={14} />
                {loading ? 'Reviewing…' : 'Review'}
              </button>
            </div>
          </div>

          {/* Focus areas */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Focus areas (optional)</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {FOCUS_OPTIONS.map((area) => (
                <button
                  key={area}
                  onClick={() => toggleFocus(area)}
                  style={{
                    padding: '3px 10px',
                    borderRadius: 5,
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: 'pointer',
                    background: focusAreas.includes(area) ? 'var(--accent)' : 'var(--bg-message)',
                    border: `1px solid ${focusAreas.includes(area) ? 'var(--accent-hover)' : 'var(--border)'}`,
                    color: focusAreas.includes(area) ? '#fff' : 'var(--text-muted)',
                  }}
                >
                  {area}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div style={{ padding: '10px 14px', background: '#2d1515', border: '1px solid #5c2020', borderRadius: 8, color: '#fca5a5', fontSize: 13, marginBottom: 16 }}>
              {error}
            </div>
          )}

          {/* Results */}
          {result && (
            <div style={{ background: '#1a100a', border: '1px solid #3a2418', borderRadius: 10, padding: '16px 18px' }}>
              <ReviewFindings review={result} />
            </div>
          )}

          {!result && !loading && (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, marginTop: 60 }}>
              Enter a file path and click Review to get a structured code review.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
