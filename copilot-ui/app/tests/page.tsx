'use client';

import { useState } from 'react';
import { FlaskConical, Copy, Check } from 'lucide-react';
import { generateTestsForFile, createApproval, approveRequest, rejectRequest, runGeneratedTests } from '@/lib/api';
import { GeneratedTestResult, ApprovalRequest, TestRunResult } from '@/lib/types';
import { loadSettings } from '@/lib/settings';
import ApprovalGate from '@/components/ApprovalGate';
import TestResultPanel from '@/components/TestResultPanel';

type Tab = 'generate' | 'view' | 'results';

export default function TestsPage() {
  const [tab, setTab] = useState<Tab>('generate');
  const [filePath, setFilePath] = useState('');
  const [framework, setFramework] = useState('jest');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [testResult, setTestResult] = useState<GeneratedTestResult | null>(null);
  const [approval, setApproval] = useState<ApprovalRequest | null>(null);
  const [runResult, setRunResult] = useState<TestRunResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [approvalLoading, setApprovalLoading] = useState(false);

  const handleGenerate = async () => {
    const repoId = loadSettings().activeRepoId;
    if (!repoId) { setError('No active repo selected. Go to Settings.'); return; }
    if (!filePath.trim()) { setError('Enter a file path.'); return; }

    setError('');
    setLoading(true);
    setTestResult(null);
    setApproval(null);
    setRunResult(null);

    try {
      const result = await generateTestsForFile({ repoId, filePath: filePath.trim(), framework });
      setTestResult(result);
      setTab('view');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestApproval = async () => {
    if (!testResult) return;
    setApprovalLoading(true);
    try {
      const req = await createApproval({
        riskLevel: 'LOW',
        reason: `Run generated tests for ${testResult.targetFile}`,
        testgenId: testResult.testgenId,
      });
      setApproval(req);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create approval');
    } finally {
      setApprovalLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!approval || !testResult) return;
    setApprovalLoading(true);
    try {
      const repoId = loadSettings().activeRepoId;
      const approved = await approveRequest(approval.id);
      setApproval(approved);

      // Run immediately after approval
      const result = await runGeneratedTests({
        repoId,
        testgenId: testResult.testgenId,
        approvalId: approval.id,
      });
      setRunResult(result);
      setTab('results');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run tests');
    } finally {
      setApprovalLoading(false);
    }
  };

  const handleReject = async () => {
    if (!approval) return;
    setApprovalLoading(true);
    try {
      const rejected = await rejectRequest(approval.id);
      setApproval(rejected);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject');
    } finally {
      setApprovalLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!testResult) return;
    await navigator.clipboard.writeText(testResult.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const tabStyle = (t: Tab) => ({
    padding: '6px 16px',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer' as const,
    background: tab === t ? 'var(--accent)' : 'transparent',
    border: `1px solid ${tab === t ? 'var(--accent-hover)' : 'var(--border)'}`,
    borderRadius: 7,
    color: tab === t ? '#fff' : 'var(--text-muted)',
  });

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-base)' }}>
      {/* Header */}
      <div style={{ padding: '16px 24px 12px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <FlaskConical size={18} color="var(--accent)" />
        <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>Test Generation & Runner</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <button style={tabStyle('generate')} onClick={() => setTab('generate')}>Generate</button>
          <button style={tabStyle('view')} onClick={() => setTab('view')} disabled={!testResult}>View</button>
          <button style={tabStyle('results')} onClick={() => setTab('results')} disabled={!runResult}>Results</button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>

          {error && (
            <div style={{ padding: '10px 14px', background: '#2d1515', border: '1px solid #5c2020', borderRadius: 8, color: '#fca5a5', fontSize: 13, marginBottom: 16 }}>
              {error}
            </div>
          )}

          {/* ── Tab: Generate ──────────────────────────────────────────── */}
          {tab === 'generate' && (
            <div>
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>File path</label>
                <input
                  value={filePath}
                  onChange={(e) => setFilePath(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') void handleGenerate(); }}
                  placeholder="src/modules/auth/auth.service.ts"
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    padding: '8px 12px',
                    background: 'var(--bg-input)', border: '1px solid var(--border)',
                    borderRadius: 7, fontSize: 13, color: 'var(--text-primary)',
                    outline: 'none', fontFamily: 'monospace',
                  }}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>Framework</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {['jest', 'vitest', 'mocha'].map((fw) => (
                    <button
                      key={fw}
                      onClick={() => setFramework(fw)}
                      style={{
                        padding: '4px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
                        background: framework === fw ? 'var(--accent)' : 'var(--bg-message)',
                        border: `1px solid ${framework === fw ? 'var(--accent-hover)' : 'var(--border)'}`,
                        color: framework === fw ? '#fff' : 'var(--text-muted)',
                        fontWeight: 600,
                      }}
                    >{fw}</button>
                  ))}
                </div>
              </div>

              <button
                onClick={() => void handleGenerate()}
                disabled={loading}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '9px 20px',
                  background: loading ? '#3d1f15' : 'var(--accent)',
                  border: 'none', borderRadius: 7, color: '#fff',
                  fontSize: 13, cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 600,
                }}
              >
                <FlaskConical size={14} />
                {loading ? 'Generating…' : 'Generate Tests'}
              </button>
            </div>
          )}

          {/* ── Tab: View ─────────────────────────────────────────────── */}
          {tab === 'view' && testResult && (
            <div>
              {/* Meta */}
              <div style={{ display: 'flex', gap: 16, marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Test file</div>
                  <div style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--text-primary)' }}>{testResult.testFile}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Framework</div>
                  <div style={{ fontSize: 12, color: 'var(--text-primary)' }}>{testResult.framework}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Tests</div>
                  <div style={{ fontSize: 12, color: 'var(--text-primary)' }}>{testResult.testCount}</div>
                </div>
              </div>

              {/* Code viewer */}
              <div style={{ background: '#1e1410', border: '1px solid #3a2418', borderRadius: 8, overflow: 'hidden', marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 12px', borderBottom: '1px solid #3a2418' }}>
                  <span style={{ fontSize: 11, color: '#9a8070' }}>{testResult.testFile}</span>
                  <button
                    onClick={() => void handleCopy()}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      padding: '3px 8px',
                      background: copied ? '#2a4a2a' : 'transparent',
                      border: `1px solid ${copied ? '#3a6a3a' : '#3a2418'}`,
                      borderRadius: 4, color: copied ? '#7ec87e' : '#9a8070',
                      fontSize: 11, cursor: 'pointer',
                    }}
                  >
                    {copied ? <Check size={11} /> : <Copy size={11} />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <pre style={{
                  margin: 0, padding: '12px 16px',
                  fontSize: 11, lineHeight: 1.7, color: '#e8d5b0',
                  fontFamily: 'monospace', whiteSpace: 'pre', overflowX: 'auto',
                  maxHeight: 400, overflowY: 'auto',
                }}>
                  {testResult.content}
                </pre>
              </div>

              {/* Approval gate */}
              {!approval ? (
                <button
                  onClick={() => void handleRequestApproval()}
                  disabled={approvalLoading}
                  style={{
                    padding: '8px 18px',
                    background: 'transparent', border: '1px solid var(--accent)',
                    borderRadius: 7, color: 'var(--accent)',
                    fontSize: 13, cursor: approvalLoading ? 'not-allowed' : 'pointer', fontWeight: 600,
                  }}
                >
                  {approvalLoading ? 'Requesting…' : 'Request Approval to Run'}
                </button>
              ) : (
                <ApprovalGate
                  approval={approval}
                  onApprove={() => void handleApprove()}
                  onReject={() => void handleReject()}
                  loading={approvalLoading}
                />
              )}
            </div>
          )}

          {/* ── Tab: Results ──────────────────────────────────────────── */}
          {tab === 'results' && runResult && (
            <TestResultPanel result={runResult} />
          )}

        </div>
      </div>
    </div>
  );
}
