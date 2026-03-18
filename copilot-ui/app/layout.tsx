import type { Metadata } from 'next';
import './globals.css';
import AppNav from '@/components/AppNav';
import { AuthProvider } from '@/lib/AuthContext';

export const metadata: Metadata = {
  title: 'Buntu Fin',
  description: 'AI engineering copilot for Buntu Finance',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body suppressHydrationWarning style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
        <AuthProvider>
          <AppNav />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
            {children}
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
