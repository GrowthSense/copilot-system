export type ChatRole = 'user' | 'assistant';

export interface ChatMessage {
  role: ChatRole;
  content: string;
  timestamp: Date;
}

export interface ChatContext {
  repoFiles: Array<{ filePath: string; content: string }>;
  knowledgeChunks: Array<{ title: string; content: string }>;
}

export interface ChatAgentAction {
  type: 'review' | 'generate_tests' | 'explain';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>;
}

/** A single tool call made by the agent during a chat turn. */
export interface ToolStep {
  /** Machine name of the tool, e.g. "write_file", "run_tests". */
  toolName: string;
  /** Human-readable one-line description of what was done. */
  label: string;
  /** Arguments passed to the tool. */
  input: Record<string, unknown>;
  /** Raw JSON output from the tool (truncated for display). */
  output: string;
  /** Whether the tool call returned successfully (no error field in output). */
  success: boolean;
}

export interface ChatOrchestratorResult {
  reply: string;
  relevantFiles: string[];
  sources: string[];
  agentAction?: ChatAgentAction;
  /** Tool calls the agent made this turn — empty if no tools were used. */
  toolSteps?: ToolStep[];
}
