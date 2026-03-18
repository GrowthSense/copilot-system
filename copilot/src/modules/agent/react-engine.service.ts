import { Injectable, Logger } from '@nestjs/common';
import { LlmService } from '../llm/llm.service';
import { IAgentTool } from '../tools/interfaces/agent-tool.interface';
import { LlmMessage, LlmToolDefinition } from '../llm/interfaces/llm-completion.interface';

export interface ReactProgressEvent {
  type: 'tool_start' | 'tool_done';
  toolName: string;
  label: string;
  input?: Record<string, unknown>;
  output?: string;
  success?: boolean;
}

export interface ReactEngineOptions {
  /** System prompt — describes the assistant's role and constraints. */
  systemPrompt: string;
  /** The user's request or the step goal to accomplish. */
  userMessage: string;
  /** Tools the LLM is allowed to call. */
  tools: IAgentTool[];
  /**
   * Injected into every tool call that accepts a repoId field.
   * Tools that don't have a repoId parameter ignore this.
   */
  repoId?: string;
  /** Hard cap on tool-call iterations. Default: 30. */
  maxIterations?: number;
  /** LLM model override. */
  model?: string;
  /**
   * Prior conversation turns to inject between the system prompt and the
   * current user message (used by chat to preserve multi-turn context).
   */
  priorHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
  /**
   * Optional callback fired on each tool call start and completion.
   * Used for streaming progress to the client.
   */
  onProgress?: (event: ReactProgressEvent) => void;
}

export interface ReactEngineResult {
  /** Final text answer from the LLM after all tool calls are done. */
  answer: string;
  /** Total number of successful tool executions. */
  toolCallCount: number;
  /** Number of LLM round-trips (including the final answer turn). */
  iterations: number;
  /** Full conversation log — useful for debugging and step reflection. */
  history: LlmMessage[];
}

/**
 * ReactEngine — the core agentic loop.
 *
 * Mimics how Claude Code works:
 *   1. LLM receives a system prompt, user message, and tool definitions.
 *   2. LLM returns either a final text answer OR a set of tool_calls.
 *   3. Each tool is executed; results are appended to the conversation.
 *   4. Loop continues until the LLM stops calling tools or maxIterations is hit.
 *
 * The LLM fully drives which tools to call, in what order, and how many times —
 * there is no pre-planned sequence.
 */
@Injectable()
export class ReactEngine {
  private readonly logger = new Logger(ReactEngine.name);
  private readonly DEFAULT_MAX_ITERATIONS = 30;

  constructor(private readonly llm: LlmService) {}

  async run(options: ReactEngineOptions): Promise<ReactEngineResult> {
    const maxIter = options.maxIterations ?? this.DEFAULT_MAX_ITERATIONS;

    // Build tool definitions for the LLM
    const toolDefs: LlmToolDefinition[] = options.tools.map((t) => {
      const def = t.getDefinition();
      return {
        name: def.name,
        description: def.description,
        inputSchema: def.inputSchema as unknown as Record<string, unknown>,
      };
    });

    // Seed the conversation (include prior turns for multi-turn chat support)
    const history: LlmMessage[] = [
      { role: 'system', content: options.systemPrompt },
      ...(options.priorHistory ?? []).map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user', content: options.userMessage },
    ];

    let toolCallCount = 0;

    for (let iteration = 0; iteration < maxIter; iteration++) {
      this.logger.debug(
        `ReactEngine iter=${iteration + 1} messages=${history.length} tools=${toolDefs.length}`,
      );

      const response = await this.llm.completeWithTools(history, toolDefs, {
        model: options.model,
      });

      // Append assistant turn to history
      history.push({
        role: 'assistant',
        content: response.content ?? '',
        toolCalls: response.toolCalls,
      });

      // No tool calls → LLM gave its final answer
      if (!response.toolCalls?.length || response.finishReason === 'stop') {
        this.logger.log(
          `ReactEngine done: ${iteration + 1} iterations, ${toolCallCount} tool calls`,
        );
        return {
          answer: response.content ?? '',
          toolCallCount,
          iterations: iteration + 1,
          history,
        };
      }

      // Execute every tool call the LLM requested
      for (const call of response.toolCalls) {
        options.onProgress?.({
          type: 'tool_start',
          toolName: call.name,
          label: formatProgressLabel(call.name, call.arguments),
          input: call.arguments,
        });

        const result = await this.executeTool(call, options.tools, options.repoId);
        const success = !result.startsWith('{"error"');

        options.onProgress?.({
          type: 'tool_done',
          toolName: call.name,
          label: formatProgressLabel(call.name, call.arguments),
          input: call.arguments,
          output: result.length > 300 ? result.slice(0, 300) + '…' : result,
          success,
        });

        history.push({
          role: 'tool',
          toolCallId: call.id,
          toolName: call.name,
          content: result,
        });

        if (!result.startsWith('{"error"')) toolCallCount++;
      }
    }

    // Max iterations reached — return whatever content we have
    this.logger.warn(`ReactEngine hit maxIterations (${maxIter})`);
    const lastAssistant = [...history].reverse().find((m) => m.role === 'assistant');
    return {
      answer:
        lastAssistant?.content ||
        'I was unable to complete this task within the allowed number of steps.',
      toolCallCount,
      iterations: maxIter,
      history,
    };
  }

  private async executeTool(
    call: { id: string; name: string; arguments: Record<string, unknown> },
    tools: IAgentTool[],
    repoId?: string,
  ): Promise<string> {
    const tool = tools.find((t) => t.name === call.name);

    if (!tool) {
      this.logger.warn(`ReactEngine: unknown tool "${call.name}"`);
      return JSON.stringify({ error: `Tool "${call.name}" not found` });
    }

    // Inject repoId into tool input if accepted and not already provided
    const input = { ...call.arguments };
    if (repoId && input['repoId'] === undefined) {
      input['repoId'] = repoId;
    }

    this.logger.debug(`ReactEngine: calling tool "${call.name}" with ${JSON.stringify(input)}`);

    try {
      const output = await tool.execute(input, {});
      return JSON.stringify(output);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`ReactEngine: tool "${call.name}" failed: ${message}`);
      return JSON.stringify({ error: message });
    }
  }
}

// ─── Progress label helper ─────────────────────────────────────────────────

function formatProgressLabel(toolName: string, args: Record<string, unknown>): string {
  const file = (args['filePath'] ?? args['path'] ?? args['query'] ?? args['url'] ?? '') as string;
  const short = file ? ` ${String(file).split('/').pop()}` : '';
  const labels: Record<string, string> = {
    read_file: `Reading${short}`,
    read_files: 'Reading files',
    write_file: `Writing${short}`,
    search_files: `Searching${short || ' files'}`,
    grep_code: `Searching code${short}`,
    get_repo_tree: 'Getting repo structure',
    run_tests: 'Running tests',
    run_lint: 'Running lint',
    run_command: `Running ${(args['script'] as string) ?? 'command'}`,
    scaffold_project: `Scaffolding ${(args['projectName'] as string) ?? 'project'}`,
    generate_diff: 'Generating diff',
    create_directory: `Creating directory${short}`,
    web_fetch: `Fetching${short || ' URL'}`,
    web_research: `Searching web${short ? ` for ${short}` : ''}`,
    check_environment: 'Checking environment',
  };
  return labels[toolName] ?? toolName;
}
