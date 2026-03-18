// Settings stored in localStorage

export interface Settings {
  githubToken: string;
  activeRepoId: string;
  activeRepoName: string;
  /** Optional subfolder to restrict AI search to (e.g. "backend/" or "src/"). */
  activePathPrefix: string;
  apiUrl: string;
}

const KEY = 'copilot_settings';

const defaults: Settings = {
  githubToken: '',
  activeRepoId: process.env.NEXT_PUBLIC_REPO_ID ?? '',
  activeRepoName: '',
  activePathPrefix: '',
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000',
};

export function loadSettings(): Settings {
  if (typeof window === 'undefined') return defaults;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaults;
    return { ...defaults, ...JSON.parse(raw) };
  } catch {
    return defaults;
  }
}

export function saveSettings(s: Partial<Settings>): void {
  if (typeof window === 'undefined') return;
  const current = loadSettings();
  localStorage.setItem(KEY, JSON.stringify({ ...current, ...s }));
}
