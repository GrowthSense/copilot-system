'use client';

import { useState } from 'react';
import { ToolStep } from '@/lib/types';
import {
  ChevronDown,
  ChevronRight,
  CheckCircle,
  XCircle,
  FileText,
  FileEdit,
  Search,
  Terminal,
  Globe,
  FolderPlus,
  GitMerge,
  Zap,
} from 'lucide-react';

interface Props {
  steps: ToolStep[];
}

function toolIcon(name: string) {
  const size = 12;
  if (name === 'write_file' || name === 'create_directory') return <FileEdit size={size} />;
  if (name.startsWith('read')) return <FileText size={size} />;
  if (name === 'search_files' || name === 'grep_code') return <Search size={size} />;
  if (name === 'run_tests' || name === 'run_command' || name === 'run_lint') return <Terminal size={size} />;
  if (name === 'web_research' || name === 'web_fetch') return <Globe size={size} />;
  if (name === 'generate_diff') return <GitMerge size={size} />;
  if (name === 'scaffold_project') return <FolderPlus size={size} />;
  return <Zap size={size} />;
}

function StepRow({ step }: { step: ToolStep }) {
  const [open, setOpen] = useState(false);

  let outputPreview: string;
  try {
    const parsed = JSON.parse(step.output);
    if (typeof parsed === 'object' && parsed !== null) {
      // Show just the top-level keys as a summary
      const summary = Object.entries(parsed)
        .slice(0, 3)
        .map(([k, v]) => {
          const val = typeof v === 'string' ? `"${v.slice(0, 40)}${v.length > 40 ? '…' : ''}"` : JSON.stringify(v);
          return `${k}: ${val}`;
        })
        .join(', ');
      outputPreview = `{ ${summary}${Object.keys(parsed).length > 3 ? ', …' : ''} }`;
    } else {
      outputPreview = String(parsed).slice(0, 80);
    }
  } catch {
    outputPreview = step.output.slice(0, 80);
  }

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          width: '100%',
          background: 'transparent',
          border: 'none',
          padding: '4px 0',
          cursor: 'pointer',
          textAlign: 'left',
          color: 'var(--text-subtle)',
          fontSize: 12,
        }}
      >
        {/* Status icon */}
        {step.success
          ? <CheckCircle size={13} color="#4ade80" style={{ flexShrink: 0 }} />
          : <XCircle size={13} color="#f87171" style={{ flexShrink: 0 }} />}

        {/* Tool icon */}
        <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
          {toolIcon(step.toolName)}
        </span>

        {/* Label */}
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {step.label}
        </span>

        {/* Expand toggle */}
        <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
          {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </span>
      </button>

      {open && (
        <div
          style={{
            marginLeft: 19,
            marginBottom: 4,
            background: 'var(--bg-base)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            padding: '6px 10px',
            fontSize: 11,
            fontFamily: 'monospace',
            color: 'var(--text-muted)',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
            maxHeight: 200,
            overflowY: 'auto',
          }}
        >
          <div style={{ marginBottom: 4, color: 'var(--text-subtle)', fontFamily: 'inherit', fontWeight: 600 }}>
            Input
          </div>
          {JSON.stringify(step.input, null, 2)}
          <div style={{ marginTop: 8, marginBottom: 4, color: 'var(--text-subtle)', fontFamily: 'inherit', fontWeight: 600 }}>
            Output
          </div>
          {outputPreview}
        </div>
      )}
    </div>
  );
}

export default function ToolSteps({ steps }: Props) {
  const [expanded, setExpanded] = useState(false);

  if (!steps.length) return null;

  const successCount = steps.filter((s) => s.success).length;
  const failCount = steps.length - successCount;

  return (
    <div
      style={{
        marginTop: 8,
        background: '#0d1117',
        border: '1px solid #21262d',
        borderRadius: 8,
        overflow: 'hidden',
      }}
    >
      {/* Header — always visible */}
      <button
        onClick={() => setExpanded((v) => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          width: '100%',
          padding: '7px 12px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
          borderBottom: expanded ? '1px solid #21262d' : 'none',
        }}
      >
        <Terminal size={13} color="var(--accent)" />
        <span style={{ fontSize: 12, color: 'var(--text-subtle)', fontWeight: 500 }}>
          {steps.length} agent step{steps.length !== 1 ? 's' : ''}
        </span>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          {successCount > 0 && (
            <span style={{ fontSize: 11, color: '#4ade80' }}>
              ✓ {successCount}
            </span>
          )}
          {failCount > 0 && (
            <span style={{ fontSize: 11, color: '#f87171' }}>
              ✗ {failCount}
            </span>
          )}
          <span style={{ color: 'var(--text-muted)' }}>
            {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          </span>
        </span>
      </button>

      {/* Expanded step list */}
      {expanded && (
        <div style={{ padding: '6px 12px 8px' }}>
          {steps.map((step, i) => (
            <StepRow key={i} step={step} />
          ))}
        </div>
      )}
    </div>
  );
}
