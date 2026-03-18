/**
 * Core interfaces for the tool execution framework.
 *
 * Every tool is a typed, auditable unit of work. The orchestrator
 * (Phase 7) will use `requiresApproval` to decide whether to pause
 * and request human sign-off before calling `ToolsExecutor.execute`.
 */

// ─── Execution context ────────────────────────────────────────────────────────

/** Ambient identifiers passed to every tool so results can be traced back to a run. */
export interface ToolExecutionContext {
  /** AgentRun ID — used to persist a ToolExecution record. Optional for ad-hoc calls. */
  runId?: string;
  /** AgentRunStep ID — links the execution to a specific step within the run. */
  stepId?: string;
}

// ─── Tool definition ──────────────────────────────────────────────────────────

export interface AgentToolDefinition {
  name: string;
  description: string;
  requiresApproval: boolean;
  inputSchema: ToolInputSchema;
}

export interface ToolInputSchema {
  type: 'object';
  properties: Record<string, ToolSchemaProperty>;
  required: string[];
}

export interface ToolSchemaProperty {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  items?: { type: string };
  enum?: string[];
}

// ─── Tool interface ───────────────────────────────────────────────────────────

/**
 * Every tool must implement this interface.
 *
 * Generic parameters:
 *   TInput  — the strongly-typed input the tool accepts
 *   TOutput — the strongly-typed output the tool produces on success
 */
export interface IAgentTool<TInput = unknown, TOutput = unknown> {
  /** Unique machine-readable name used to look the tool up in the registry. */
  readonly name: string;
  /** Human-readable description shown to the LLM and in the tool list endpoint. */
  readonly description: string;
  /**
   * When `true` the executor will include `requiresApproval: true` in the
   * result and the orchestrator should gate execution on an ApprovalRequest.
   */
  readonly requiresApproval: boolean;
  /** Full JSON-schema description of the input — used for LLM function calling. */
  getDefinition(): AgentToolDefinition;
  /** Execute the tool. Throws on unexpected failures (executor catches and wraps). */
  execute(input: TInput, context: ToolExecutionContext): Promise<TOutput>;
}

// ─── Tool result ──────────────────────────────────────────────────────────────

export interface ToolResult<T = unknown> {
  toolName: string;
  success: boolean;
  output: T | null;
  error?: string;
  durationMs: number;
  requiresApproval: boolean;
}
