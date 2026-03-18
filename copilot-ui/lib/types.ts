export type MessageRole = 'user' | 'assistant';

// ─── Code review types ────────────────────────────────────────────────────────

export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type ReviewCategory =
  | 'SECURITY'
  | 'PERFORMANCE'
  | 'CORRECTNESS'
  | 'MAINTAINABILITY'
  | 'STYLE'
  | 'TESTING'
  | 'ERROR_HANDLING';

export interface ReviewFinding {
  severity: Severity;
  category: ReviewCategory;
  title: string;
  description: string;
  filePath: string;
  lineStart?: number;
  lineEnd?: number;
  suggestion: string;
  codeSnippet?: string;
}

export interface CodeReview {
  runId: string;
  reviewId: string;
  filePath: string;
  summary: string;
  overallRisk: Severity | 'NONE';
  findings: ReviewFinding[];
  positives: string[];
  testingRecommendations: string[];
  durationMs: number;
}

// ─── Test generation / run types ─────────────────────────────────────────────

export interface GeneratedTestResult {
  runId: string;
  testgenId: string;
  targetFile: string;
  testFile: string;
  content: string;
  framework: string;
  testCount: number;
  coveredScenarios: string[];
  setupNotes: string;
  mockedDependencies: string[];
  durationMs: number;
}

export interface ApprovalRequest {
  id: string;
  runId: string | null;
  patchId: string | null;
  prDraftId: string | null;
  testgenId: string | null;
  status: 'WAITING' | 'APPROVED' | 'REJECTED';
  riskLevel: Severity;
  reason: string;
  reviewedBy: string | null;
  reviewNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TestRunResult {
  id: string;
  runId: string | null;
  testRunResultId: string;
  testgenId: string;
  passed: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  timedOut: boolean;
  command: string;
}

// ─── Agent action (carried in chat messages) ──────────────────────────────────

export interface AgentAction {
  type: 'review' | 'generate_tests' | 'explain';
  data: CodeReview | GeneratedTestResult | Record<string, unknown>;
}

// ─── Tool step (one tool call made by the agent) ──────────────────────────────

export interface ToolStep {
  toolName: string;
  label: string;
  input: Record<string, unknown>;
  output: string;
  success: boolean;
}

// ─── Chat types ───────────────────────────────────────────────────────────────

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  relevantFiles?: string[];
  sources?: string[];
  timestamp: Date;
  error?: boolean;
  agentAction?: AgentAction;
  toolSteps?: ToolStep[];
}

export interface ChatApiResponse {
  reply: string;
  relevantFiles: string[];
  sources: string[];
  runId: string;
  sessionId: string;
  durationMs: number;
  agentAction?: AgentAction;
  toolSteps?: ToolStep[];
}

export interface Repo {
  id: string;
  name: string;
  fullName: string;
  cloneUrl: string;
  defaultBranch: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RepoIndex {
  id: string;
  repoId: string;
  status: string;
  totalFiles: number | null;
  indexedFiles: number | null;
  createdAt: string;
}

export interface KnowledgeSource {
  id: string;
  title: string;
  sourceType: string;
  sourceRef: string;
  checksum: string;
  tags: string[];
  wordCount: number;
  isActive: boolean;
  chunkCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface IngestResult {
  sourceId: string;
  title: string;
  sourceType: string;
  chunksCreated: number;
  isDuplicate: boolean;
  checksum: string;
}

export interface ApiSuccessEnvelope<T> {
  success: true;
  data: T;
  message: string;
  statusCode: number;
  timestamp: string;
}

export interface ApiErrorEnvelope {
  success: false;
  message: string;
  statusCode: number;
}

export type ApiEnvelope<T> = ApiSuccessEnvelope<T> | ApiErrorEnvelope;

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

// ─── Agent Task types ─────────────────────────────────────────────────────────

export type AgentTaskStatus =
  | 'AWAITING_PLAN_APPROVAL'
  | 'PLAN_APPROVED'
  | 'PLAN_REJECTED'
  | 'RUNNING'
  | 'AWAITING_STEP_APPROVAL'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

export type AgentTaskStepStatus =
  | 'PENDING'
  | 'AWAITING_APPROVAL'
  | 'APPROVED'
  | 'RUNNING'
  | 'COMPLETED'
  | 'FAILED'
  | 'SKIPPED';

export type AgentMemoryType = 'FACT' | 'OBSERVATION' | 'DECISION' | 'INSIGHT' | 'RESEARCH';

export interface AgentTaskStep {
  id: string;
  taskId: string;
  stepIndex: number;
  title: string;
  description: string;
  toolName: string | null;
  toolInputHint: string | null;
  requiresApproval: boolean;
  reasoning: string;
  status: AgentTaskStepStatus;
  toolInput: Record<string, unknown> | null;
  toolOutput: Record<string, unknown> | null;
  observation: string | null;
  errorMessage: string | null;
  approvalId: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface AgentMemory {
  id: string;
  repoId: string | null;
  taskId: string | null;
  type: AgentMemoryType;
  subject: string;
  content: string;
  confidence: number;
  tags: string[];
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AgentTaskPlan {
  taskSummary?: string;
  planReasoning?: string;
  estimatedRiskLevel?: string;
  steps: AgentTaskStep[];
}

export interface AgentTask {
  id: string;
  repoId: string | null;
  goal: string;           // alias for title in backend response
  userPrompt: string;
  status: AgentTaskStatus;
  currentStepIndex: number;
  totalSteps: number;
  planJson: AgentTaskPlan | null;
  planApprovalId: string | null;
  error: string | null;
  errorMessage: string | null;
  completedAt: string | null;
  createdAt: string;
  steps?: AgentTaskStep[];
  memories?: AgentMemory[];
}

export interface CreateAgentTaskDto {
  goal: string;
  repoId?: string;
  context?: string;
  pathPrefix?: string;
}

export interface ChatSession {
  id: string;
  repoId: string | null;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

export interface ChatSessionMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}
