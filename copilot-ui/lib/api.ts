import { ChatApiResponse, ApiEnvelope, Repo, RepoIndex, KnowledgeSource, IngestResult, ChatSession, ChatSessionMessage, AuthResponse, CodeReview, GeneratedTestResult, ApprovalRequest, TestRunResult } from './types';
import { loadSettings } from './settings';
import { getToken } from './auth';

function getApiUrl(): string {
  if (typeof window !== 'undefined') {
    return loadSettings().apiUrl;
  }
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

function baseHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (typeof window !== 'undefined') {
    const ghToken = loadSettings().githubToken;
    if (ghToken) headers['x-github-token'] = ghToken;
    const jwt = getToken();
    if (jwt) headers['Authorization'] = `Bearer ${jwt}`;
  }
  return headers;
}

async function unwrap<T>(res: Response): Promise<T> {
  const json: ApiEnvelope<T> = await res.json();
  if (!json.success) throw new Error((json as { message: string }).message ?? 'Request failed');
  return (json as { success: true; data: T }).data;
}

// ─── Chat ───────────────────────────────────────────────────────────────────

export async function sendChatMessage(
  sessionId: string,
  repoId: string,
  message: string,
  signal?: AbortSignal,
): Promise<ChatApiResponse> {
  const res = await fetch(`${getApiUrl()}/api/v1/chat`, {
    method: 'POST',
    headers: baseHeaders(),
    body: JSON.stringify({ sessionId, repoId, message }),
    signal,
  });
  return unwrap<ChatApiResponse>(res);
}

// ─── Auth ────────────────────────────────────────────────────────────────────

export async function authRegister(data: { email: string; name: string; password: string }): Promise<AuthResponse> {
  const res = await fetch(`${getApiUrl()}/api/v1/auth/register`, {
    method: 'POST',
    headers: baseHeaders(),
    body: JSON.stringify(data),
  });
  return unwrap<AuthResponse>(res);
}

export async function authLogin(data: { email: string; password: string }): Promise<AuthResponse> {
  const res = await fetch(`${getApiUrl()}/api/v1/auth/login`, {
    method: 'POST',
    headers: baseHeaders(),
    body: JSON.stringify(data),
  });
  return unwrap<AuthResponse>(res);
}

export async function authMe(): Promise<{ id: string; email: string; name: string; createdAt: string }> {
  const res = await fetch(`${getApiUrl()}/api/v1/auth/me`, { headers: baseHeaders() });
  return unwrap(res);
}

export async function getFileContent(repoId: string, filePath: string): Promise<{ filePath: string; content: string; language: string | null }> {
  const res = await fetch(
    `${getApiUrl()}/api/v1/repos/${repoId}/file-content?path=${encodeURIComponent(filePath)}`,
    { headers: baseHeaders() },
  );
  return unwrap(res);
}

// ─── Chat sessions ────────────────────────────────────────────────────────────

export async function listChatSessions(repoId?: string): Promise<ChatSession[]> {
  const url = repoId
    ? `${getApiUrl()}/api/v1/chat/sessions?repoId=${encodeURIComponent(repoId)}`
    : `${getApiUrl()}/api/v1/chat/sessions`;
  const res = await fetch(url, { headers: baseHeaders() });
  return unwrap<ChatSession[]>(res);
}

export async function getChatMessages(sessionId: string): Promise<ChatSessionMessage[]> {
  const res = await fetch(`${getApiUrl()}/api/v1/chat/sessions/${sessionId}/messages`, {
    headers: baseHeaders(),
  });
  return unwrap<ChatSessionMessage[]>(res);
}

// ─── Repos ──────────────────────────────────────────────────────────────────

export async function listRepos(): Promise<Repo[]> {
  const res = await fetch(`${getApiUrl()}/api/v1/repos`, { headers: baseHeaders() });
  return unwrap<Repo[]>(res);
}

export async function registerRepo(data: {
  name: string;
  fullName: string;
  cloneUrl: string;
  defaultBranch?: string;
  description?: string;
}): Promise<Repo> {
  const res = await fetch(`${getApiUrl()}/api/v1/repos`, {
    method: 'POST',
    headers: baseHeaders(),
    body: JSON.stringify(data),
  });
  return unwrap<Repo>(res);
}

export async function updateRepo(id: string, data: {
  name?: string;
  cloneUrl?: string;
  description?: string;
  defaultBranch?: string;
}): Promise<Repo> {
  const res = await fetch(`${getApiUrl()}/api/v1/repos/${id}`, {
    method: 'PATCH',
    headers: baseHeaders(),
    body: JSON.stringify(data),
  });
  return unwrap<Repo>(res);
}

export async function deleteRepo(id: string): Promise<void> {
  const res = await fetch(`${getApiUrl()}/api/v1/repos/${id}`, {
    method: 'DELETE',
    headers: baseHeaders(),
  });
  await unwrap(res);
}

export async function startRepoIndex(repoId: string, localPath: string): Promise<RepoIndex> {
  const res = await fetch(`${getApiUrl()}/api/v1/repos/${repoId}/indexes`, {
    method: 'POST',
    headers: baseHeaders(),
    body: JSON.stringify({ localPath }),
  });
  return unwrap<RepoIndex>(res);
}

export async function getLatestRepoIndex(repoId: string): Promise<RepoIndex | null> {
  const res = await fetch(`${getApiUrl()}/api/v1/repos/${repoId}/indexes/latest`, {
    headers: baseHeaders(),
  });
  if (res.status === 404) return null;
  return unwrap<RepoIndex>(res);
}

// ─── Knowledge ──────────────────────────────────────────────────────────────

export async function listKnowledgeSources(): Promise<KnowledgeSource[]> {
  const res = await fetch(`${getApiUrl()}/api/v1/knowledge/sources`, { headers: baseHeaders() });
  return unwrap<KnowledgeSource[]>(res);
}

export async function ingestText(data: {
  content: string;
  title: string;
  sourceRef?: string;
  tags?: string[];
}): Promise<IngestResult> {
  const res = await fetch(`${getApiUrl()}/api/v1/knowledge/sources/text`, {
    method: 'POST',
    headers: baseHeaders(),
    body: JSON.stringify({ ...data, sourceRef: data.sourceRef ?? data.title }),
  });
  return unwrap<IngestResult>(res);
}

export async function ingestUrl(data: {
  url: string;
  title?: string;
  tags?: string[];
}): Promise<IngestResult> {
  const res = await fetch(`${getApiUrl()}/api/v1/knowledge/sources/url`, {
    method: 'POST',
    headers: baseHeaders(),
    body: JSON.stringify(data),
  });
  return unwrap<IngestResult>(res);
}

export async function ingestMarkdown(data: {
  content: string;
  title: string;
  sourceRef?: string;
  tags?: string[];
}): Promise<IngestResult> {
  const res = await fetch(`${getApiUrl()}/api/v1/knowledge/sources/markdown`, {
    method: 'POST',
    headers: baseHeaders(),
    body: JSON.stringify({ ...data, sourceRef: data.sourceRef ?? data.title }),
  });
  return unwrap<IngestResult>(res);
}

export async function deleteKnowledgeSource(id: string): Promise<void> {
  const res = await fetch(`${getApiUrl()}/api/v1/knowledge/sources/${id}`, {
    method: 'DELETE',
    headers: baseHeaders(),
  });
  await unwrap(res);
}

// ─── Code Review ─────────────────────────────────────────────────────────────

export async function reviewCode(data: {
  repoId: string;
  filePath: string;
  focusAreas?: string[];
  additionalContext?: string;
}): Promise<CodeReview> {
  const res = await fetch(`${getApiUrl()}/api/v1/agent/review`, {
    method: 'POST',
    headers: baseHeaders(),
    body: JSON.stringify(data),
  });
  return unwrap<CodeReview>(res);
}

// ─── Test generation ─────────────────────────────────────────────────────────

export async function generateTestsForFile(data: {
  repoId: string;
  filePath: string;
  framework?: string;
  additionalContext?: string;
}): Promise<GeneratedTestResult> {
  const res = await fetch(`${getApiUrl()}/api/v1/agent/generate-tests`, {
    method: 'POST',
    headers: baseHeaders(),
    body: JSON.stringify(data),
  });
  return unwrap<GeneratedTestResult>(res);
}

export async function listGeneratedTests(repoId: string): Promise<GeneratedTestResult[]> {
  const res = await fetch(`${getApiUrl()}/api/v1/testgen?repoId=${encodeURIComponent(repoId)}`, {
    headers: baseHeaders(),
  });
  return unwrap<GeneratedTestResult[]>(res);
}

export async function getGeneratedTest(id: string): Promise<GeneratedTestResult> {
  const res = await fetch(`${getApiUrl()}/api/v1/testgen/${id}`, { headers: baseHeaders() });
  return unwrap<GeneratedTestResult>(res);
}

// ─── Test running ─────────────────────────────────────────────────────────────

export async function runGeneratedTests(data: {
  repoId: string;
  testgenId: string;
  approvalId: string;
  script?: 'test' | 'test:cov' | 'test:e2e';
  timeoutMs?: number;
}): Promise<TestRunResult> {
  const res = await fetch(`${getApiUrl()}/api/v1/agent/run-tests`, {
    method: 'POST',
    headers: baseHeaders(),
    body: JSON.stringify(data),
  });
  return unwrap<TestRunResult>(res);
}

export async function getTestRunHistory(testgenId: string): Promise<TestRunResult[]> {
  const res = await fetch(
    `${getApiUrl()}/api/v1/testgen/${testgenId}/runs`,
    { headers: baseHeaders() },
  );
  return unwrap<TestRunResult[]>(res);
}

// ─── Approvals ────────────────────────────────────────────────────────────────

export async function createApproval(data: {
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  reason: string;
  testgenId?: string;
  patchId?: string;
}): Promise<ApprovalRequest> {
  const res = await fetch(`${getApiUrl()}/api/v1/approvals`, {
    method: 'POST',
    headers: baseHeaders(),
    body: JSON.stringify(data),
  });
  return unwrap<ApprovalRequest>(res);
}

export async function approveRequest(id: string, reviewedBy = 'user'): Promise<ApprovalRequest> {
  const res = await fetch(`${getApiUrl()}/api/v1/approvals/${id}/approve`, {
    method: 'PATCH',
    headers: baseHeaders(),
    body: JSON.stringify({ reviewedBy }),
  });
  return unwrap<ApprovalRequest>(res);
}

export async function rejectRequest(id: string, reviewedBy = 'user', reviewNotes?: string): Promise<ApprovalRequest> {
  const res = await fetch(`${getApiUrl()}/api/v1/approvals/${id}/reject`, {
    method: 'PATCH',
    headers: baseHeaders(),
    body: JSON.stringify({ reviewedBy, reviewNotes }),
  });
  return unwrap<ApprovalRequest>(res);
}

export async function getPendingApprovals(): Promise<ApprovalRequest[]> {
  const res = await fetch(`${getApiUrl()}/api/v1/approvals/pending`, { headers: baseHeaders() });
  return unwrap<ApprovalRequest[]>(res);
}
