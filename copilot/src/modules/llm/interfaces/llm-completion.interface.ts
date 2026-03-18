export interface LlmMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export type LlmResponseFormat = 'json_object' | 'text';

export interface LlmCompletionRequest {
  messages: LlmMessage[];
  model?: string;
  maxTokens?: number;
  temperature?: number;
  responseFormat?: LlmResponseFormat;
}

export interface LlmCompletionResponse {
  content: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
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
