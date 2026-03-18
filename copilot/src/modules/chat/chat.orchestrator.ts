import { Injectable, Logger } from '@nestjs/common';
import { LlmService } from '../llm/llm.service';
import { LlmMessage } from '../llm/interfaces/llm-completion.interface';
import { RetrievalService } from '../knowledge/retrieval.service';
import { RepoSearchService } from '../repo/repo-search.service';
import { RepoService } from '../repo/repo.service';
import { ChatMemoryService } from './chat.memory.service';
import { ChatIntentService } from './chat-intent.service';
import { AgentService } from '../agent/agent.service';
import { ChatMessage, ChatOrchestratorResult } from './chat.types';
import { ChunkResult } from '../knowledge/interfaces/knowledge-source.interface';
import { FileMatchResult } from '../repo/interfaces/repo-index.interface';
import { ReviewCodeOutput } from '../llm/schemas/review-code.schema';
import { GenerateTestsOutput } from '../llm/schemas/generate-tests.schema';

/** Maximum files fetched and read from the repo per chat turn. */
const MAX_FILES = 5;
/** Maximum lines per file sent to the LLM. */
const MAX_FILE_LINES = 150;
/** Maximum characters per file sent to the LLM (~1 500 tokens). */
const MAX_FILE_CHARS = 6_000;
/** Number of knowledge chunks retrieved per turn. */
const MAX_KNOWLEDGE_CHUNKS = 5;

// ─── Orchestrator ─────────────────────────────────────────────────────────────

@Injectable()
export class ChatOrchestrator {
  private readonly logger = new Logger(ChatOrchestrator.name);

  constructor(
    private readonly llm: LlmService,
    private readonly retrieval: RetrievalService,
    private readonly repoSearch: RepoSearchService,
    private readonly repoService: RepoService,
    private readonly memory: ChatMemoryService,
    private readonly intentService: ChatIntentService,
    private readonly agentService: AgentService,
  ) {}

  /**
   * Execute a single chat turn:
   *  1. Load session history
   *  2. Search repo + retrieve knowledge in parallel
   *  3. Read top file contents
   *  4. Build messages with context
   *  5. Call LLM with structured output schema
   *  6. Return typed result
   */
  async chat(
    sessionId: string,
    repoId: string,
    message: string,
    repoName: string,
  ): Promise<ChatOrchestratorResult> {
    const intent = this.intentService.detectIntent(message);
    const filePath = this.intentService.extractFilePath(message);

    // ── Intent: code review ─────────────────────────────────────────────────
    if (intent === 'review' && filePath) {
      try {
        const reviewResult = await this.agentService.review({ repoId, filePath });
        const reply = this.formatReviewAsMarkdown(reviewResult);
        return {
          reply,
          relevantFiles: [filePath],
          sources: [],
          agentAction: { type: 'review', data: reviewResult },
        };
      } catch (err: unknown) {
        this.logger.warn(`[ChatOrchestrator] review intent failed, falling back to chat: ${toMessage(err)}`);
      }
    }

    // ── Intent: generate tests ──────────────────────────────────────────────
    if (intent === 'generate_tests' && filePath) {
      try {
        const testResult = await this.agentService.generateTests({ repoId, filePath });
        const reply = this.formatTestgenAsMarkdown(testResult);
        return {
          reply,
          relevantFiles: [filePath],
          sources: [],
          agentAction: { type: 'generate_tests', data: testResult },
        };
      } catch (err: unknown) {
        this.logger.warn(`[ChatOrchestrator] generate_tests intent failed, falling back to chat: ${toMessage(err)}`);
      }
    }

    // ── Fallback: conversational chat ───────────────────────────────────────
    const history = await this.memory.getContextWindow(sessionId);

    const [candidates, chunks] = await Promise.all([
      this.findRepoFiles(repoId, message),
      this.retrieveKnowledge(message),
    ]);

    const fileContents = await this.readFileContents(repoId, candidates);

    this.logger.debug(
      `[ChatOrchestrator] sessionId="${sessionId}" files=${fileContents.length} chunks=${chunks.length}`,
    );

    const messages = this.buildMessages(repoName, history, message, fileContents, chunks);
    const reply = await this.llm.completeText(messages);

    return {
      reply,
      relevantFiles: fileContents.map((f) => f.filePath),
      sources: chunks.map((c) => c.sourceTitle).filter((t, i, a) => a.indexOf(t) === i),
    };
  }

  // ─── Intent formatting helpers ──────────────────────────────────────────────

  private formatReviewAsMarkdown(result: { filePath: string; summary: string; overallRisk: string; findings: ReviewCodeOutput['findings']; positives: string[]; testingRecommendations: string[] }): string {
    const riskEmoji: Record<string, string> = { CRITICAL: '🔴', HIGH: '🟠', MEDIUM: '🟡', LOW: '🔵', NONE: '🟢' };
    const icon = riskEmoji[result.overallRisk] ?? '⚪';
    const lines: string[] = [
      `## ${icon} Code Review: \`${result.filePath}\``,
      '',
      `**Overall Risk:** ${result.overallRisk}`,
      '',
      result.summary,
    ];

    if (result.findings.length > 0) {
      lines.push('', '### Findings');
      for (const f of result.findings) {
        const sevIcon = riskEmoji[f.severity] ?? '⚪';
        const loc = f.lineStart ? ` (line ${f.lineStart}${f.lineEnd && f.lineEnd !== f.lineStart ? `–${f.lineEnd}` : ''})` : '';
        lines.push('', `**${sevIcon} [${f.severity}] ${f.title}**${loc}`);
        lines.push(f.description);
        lines.push(`> 💡 ${f.suggestion}`);
      }
    }

    if (result.positives.length > 0) {
      lines.push('', '### What\'s done well');
      for (const p of result.positives) lines.push(`- ${p}`);
    }

    if (result.testingRecommendations.length > 0) {
      lines.push('', '### Testing recommendations');
      for (const t of result.testingRecommendations) lines.push(`- ${t}`);
    }

    return lines.join('\n');
  }

  private formatTestgenAsMarkdown(result: { targetFile: string; testFile: string; testCount: number; framework: string; coveredScenarios: string[]; setupNotes: string; testgenId: string }): string {
    const lines: string[] = [
      `## 🧪 Generated Tests: \`${result.targetFile}\``,
      '',
      `**Test file:** \`${result.testFile}\`  `,
      `**Framework:** ${result.framework}  `,
      `**Test count:** ${result.testCount}`,
      '',
      '### Covered scenarios',
    ];
    for (const s of result.coveredScenarios) lines.push(`- ${s}`);
    if (result.setupNotes) {
      lines.push('', '### Setup notes', result.setupNotes);
    }
    lines.push('', `*Test ID: \`${result.testgenId}\` — retrieve via \`GET /api/v1/testgen/${result.testgenId}\`*`);
    return lines.join('\n');
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private async findRepoFiles(repoId: string, query: string): Promise<FileMatchResult[]> {
    try {
      return await this.repoSearch.findCandidates(repoId, { query, topK: MAX_FILES });
    } catch (err: unknown) {
      this.logger.warn(`[ChatOrchestrator] Repo search failed: ${toMessage(err)}`);
      return [];
    }
  }

  private async retrieveKnowledge(query: string): Promise<ChunkResult[]> {
    try {
      return await this.retrieval.retrieve({ query, topK: MAX_KNOWLEDGE_CHUNKS });
    } catch (err: unknown) {
      this.logger.warn(`[ChatOrchestrator] Knowledge retrieval failed: ${toMessage(err)}`);
      return [];
    }
  }

  private async readFileContents(
    repoId: string,
    candidates: FileMatchResult[],
  ): Promise<Array<{ filePath: string; content: string }>> {
    const results: Array<{ filePath: string; content: string }> = [];

    for (const candidate of candidates.slice(0, MAX_FILES)) {
      try {
        const file = await this.repoService.readFileByPath(repoId, candidate.filePath);
        results.push({
          filePath: file.filePath,
          content: truncateContent(file.content, MAX_FILE_LINES, MAX_FILE_CHARS),
        });
      } catch {
        this.logger.debug(
          `[ChatOrchestrator] Could not read "${candidate.filePath}" — skipping`,
        );
      }
    }

    return results;
  }

  private buildMessages(
    repoName: string,
    history: ChatMessage[],
    userMessage: string,
    files: Array<{ filePath: string; content: string }>,
    chunks: ChunkResult[],
  ): LlmMessage[] {
    const systemContent = buildSystemPrompt(repoName, files, chunks);

    const messages: LlmMessage[] = [{ role: 'system', content: systemContent }];

    // Inject conversation history so the LLM has multi-turn context.
    for (const msg of history) {
      messages.push({ role: msg.role, content: msg.content });
    }

    messages.push({ role: 'user', content: userMessage });

    return messages;
  }
}

// ─── Module-level utilities ───────────────────────────────────────────────────

function buildSystemPrompt(
  repoName: string,
  files: Array<{ filePath: string; content: string }>,
  chunks: ChunkResult[],
): string {
  const hasContext = files.length > 0 || chunks.length > 0;
  const lines: string[] = [
    `You are an expert engineering assistant${repoName ? ` for the "${repoName}" codebase` : ''}.`,
    `Answer questions clearly and accurately using Markdown.`,
    `When writing code, always use fenced code blocks with the language tag (e.g. \`\`\`typescript).`,
    hasContext
      ? `Use the provided file contents and documentation below to give precise, grounded answers.`
      : `Answer from your general knowledge.`,
  ];

  if (files.length > 0) {
    lines.push('', '═══ REPOSITORY FILES ═══');
    for (const file of files) {
      lines.push('', `### ${file.filePath}`, '```', file.content, '```');
    }
  }

  if (chunks.length > 0) {
    lines.push('', '═══ KNOWLEDGE BASE ═══');
    for (const chunk of chunks) {
      lines.push('', `### [${chunk.sourceTitle}]`, chunk.content);
    }
  }

  return lines.join('\n');
}

function truncateContent(content: string, maxLines: number, maxChars: number): string {
  const lines = content.split('\n');

  let result = lines.length > maxLines
    ? lines.slice(0, maxLines).join('\n') + `\n// ... (truncated — showing first ${maxLines} of ${lines.length} lines)`
    : content;

  if (result.length > maxChars) {
    result = result.slice(0, maxChars) + '\n// ... (truncated)';
  }

  return result;
}

function toMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
