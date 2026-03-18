import { BookOpen } from 'lucide-react';

interface Props {
  sources: string[];
}

export default function SourceReference({ sources }: Props) {
  if (sources.length === 0) return null;
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
        <BookOpen size={11} color="var(--text-muted)" />
        <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Sources
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {sources.map((s) => (
          <div key={s} style={{ fontSize: 11, color: '#4b5563', fontFamily: 'monospace' }}>
            · {s}
          </div>
        ))}
      </div>
    </div>
  );
}
