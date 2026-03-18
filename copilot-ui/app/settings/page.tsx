'use client';

import { useState, useEffect } from 'react';
import { loadSettings, saveSettings } from '@/lib/settings';
import { Key, Server, CheckCircle } from 'lucide-react';

export default function SettingsPage() {
  const [githubToken, setGithubToken] = useState('');
  const [apiUrl, setApiUrl] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const s = loadSettings();
    setGithubToken(s.githubToken);
    setApiUrl(s.apiUrl);
  }, []);

  function handleSave() {
    saveSettings({ githubToken, apiUrl });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '32px 40px', maxWidth: 640 }}>
      <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
        Settings
      </h1>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 32 }}>
        Configure your copilot connection and credentials.
      </p>

      {/* GitHub Token */}
      <section style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <Key size={14} color="var(--text-muted)" />
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
            GitHub Personal Access Token
          </span>
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
          Used to authenticate with GitHub APIs. Needs{' '}
          <code style={{ background: 'var(--bg-input)', padding: '1px 4px', borderRadius: 3 }}>repo</code>{' '}
          scope.
        </p>
        <input
          type="password"
          value={githubToken}
          onChange={(e) => setGithubToken(e.target.value)}
          placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
          style={inputStyle}
        />
      </section>

      {/* API URL */}
      <section style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <Server size={14} color="var(--text-muted)" />
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
            Copilot API URL
          </span>
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
          Base URL of the NestJS backend.
        </p>
        <input
          type="text"
          value={apiUrl}
          onChange={(e) => setApiUrl(e.target.value)}
          placeholder="http://localhost:4000"
          style={inputStyle}
        />
      </section>

      <button
        onClick={handleSave}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          padding: '8px 18px',
          background: saved ? '#666d4a' : 'var(--accent)',
          border: 'none',
          borderRadius: 6,
          color: '#fff',
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'background 0.2s',
        }}
      >
        {saved && <CheckCircle size={14} />}
        {saved ? 'Saved' : 'Save settings'}
      </button>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  background: 'var(--bg-input)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  color: 'var(--text-primary)',
  fontSize: 13,
  fontFamily: 'monospace',
  outline: 'none',
};
