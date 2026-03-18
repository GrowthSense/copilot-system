import { Injectable, Logger } from '@nestjs/common';
import { LlmMessage } from '../llm/interfaces/llm-completion.interface';
import { RepoService } from '../repo/repo.service';
import { ChatMemoryService } from './chat.memory.service';
import { ReactEngine, ReactProgressEvent } from '../agent/react-engine.service';
import { ToolsRegistry } from '../tools/tools.registry';
import { WebResearchTool } from '../web-research/web-research.tool';
import { ChatMessage, ChatOrchestratorResult, ToolStep } from './chat.types';

// ─── Orchestrator ─────────────────────────────────────────────────────────────

@Injectable()
export class ChatOrchestrator {
  private readonly logger = new Logger(ChatOrchestrator.name);

  constructor(
    private readonly repoService: RepoService,
    private readonly memory: ChatMemoryService,
    private readonly reactEngine: ReactEngine,
    private readonly toolsRegistry: ToolsRegistry,
    private readonly webResearchTool: WebResearchTool,
  ) {}

  /**
   * Execute a single agentic chat turn.
   *
   * The LLM has access to ALL tools — it can read any file, write files,
   * run tests, run commands, search the web, and self-correct on errors.
   * It loops until it has a final answer or exhausts tool iterations.
   */
  async chat(
    sessionId: string,
    repoId: string,
    message: string,
    repoName: string,
    pathPrefix?: string,
  ): Promise<ChatOrchestratorResult> {
    // Load prior conversation turns for multi-turn context
    const history = await this.memory.getContextWindow(sessionId);
    const priorHistory = history.map((m: ChatMessage) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    // All tools — registry tools + web_research
    const tools = [
      ...this.toolsRegistry.getAll(),
      this.webResearchTool,
    ];

    const systemPrompt = buildAgentSystemPrompt(repoName, pathPrefix);

    this.logger.log(
      `[ChatOrchestrator] session="${sessionId}" repo="${repoName}" tools=${tools.length} history=${priorHistory.length}`,
    );

    const result = await this.reactEngine.run({
      systemPrompt,
      userMessage: message,
      tools,
      repoId,
      priorHistory,
      maxIterations: 25,
    });

    // Extract tool steps from the ReactEngine history for the UI
    const toolSteps = extractToolSteps(result.history);

    // Collect file paths that were read/written this turn
    const relevantFiles = extractTouchedFiles(result.history);

    return {
      reply: result.answer || "I wasn't able to complete that — please try rephrasing.",
      relevantFiles,
      sources: [],
      toolSteps,
    };
  }

  /**
   * Streaming variant — same as `chat()` but fires `onProgress` on each tool call.
   * The caller is responsible for forwarding events to the client (e.g. via SSE).
   */
  async chatStream(
    sessionId: string,
    repoId: string,
    message: string,
    repoName: string,
    onProgress: (event: ReactProgressEvent) => void,
    pathPrefix?: string,
  ): Promise<ChatOrchestratorResult> {
    const history = await this.memory.getContextWindow(sessionId);
    const priorHistory = history.map((m: ChatMessage) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    const tools = [
      ...this.toolsRegistry.getAll(),
      this.webResearchTool,
    ];

    const systemPrompt = buildAgentSystemPrompt(repoName, pathPrefix);

    const result = await this.reactEngine.run({
      systemPrompt,
      userMessage: message,
      tools,
      repoId,
      priorHistory,
      maxIterations: 25,
      onProgress,
    });

    const toolSteps = extractToolSteps(result.history);
    const relevantFiles = extractTouchedFiles(result.history);

    return {
      reply: result.answer || "I wasn't able to complete that — please try rephrasing.",
      relevantFiles,
      sources: [],
      toolSteps,
    };
  }
}

// ─── System prompt ────────────────────────────────────────────────────────────

function buildAgentSystemPrompt(repoName: string, pathPrefix?: string): string {
  const scope = repoName
    ? pathPrefix
      ? `the "${repoName}" codebase (focused on the \`${pathPrefix}\` folder)`
      : `the "${repoName}" codebase`
    : 'this codebase';

  const nodeVersionMajor = parseInt(process.versions.node.split('.')[0], 10);
  const nodeVersion = process.versions.node;
  const viteVersion = nodeVersionMajor >= 20 ? '6' : '5';
  const nextVersion = nodeVersionMajor >= 18 ? '14' : '13';

  return `You are an expert engineering assistant with FULL ACCESS to ${scope}.

You have tools to:
- CHECK ENVIRONMENT: use \`check_environment\` to get Node.js version and compatible framework versions
- READ files: use \`read_file\`, \`read_files\`, \`search_files\`, \`grep_code\`, \`get_repo_tree\`
- WRITE files: use \`write_file\` to create or modify any file
- CREATE directories: use \`create_directory\`
- SCAFFOLD projects: use \`scaffold_project\` (always pass version= from check_environment first)
- RUN tests: use \`run_tests\` (supports test, test:cov, test:e2e)
- RUN commands: use \`run_command\` (supports install, build, dev, typecheck, etc.)
- SEARCH the web: use \`web_research\`
- FETCH URLs: use \`web_fetch\`
- GENERATE diffs: use \`generate_diff\`
- RUN linting: use \`run_lint\`

RUNTIME ENVIRONMENT:
- Node.js: v${nodeVersion} (major: ${nodeVersionMajor}) — platform: ${process.platform} ${process.arch}
- Recommended: vite@${viteVersion}, next@${nextVersion}
- ALWAYS call check_environment before scaffolding to confirm compatible versions

BEHAVIOUR RULES:
1. Always READ a file before modifying it — never guess at existing content.
2. When asked to write tests: generate the test code then use write_file to write it to disk, then run_tests to verify it passes.
3. When asked to fix a bug: read the file, understand the bug, write the fix, run tests to verify.
4. When tests fail: read the error output, fix the code, run tests again. Retry up to 3 times.
5. After completing changes, summarise exactly what was done (files changed, test results).
6. Use search_files or grep_code to find relevant files before reading them all.
7. Keep changes focused — only modify what is needed for the task.

ERROR RECOVERY RULES:
- When a tool returns {"error": "..."} — read the error, understand why it failed, try a different approach.
- Never give up after one failure — try at least 2 alternative strategies before reporting failure.
- Version incompatibility (e.g. "requires Node 20+"): use the recommended version listed above.
- If scaffold_project fails: fall back to create_directory + write_file to create project files manually.

Answer questions with markdown. Use fenced code blocks with language tags.
When making changes, work systematically: plan → read → write → verify → report.`;
}

// ─── Extract tool steps from ReactEngine history ─────────────────────────────

function extractToolSteps(history: LlmMessage[]): ToolStep[] {
  const steps: ToolStep[] = [];

  for (let i = 0; i < history.length; i++) {
    const msg = history[i];
    if (msg.role !== 'assistant' || !msg.toolCalls?.length) continue;

    for (const call of msg.toolCalls) {
      // Find the matching tool result
      const resultMsg = history.slice(i + 1).find(
        (m) => m.role === 'tool' && m.toolCallId === call.id,
      );

      const output = resultMsg?.content ?? '';
      const success = !output.includes('"error"') || output.includes('"passed":true');

      steps.push({
        toolName: call.name,
        label: formatToolLabel(call.name, call.arguments),
        input: call.arguments,
        output: output.length > 500 ? output.slice(0, 500) + '…' : output,
        success,
      });
    }
  }

  return steps;
}

function formatToolLabel(toolName: string, args: Record<string, unknown>): string {
  switch (toolName) {
    case 'read_file':
      return `Read ${args['filePath'] ?? 'file'}`;
    case 'read_files':
      return `Read ${Array.isArray(args['filePaths']) ? (args['filePaths'] as string[]).length : '?'} files`;
    case 'write_file':
      return `Write ${args['filePath'] ?? 'file'}`;
    case 'create_directory':
      return `Create directory ${args['dirPath'] ?? ''}`;
    case 'search_files':
      return `Search: "${args['query'] ?? ''}"`;
    case 'grep_code':
      return `Grep: "${args['pattern'] ?? ''}"`;
    case 'get_repo_tree':
      return `Get repo tree${args['pathPrefix'] ? ` (${args['pathPrefix']})` : ''}`;
    case 'generate_diff':
      return `Generate diff for ${args['filePath'] ?? 'file'}`;
    case 'run_tests':
      return `Run tests${args['testFile'] ? ` (${args['testFile']})` : ''}`;
    case 'run_lint':
      return `Run lint`;
    case 'run_command':
      return `Run npm ${args['script'] ?? 'command'}`;
    case 'scaffold_project':
      return `Scaffold ${args['projectName'] ?? 'project'}`;
    case 'web_research':
      return `Web search: "${args['query'] ?? ''}"`;
    case 'web_fetch':
      return `Fetch ${args['url'] ?? 'URL'}`;
    default:
      return toolName;
  }
}

function extractTouchedFiles(history: LlmMessage[]): string[] {
  const files = new Set<string>();

  for (const msg of history) {
    if (msg.role !== 'assistant' || !msg.toolCalls?.length) continue;
    for (const call of msg.toolCalls) {
      if (['read_file', 'write_file', 'run_tests'].includes(call.name)) {
        const fp = call.arguments['filePath'] ?? call.arguments['testFile'];
        if (typeof fp === 'string') files.add(fp);
      }
      if (call.name === 'read_files' && Array.isArray(call.arguments['filePaths'])) {
        for (const fp of call.arguments['filePaths'] as string[]) files.add(fp);
      }
    }
  }

  return [...files];
}
