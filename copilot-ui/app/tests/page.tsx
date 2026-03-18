'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  FlaskConical, Copy, Check, Play, RotateCw,
  CheckCircle2, XCircle, MessageSquare, ChevronDown, ChevronUp,
} from 'lucide-react';
import { generateTestsForFile, writeAndRunTest } from '@/lib/api';
import { GeneratedTestResult, TestRunResult } from '@/lib/types';
import { loadSettings } from '@/lib/settings';

type Tab = 'generate' | 'view' | 'results';

// ─── Result panel ─────────────────────────────────────────────────────────────

function TestResultPanel({
  result,
  testFile,
  onRetry,
  onDiscussInChat,
  retrying,
}: {
  result: TestRunResult;
  testFile: string;
  onRetry: () => void;
  onDiscussInChat: () => void;
  retrying: boolean;
}) {
  const [showStdout, setShowStdout] = useState(!result.passed);
  const [showStderr, setShowStderr] = useState(!result.passed);

  return (
    <div>
      {/* Pass / Fail banner */}
      <div style={{
        padding: '14px 18px',
        background: result.passed ? '#0f3a1f' : '#2d1515',
        border: `1px solid ${result.passed ? '#1f7a3a' : '#5c2020'}`,
        borderRadius: 10,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        marginBottom: 16,
      }}>
        {result.passed
          ? <CheckCircle2 size={20} color="#4ade80" />
          : <XCircle size={20} color="#f87171" />}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: result.passed ? '#4ade80' : '#f87171' }}>
            {result.passed ? 'All tests passed' : 'Tests failed'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
            {testFile} &bull; exit {result.exitCode} &bull; {(result.durationMs / 1000).toFixed(1)}s
            {result.timedOut && ' (timed out)'}
          </div>
        </div>
        {/* Actions */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={onRetry}
            disabled={retrying}
            title="Re-run tests"
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '6px 12px',
              background: 'transparent', border: '1px solid var(--border)',
              borderRadius: 6, color: 'var(--text-muted)', fontSize: 12,
              cursor: retrying ? 'not-allowed' : 'pointer',
            }}
          >
            <RotateCw size={12} style={{ animation: retrying ? 'spin 1s linear infinite' : 'none' }} />
            {retrying ? 'Running…' : 'Retry'}
          </button>

          {!result.passed && (
            <button
              onClick={onDiscussInChat}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '6px 12px',
                background: 'var(--accent)', border: 'none',
                borderRadius: 6, color: '#fff', fontSize: 12,
                cursor: 'pointer', fontWeight: 600,
              }}
            >
              <MessageSquare size={12} /> Discuss in Chat
            </button>
          )}
        </div>
      </div>

      {/* Command */}
      <div style={{ marginBottom: 12, padding: '6px 10px', background: 'var(--bg-message)', border: '1px solid var(--border)', borderRadius: 6 }}>
        <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Command</span>
        <pre style={{ margin: '4px 0 0', fontSize: 11, color: '#e8d5b0', fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{result.command}</pre>
      </div>

      {/* Stdout */}
      {result.stdout && (
        <div style={{ marginBottom: 10, border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
          <button
            onClick={() => setShowStdout((v) => !v)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 12px', background: 'var(--bg-message)', border: 'none',
              cursor: 'pointer', color: 'var(--text-primary)', fontSize: 12, fontWeight: 600,
            }}
          >
            <span>stdout</span>
            {showStdout ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {showStdout && (
            <pre style={{
              margin: 0, padding: '10px 14px', fontSize: 11, lineHeight: 1.6,
              color: '#e8d5b0', fontFamily: 'monospace', whiteSpace: 'pre-wrap',
              maxHeight: 360, overflowY: 'auto', background: '#0e0a06',
            }}>
              {result.stdout}
            </pre>
          )}
        </div>
      )}

      {/* Stderr */}
      {result.stderr && (
        <div style={{ border: '1px solid #5c2020', borderRadius: 8, overflow: 'hidden' }}>
          <button
            onClick={() => setShowStderr((v) => !v)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 12px', background: '#2d1515', border: 'none',
              cursor: 'pointer', color: '#fca5a5', fontSize: 12, fontWeight: 600,
            }}
          >
            <span>stderr (errors)</span>
            {showStderr ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {showStderr && (
            <pre style={{
              margin: 0, padding: '10px 14px', fontSize: 11, lineHeight: 1.6,
              color: '#fca5a5', fontFamily: 'monospace', whiteSpace: 'pre-wrap',
              maxHeight: 360, overflowY: 'auto', background: '#200a0a',
            }}>
              {result.stderr}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function TestsPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('generate');
  const [filePath, setFilePath] = useState('');
  const [framework, setFramework] = useState('jest');
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const [testResult, setTestResult] = useState<GeneratedTestResult | null>(null);
  const [runResult, setRunResult] = useState<TestRunResult | null>(null);

  const activeRepoId = () => loadSettings().activeRepoId ?? '';

  // ── Generate ──────────────────────────────────────────────────────────────

  const handleGenerate = async () => {
    const repoId = activeRepoId();
    if (!repoId) { setError('No active repo selected. Go to Settings.'); return; }
    if (!filePath.trim()) { setError('Enter a file path.'); return; }

    setError('');
    setLoading(true);
    setTestResult(null);
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

  // ── Write to disk & run ───────────────────────────────────────────────────

  const handleWriteAndRun = async () => {
    if (!testResult) return;
    const repoId = activeRepoId();
    if (!repoId) { setError('No active repo selected.'); return; }

    setError('');
    setRunning(true);

    try {
      const result = await writeAndRunTest({ repoId, testgenId: testResult.testgenId });
      setRunResult(result);
      setTab('results');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to write and run tests');
    } finally {
      setRunning(false);
    }
  };

  // ── Retry ─────────────────────────────────────────────────────────────────

  const handleRetry = async () => {
    if (!testResult) return;
    const repoId = activeRepoId();
    if (!repoId) return;

    setError('');
    setRunning(true);

    try {
      const result = await writeAndRunTest({ repoId, testgenId: testResult.testgenId });
      setRunResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Retry failed');
    } finally {
      setRunning(false);
    }
  };

  // ── Discuss in Chat ───────────────────────────────────────────────────────

  const handleDiscussInChat = () => {
    if (!runResult || !testResult) return;
    const context = encodeURIComponent(
      `My test file \`${testResult.testFile}\` for \`${testResult.targetFile}\` is failing.\n\n` +
      `**Command:** ${runResult.command}\n` +
      `**Exit code:** ${runResult.exitCode}\n\n` +
      `**Stderr:**\n\`\`\`\n${runResult.stderr?.slice(0, 2000) ?? 'none'}\n\`\`\`\n\n` +
      `**Stdout:**\n\`\`\`\n${runResult.stdout?.slice(0, 1000) ?? 'none'}\n\`\`\`\n\n` +
      `Please help me understand why these tests are failing and how to fix them.`,
    );
    router.push(`/chat?prefill=${context}`);
  };

  const handleCopy = async () => {
    if (!testResult) return;
    await navigator.clipboard.writeText(testResult.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Tab style ─────────────────────────────────────────────────────────────

  const tabStyle = (t: Tab) => ({
    padding: '6px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' as const,
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
          <button style={tabStyle('results')} onClick={() => setTab('results')} disabled={!runResult}>
            Results
            {runResult && (
              <span style={{
                marginLeft: 6, fontSize: 10, fontWeight: 700,
                background: runResult.passed ? '#4ade80' : '#f87171',
                color: '#000', borderRadius: 10, padding: '1px 6px',
              }}>
                {runResult.passed ? 'PASS' : 'FAIL'}
              </span>
            )}
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>

          {error && (
            <div style={{ padding: '10px 14px', background: '#2d1515', border: '1px solid #5c2020', borderRadius: 8, color: '#fca5a5', fontSize: 13, marginBottom: 16 }}>
              {error}
            </div>
          )}

          {/* ── Generate tab ─────────────────────────────────────────────── */}
          {tab === 'generate' && (
            <div>
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>File path</label>
                <input
                  value={filePath}
                  onChange={(e) => setFilePath(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') void handleGenerate(); }}
                  placeholder="src/developer/developer.service.ts"
                  style={{
                    width: '100%', boxSizing: 'border-box', padding: '8px 12px',
                    background: 'var(--bg-input)', border: '1px solid var(--border)',
                    borderRadius: 7, fontSize: 13, color: 'var(--text-primary)',
                    outline: 'none', fontFamily: 'monospace',
                  }}
                />
              </div>

              <div style={{ marginBottom: 18 }}>
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
                        color: framework === fw ? '#fff' : 'var(--text-muted)', fontWeight: 600,
                      }}
                    >{fw}</button>
                  ))}
                </div>
              </div>

              <button
                onClick={() => void handleGenerate()}
                disabled={loading}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '9px 20px',
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

          {/* ── View tab ─────────────────────────────────────────────────── */}
          {tab === 'view' && testResult && (
            <div>
              {/* Meta */}
              <div style={{ display: 'flex', gap: 20, marginBottom: 14, flexWrap: 'wrap' }}>
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
              <div style={{ background: '#1e1410', border: '1px solid #3a2418', borderRadius: 8, overflow: 'hidden', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 12px', borderBottom: '1px solid #3a2418' }}>
                  <span style={{ fontSize: 11, color: '#9a8070' }}>{testResult.testFile}</span>
                  <button
                    onClick={() => void handleCopy()}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px',
                      background: copied ? '#2a4a2a' : 'transparent',
                      border: `1px solid ${copied ? '#3a6a3a' : '#3a2418'}`,
                      borderRadius: 4, color: copied ? '#7ec87e' : '#9a8070', fontSize: 11, cursor: 'pointer',
                    }}
                  >
                    {copied ? <Check size={11} /> : <Copy size={11} />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <pre style={{
                  margin: 0, padding: '12px 16px', fontSize: 11, lineHeight: 1.7,
                  color: '#e8d5b0', fontFamily: 'monospace', whiteSpace: 'pre',
                  overflowX: 'auto', maxHeight: 400, overflowY: 'auto',
                }}>
                  {testResult.content}
                </pre>
              </div>

              {/* Covered scenarios */}
              {testResult.coveredScenarios?.length > 0 && (
                <div style={{ marginBottom: 14, padding: '10px 14px', background: 'var(--bg-message)', border: '1px solid var(--border)', borderRadius: 8 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Covered Scenarios</div>
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {testResult.coveredScenarios.map((s, i) => (
                      <li key={i} style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.6 }}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Write to disk & Run CTA */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', background: '#0a1020', border: '1px solid #2a3a6a', borderRadius: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#60a5fa', marginBottom: 2 }}>Ready to run</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    This will write <code style={{ fontFamily: 'monospace' }}>{testResult.testFile}</code> to your project and run it.
                  </div>
                </div>
                <button
                  onClick={() => void handleWriteAndRun()}
                  disabled={running}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px',
                    background: running ? '#2a3a6a' : '#1f5a8a',
                    border: '1px solid #3a6aaa', borderRadius: 7,
                    color: '#fff', fontSize: 13, cursor: running ? 'not-allowed' : 'pointer', fontWeight: 600,
                    whiteSpace: 'nowrap',
                  }}
                >
                  <Play size={13} />
                  {running ? 'Writing & Running…' : 'Write to Disk & Run'}
                </button>
              </div>
            </div>
          )}

          {/* ── Results tab ───────────────────────────────────────────────── */}
          {tab === 'results' && runResult && testResult && (
            <TestResultPanel
              result={runResult}
              testFile={testResult.testFile}
              onRetry={() => void handleRetry()}
              onDiscussInChat={handleDiscussInChat}
              retrying={running}
            />
          )}

        </div>
      </div>
    </div>
  );
}
