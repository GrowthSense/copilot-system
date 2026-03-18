'use client';

import { useState } from 'react';
import { FileCode } from 'lucide-react';
import FileViewer from './FileViewer';

interface Props {
  path: string;
}

export default function FileReference({ path }: Props) {
  const [open, setOpen] = useState(false);
  const name = path.split('/').pop() ?? path;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title={path}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          padding: '3px 8px',
          background: '#1e1410',
          border: '1px solid #3a2418',
          borderRadius: 5,
          fontSize: 11,
          color: '#a0601f',
          fontFamily: 'monospace',
          cursor: 'pointer',
          transition: 'border-color 0.15s, background 0.15s',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.borderColor = '#a0601f';
          (e.currentTarget as HTMLElement).style.background = '#2a1810';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.borderColor = '#3a2418';
          (e.currentTarget as HTMLElement).style.background = '#1e1410';
        }}
      >
        <FileCode size={11} />
        {name}
      </button>

      {open && <FileViewer filePath={path} onClose={() => setOpen(false)} />}
    </>
  );
}
