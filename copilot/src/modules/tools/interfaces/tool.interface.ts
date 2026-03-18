/**
 * Legacy tool interfaces — kept for backward compatibility with any existing callers.
 * New code should import from `agent-tool.interface.ts` directly.
 */

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface ToolCall {
  toolName: string;
  parameters: Record<string, unknown>;
}

export interface ToolResult {
  toolName: string;
  success: boolean;
  output: unknown;
  error?: string;
  durationMs: number;
}

// Re-export the canonical interfaces so callers can migrate gradually.
export type {
  IAgentTool,
  AgentToolDefinition,
  ToolInputSchema,
  ToolSchemaProperty,
  ToolExecutionContext,
} from './agent-tool.interface';
