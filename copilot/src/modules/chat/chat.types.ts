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

export interface ChatOrchestratorResult {
  reply: string;
  relevantFiles: string[];
  sources: string[];
  agentAction?: ChatAgentAction;
}
