'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { MessageSquare, BookOpen, GitBranch, Settings, LogOut, UserCircle2, ShieldCheck, FlaskConical, Bell } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { usePendingApprovals } from '@/lib/usePendingApprovals';

const NAV_ITEMS = [
  { href: '/chat', icon: MessageSquare, label: 'Chat' },
  { href: '/review', icon: ShieldCheck, label: 'Review' },
  { href: '/tests', icon: FlaskConical, label: 'Tests' },
  { href: '/approvals', icon: Bell, label: 'Approvals' },
  { href: '/knowledge', icon: BookOpen, label: 'Knowledge' },
  { href: '/repos', icon: GitBranch, label: 'Repos' },
  { href: '/settings', icon: Settings, label: 'Settings' },
];

export default function AppNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout, ready } = useAuth();
  const { count: pendingCount } = usePendingApprovals();

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const iconBtn = (style?: React.CSSProperties) => ({
    width: 38,
    height: 38,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 7,
    border: 'none',
    background: 'transparent',
    color: 'var(--text-muted)' as string,
    cursor: 'pointer',
    transition: 'color 0.15s, background 0.15s',
    ...style,
  });

  return (
    <div
      style={{
        width: 56,
        background: 'var(--bg-sidebar)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        flexShrink: 0,
        paddingTop: 10,
        paddingBottom: 14,
        gap: 4,
      }}
    >
      {/* Logo */}
      <Image
        src="/buntufin2-1.png"
        alt="Buntu Fin"
        width={38}
        height={38}
        style={{ objectFit: 'contain', marginBottom: 12, flexShrink: 0 }}
      />

      {/* Nav links */}
      {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
        const active = pathname === href || (pathname?.startsWith(href + '/') ?? false);
        const showBadge = href === '/approvals' && pendingCount > 0;
        return (
          <Link
            key={href}
            href={href}
            title={label}
            style={{
              position: 'relative',
              width: 38,
              height: 38,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 7,
              color: active ? '#f2ece6' : 'var(--text-muted)',
              background: active ? 'var(--accent)' : 'transparent',
              textDecoration: 'none',
              transition: 'color 0.15s, background 0.15s',
            }}
            onMouseEnter={(e) => {
              if (!active) {
                (e.currentTarget as HTMLElement).style.color = 'var(--text-subtle)';
                (e.currentTarget as HTMLElement).style.background = '#3d1f15';
              }
            }}
            onMouseLeave={(e) => {
              if (!active) {
                (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)';
                (e.currentTarget as HTMLElement).style.background = 'transparent';
              }
            }}
          >
            <Icon size={17} />
            {showBadge && (
              <span style={{
                position: 'absolute', top: 4, right: 4,
                width: 8, height: 8, borderRadius: '50%',
                background: '#f97316', border: '1px solid var(--bg-sidebar)',
                pointerEvents: 'none',
              }} />
            )}
          </Link>
        );
      })}

      {/* Bottom section: user avatar + logout */}
      <div style={{ flex: 1 }} />

      {ready && user ? (
        <>
          {/* User initials avatar */}
          <div
            title={`${user.name} (${user.email})`}
            style={{
              width: 30,
              height: 30,
              borderRadius: '50%',
              background: 'var(--accent)',
              border: '1px solid var(--accent-hover)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 11,
              fontWeight: 700,
              color: '#fff',
              userSelect: 'none',
              marginBottom: 2,
            }}
          >
            {user.name.slice(0, 2).toUpperCase()}
          </div>
          <button
            onClick={handleLogout}
            title="Sign out"
            style={iconBtn()}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.color = '#f87171';
              (e.currentTarget as HTMLElement).style.background = '#2a1010';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)';
              (e.currentTarget as HTMLElement).style.background = 'transparent';
            }}
          >
            <LogOut size={15} />
          </button>
        </>
      ) : ready ? (
        <Link
          href="/login"
          title="Sign in"
          style={{ ...iconBtn(), textDecoration: 'none', width: 30, height: 30, borderRadius: '50%', border: '1px dashed var(--border)' }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.color = 'var(--text-subtle)';
            (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)';
            (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)';
          }}
        >
          <UserCircle2 size={18} />
        </Link>
      ) : null}

      <span
        style={{
          fontSize: 8,
          color: 'var(--text-muted)',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          writingMode: 'vertical-lr',
          transform: 'rotate(180deg)',
          userSelect: 'none',
          marginTop: 6,
        }}
      >
        buntu fin
      </span>
    </div>
  );
}
