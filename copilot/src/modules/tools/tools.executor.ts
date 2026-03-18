import { Injectable, Logger } from '@nestjs/common';
import { RunsService } from '../runs/runs.service';
import { ToolsRegistry } from './tools.registry';
import { ToolExecutionContext, ToolResult } from './interfaces/agent-tool.interface';

@Injectable()
export class ToolsExecutor {
  private readonly logger = new Logger(ToolsExecutor.name);

  constructor(
    private readonly registry: ToolsRegistry,
    private readonly runsService: RunsService,
  ) {}

  /**
   * Execute a registered tool by name.
   *
   * Execution flow:
   *  1. Look up the tool in the registry.
   *  2. Record start in the log.
   *  3. Call `tool.execute()` and time it.
   *  4. On success or failure, persist a `ToolExecution` record when `runId` is provided.
   *  5. Return a `ToolResult<T>` — never throws.
   */
  async execute<TOutput = unknown>(
    toolName: string,
    input: unknown,
    context: ToolExecutionContext,
  ): Promise<ToolResult<TOutput>> {
    const start = Date.now();

    const tool = this.registry.get(toolName);

    if (!tool) {
      const durationMs = Date.now() - start;
      const result: ToolResult<TOutput> = {
        toolName,
        success: false,
        output: null,
        error: `Unknown tool: "${toolName}". Available tools: ${this.registry.getAll().map((t) => t.name).join(', ')}`,
        durationMs,
        requiresApproval: false,
      };
      await this.persistExecution(context, toolName, input, result);
      return result;
    }

    if (tool.requiresApproval) {
      this.logger.warn(
        `[ToolsExecutor] Tool "${toolName}" requires approval — proceeding (approval gate is enforced by the orchestrator)`,
      );
    }

    this.logger.log(`[ToolsExecutor] START tool="${toolName}" runId=${context.runId ?? 'ad-hoc'}`);

    let result: ToolResult<TOutput>;

    try {
      const output = await tool.execute(input, context);
      const durationMs = Date.now() - start;

      this.logger.log(
        `[ToolsExecutor] SUCCESS tool="${toolName}" durationMs=${durationMs}`,
      );

      result = {
        toolName,
        success: true,
        output: output as TOutput,
        durationMs,
        requiresApproval: tool.requiresApproval,
      };
    } catch (err: unknown) {
      const durationMs = Date.now() - start;
      const errorMessage = err instanceof Error ? err.message : String(err);

      this.logger.error(
        `[ToolsExecutor] FAILURE tool="${toolName}" durationMs=${durationMs} error="${errorMessage}"`,
      );

      result = {
        toolName,
        success: false,
        output: null,
        error: errorMessage,
        durationMs,
        requiresApproval: tool.requiresApproval,
      };
    }

    await this.persistExecution(context, toolName, input, result);
    return result;
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private async persistExecution(
    context: ToolExecutionContext,
    toolName: string,
    input: unknown,
    result: ToolResult,
  ): Promise<void> {
    if (!context.runId) return;

    try {
      await this.runsService.recordToolExecution(context.runId, {
        toolName,
        parameters: (input as Record<string, unknown>) ?? {},
        result: result.output ? (result.output as Record<string, unknown>) : undefined,
        error: result.error,
        isSuccess: result.success,
        durationMs: result.durationMs,
        stepId: context.stepId,
      });
    } catch (persistErr: unknown) {
      // Persistence failures must not propagate — the tool result is already determined.
      this.logger.error(
        `[ToolsExecutor] Failed to persist ToolExecution for tool="${toolName}" runId="${context.runId}": ${persistErr instanceof Error ? persistErr.message : String(persistErr)}`,
      );
    }
  }
}
