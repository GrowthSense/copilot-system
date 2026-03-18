// ─── Tool calling types ───────────────────────────────────────────────────────

export interface LlmToolDefinition {
  name: string;
  description: string;
  /** JSON Schema object describing the tool's input parameters. */
  inputSchema: Record<string, unknown>;
}

export interface LlmToolCall {
  /** Provider-assigned unique ID for this tool call (used to match results). */
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

// ─── Message types ────────────────────────────────────────────────────────────

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  /** Present on assistant messages when the model wants to call tools. */
  toolCalls?: LlmToolCall[];
  /** Present on tool-role messages — matches the LlmToolCall.id this is a result for. */
  toolCallId?: string;
  /** Tool name — included with tool-role messages for providers that require it. */
  toolName?: string;
}

// ─── Request / Response ───────────────────────────────────────────────────────

export type LlmResponseFormat = 'json_object' | 'text';

export interface LlmCompletionRequest {
  messages: LlmMessage[];
  /** When provided, the model may call these tools and return tool_calls in the response. */
  tools?: LlmToolDefinition[];
  model?: string;
  maxTokens?: number;
  temperature?: number;
  responseFormat?: LlmResponseFormat;
}

export interface LlmCompletionResponse {
  content: string;
  /** Populated when finishReason is 'tool_calls'. */
  toolCalls?: LlmToolCall[];
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  /** 'stop' | 'tool_calls' | 'length' | 'end_turn' */
  finishReason: string;
}

export interface LlmTokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface StructuredCompletionOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
}
