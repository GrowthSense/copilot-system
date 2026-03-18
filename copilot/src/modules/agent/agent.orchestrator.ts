import { Injectable, Logger } from '@nestjs/common';
import { RunsService } from '../runs/runs.service';
import { LlmService } from '../llm/llm.service';
import { RetrievalService } from '../knowledge/retrieval.service';
import { RepoSearchService } from '../repo/repo-search.service';
import { RepoService } from '../repo/repo.service';
import { PatchService } from '../patch/patch.service';
import { PatchValidatorService } from '../patch/patch-validator.service';
import { TestgenService } from '../testgen/testgen.service';
import { ApprovalService } from '../approval/approval.service';
import { PrDraftService } from '../prdraft/prdraft.service';
import { GithubService } from '../github/github.service';
import { ReviewService } from '../review/review.service';
import { TestrunnerService } from '../testrunner/testrunner.service';
import { RunTestsTool } from '../tools/tools/run-tests.tool';
import { AppConfigService } from '../../config/config.service';
import { RunType } from '../../common/enums/run-type.enum';
import { StepType } from '../../common/enums/step-type.enum';
import { RiskLevel } from '../../common/enums/risk-level.enum';
import { ApprovalStatus } from '../../common/enums/approval-status.enum';
import { PrDraftStatus } from '../../common/enums/pr-draft-status.enum';
import { ValidationException } from '../../common/exceptions/app.exception';
import { AskRepoQuestionDto } from './dto/ask-repo-question.dto';
import { FindRelevantFilesDto } from './dto/find-relevant-files.dto';
import { ExplainCodeDto } from './dto/explain-code.dto';
import { ProposePatchDto } from './dto/propose-patch.dto';
import { GenerateTestsAgentDto } from './dto/generate-tests-agent.dto';
import { CreatePrDraftAgentDto } from './dto/create-pr-draft-agent.dto';
import { ReviewCodeDto } from './dto/review-code.dto';
import { ReviewCodeResponseDto } from './dto/review-code-response.dto';
import { RunTestsAgentDto } from './dto/run-tests-agent.dto';
import { RunTestsAgentResponseDto } from './dto/run-tests-agent-response.dto';
import {
  AskRepoQuestionResponseDto,
  RelevantFileRefDto,
} from './dto/ask-repo-question-response.dto';
import {
  FindRelevantFilesResponseDto,
  FoundFileDto,
} from './dto/find-relevant-files-response.dto';
import { ExplainCodeResponseDto } from './dto/explain-code-response.dto';
import { ProposePatchResponseDto } from './dto/propose-patch-response.dto';
import { GenerateTestsAgentResponseDto } from './dto/generate-tests-agent-response.dto';
import { CreatePrDraftAgentResponseDto } from './dto/create-pr-draft-agent-response.dto';
import { FileMatchResult, MatchReason } from '../repo/interfaces/repo-index.interface';
import { ChunkResult } from '../knowledge/interfaces/knowledge-source.interface';
import { splitRepoFullName } from '../github/interfaces/github.interface';

/** Maximum lines per file passed as LLM context. Prevents token-budget overflow. */
const MAX_CONTEXT_LINES_PER_FILE = 200;
/** Maximum files read and passed as context to the LLM. */
const MAX_FILES_TO_READ = 5;
/** Maximum knowledge chunks retrieved from the knowledge base. */
const DEFAULT_KNOWLEDGE_TOP_K = 8;
/** Default number of candidate files to fetch from the repo search index. */
const DEFAULT_FILE_TOP_K = 10;

@Injectable()
export class AgentOrchestrator {
  private readonly logger = new Logger(AgentOrchestrator.name);

  constructor(
    private readonly runsService: RunsService,
    private readonly llm: LlmService,
    private readonly retrieval: RetrievalService,
    private readonly repoSearch: RepoSearchService,
    private readonly repoService: RepoService,
    private readonly patchService: PatchService,
    private readonly patchValidator: PatchValidatorService,
    private readonly testgenService: TestgenService,
    private readonly approvalService: ApprovalService,
    private readonly prDraftService: PrDraftService,
    private readonly githubService: GithubService,
    private readonly reviewService: ReviewService,
    private readonly testrunnerService: TestrunnerService,
    private readonly runTestsTool: RunTestsTool,
    private readonly config: AppConfigService,
  ) {}

  // ─── ask() ────────────────────────────────────────────────────────────────

  async ask(dto: AskRepoQuestionDto): Promise<AskRepoQuestionResponseDto> {
    const start = Date.now();

    const run = await this.runsService.create({
      type: RunType.ANSWER_QUESTION,
      repoId: dto.repoId,
      input: { question: dto.question, topKFiles: dto.topKFiles, topKChunks: dto.topKChunks },
    });

    await this.runsService.markRunning(run.id);
    this.logger.log(`[ask] runId=${run.id} repoId=${dto.repoId}`);

    let stepIndex = 0;

    try {
      const repo = await this.runStage(
        run.id, stepIndex++, 'resolve_repo', StepType.REASONING, undefined,
        { repoId: dto.repoId },
        () => this.repoService.findOne(dto.repoId),
      );

      const chunks = await this.runStage<ChunkResult[]>(
        run.id, stepIndex++, 'retrieve_knowledge', StepType.TOOL_CALL, 'knowledge_retrieval',
        { query: dto.question, topK: dto.topKChunks ?? DEFAULT_KNOWLEDGE_TOP_K },
        () => this.retrieval.retrieve({ query: dto.question, topK: dto.topKChunks ?? DEFAULT_KNOWLEDGE_TOP_K }),
      );

      const topKFiles = Math.min(dto.topKFiles ?? DEFAULT_FILE_TOP_K, MAX_FILES_TO_READ);

      const candidates = await this.runStage<FileMatchResult[]>(
        run.id, stepIndex++, 'find_candidate_files', StepType.TOOL_CALL, 'search_files',
        { query: dto.question, topK: topKFiles },
        () => this.repoSearch.findCandidates(dto.repoId, { query: dto.question, topK: topKFiles }),
      );

      const fileContents = await this.runStage<Array<{ filePath: string; content: string }>>(
        run.id, stepIndex++, 'read_files', StepType.TOOL_CALL, 'read_files',
        { filePaths: candidates.map((c) => c.filePath) },
        async () => {
          const results: Array<{ filePath: string; content: string }> = [];
          for (const candidate of candidates) {
            try {
              const file = await this.repoService.readFileByPath(dto.repoId, candidate.filePath);
              results.push({ filePath: file.filePath, content: truncateLines(file.content, MAX_CONTEXT_LINES_PER_FILE) });
            } catch {
              this.logger.warn(`[ask] Could not read ${candidate.filePath} — skipping`);
            }
          }
          return results;
        },
      );

      const knowledgeContext = buildKnowledgeContext(chunks);

      const llmOutput = await this.runStage(
        run.id, stepIndex++, 'llm_answer', StepType.LLM_CALL, undefined,
        { questionLength: dto.question.length, fileCount: fileContents.length },
        () => this.llm.answerRepoQuestion({
          question: dto.question,
          repoName: repo.fullName,
          codeContext: [
            ...(knowledgeContext ? [{ filePath: '__knowledge__', content: knowledgeContext }] : []),
            ...fileContents,
          ],
        }),
      );

      const durationMs = Date.now() - start;

      const relevantFiles: RelevantFileRefDto[] = llmOutput.relevantFiles.map((fp) => {
        const candidate = candidates.find((c) => c.filePath === fp);
        return { filePath: fp, reason: candidate?.matchDetail };
      });

      await this.runsService.complete(run.id, { answer: llmOutput.answer, confidence: llmOutput.confidence, relevantFiles: llmOutput.relevantFiles }, durationMs);

      return { runId: run.id, question: dto.question, answer: llmOutput.answer, confidence: llmOutput.confidence, relevantFiles, reasoning: llmOutput.reasoning, caveats: llmOutput.caveats, durationMs };
    } catch (err: unknown) {
      await this.runsService.fail(run.id, toMessage(err), Date.now() - start);
      throw err;
    }
  }

  // ─── findFiles() ──────────────────────────────────────────────────────────

  async findFiles(dto: FindRelevantFilesDto): Promise<FindRelevantFilesResponseDto> {
    const start = Date.now();

    const run = await this.runsService.create({
      type: RunType.FIND_FILES,
      repoId: dto.repoId,
      input: { query: dto.query, topK: dto.topK },
    });

    await this.runsService.markRunning(run.id);
    this.logger.log(`[findFiles] runId=${run.id} repoId=${dto.repoId}`);

    let stepIndex = 0;

    try {
      const repo = await this.runStage(
        run.id, stepIndex++, 'resolve_repo', StepType.REASONING, undefined,
        { repoId: dto.repoId },
        () => this.repoService.findOne(dto.repoId),
      );

      const topK = dto.topK ?? DEFAULT_FILE_TOP_K;

      const candidates = await this.runStage<FileMatchResult[]>(
        run.id, stepIndex++, 'find_candidates', StepType.TOOL_CALL, 'search_files',
        { query: dto.query, topK },
        () => this.repoSearch.findCandidates(dto.repoId, { query: dto.query, topK }),
      );

      if (candidates.length === 0) {
        const durationMs = Date.now() - start;
        await this.runsService.complete(run.id, { files: [] }, durationMs);
        return { runId: run.id, query: dto.query, files: [], searchStrategy: 'No candidates found in the index for this query.', totalCandidates: 0, durationMs };
      }

      const llmOutput = await this.runStage(
        run.id, stepIndex++, 'llm_rank_files', StepType.LLM_CALL, undefined,
        { query: dto.query, candidateCount: candidates.length },
        () => this.llm.findFiles({ query: dto.query, repoName: repo.fullName, fileList: candidates.map((c) => c.filePath), limit: topK }),
      );

      const durationMs = Date.now() - start;
      const candidateMap = new Map(candidates.map((c) => [c.filePath, c]));

      const files: FoundFileDto[] = llmOutput.files.map((f) => {
        const meta = candidateMap.get(f.path);
        const foundFile: FoundFileDto = {
          filePath: f.path,
          fileName: meta?.fileName ?? f.path.split('/').pop() ?? f.path,
          language: meta?.language ?? null,
          lineCount: meta?.lineCount ?? 0,
          relevanceScore: f.relevanceScore,
          reason: f.reason,
        };
        if (dto.includeSnippet && meta) foundFile.snippet = meta.matchDetail;
        return foundFile;
      });

      await this.runsService.complete(run.id, { files: files.map((f) => f.filePath), totalCandidates: candidates.length }, durationMs);

      return { runId: run.id, query: dto.query, files, searchStrategy: llmOutput.searchStrategy, totalCandidates: candidates.length, durationMs };
    } catch (err: unknown) {
      await this.runsService.fail(run.id, toMessage(err), Date.now() - start);
      throw err;
    }
  }

  // ─── explain() ────────────────────────────────────────────────────────────

  async explain(dto: ExplainCodeDto): Promise<ExplainCodeResponseDto> {
    const start = Date.now();

    const run = await this.runsService.create({
      type: RunType.EXPLAIN_CODE,
      repoId: dto.repoId,
      input: { filePath: dto.filePath, additionalContext: dto.additionalContext },
    });

    await this.runsService.markRunning(run.id);
    this.logger.log(`[explain] runId=${run.id} filePath=${dto.filePath}`);

    let stepIndex = 0;

    try {
      const fileData = await this.runStage(
        run.id, stepIndex++, 'read_file', StepType.TOOL_CALL, 'read_file',
        { repoId: dto.repoId, filePath: dto.filePath },
        () => this.repoService.readFileByPath(dto.repoId, dto.filePath),
      );

      const knowledgeQuery = `${dto.filePath} ${dto.additionalContext ?? ''}`.trim();

      const chunks = await this.runStage<ChunkResult[]>(
        run.id, stepIndex++, 'retrieve_context', StepType.TOOL_CALL, 'knowledge_retrieval',
        { query: knowledgeQuery },
        () => this.retrieval.retrieve({ query: knowledgeQuery, topK: 5 }),
      );

      const contextText = buildContextText(chunks, dto.additionalContext);

      const llmOutput = await this.runStage(
        run.id, stepIndex++, 'llm_explain', StepType.LLM_CALL, undefined,
        { filePath: dto.filePath, lineCount: fileData.lineCount },
        () => this.llm.explainCode({
          filePath: fileData.filePath,
          content: truncateLines(fileData.content, MAX_CONTEXT_LINES_PER_FILE),
          language: fileData.language ?? undefined,
          context: contextText,
        }),
      );

      const durationMs = Date.now() - start;

      await this.runsService.complete(run.id, { summary: llmOutput.summary, complexity: llmOutput.complexity }, durationMs);

      return { runId: run.id, filePath: dto.filePath, summary: llmOutput.summary, purpose: llmOutput.purpose, keyComponents: llmOutput.keyComponents, dependencies: llmOutput.dependencies, sideEffects: llmOutput.sideEffects, complexity: llmOutput.complexity, testability: llmOutput.testability, suggestions: llmOutput.suggestions, durationMs };
    } catch (err: unknown) {
      await this.runsService.fail(run.id, toMessage(err), Date.now() - start);
      throw err;
    }
  }

  // ─── proposePatch() ───────────────────────────────────────────────────────

  async proposePatch(dto: ProposePatchDto): Promise<ProposePatchResponseDto> {
    const start = Date.now();

    const run = await this.runsService.create({
      type: RunType.PROPOSE_PATCH,
      repoId: dto.repoId,
      input: { request: dto.request, topKFiles: dto.topKFiles, constraints: dto.constraints },
    });

    await this.runsService.markRunning(run.id);
    this.logger.log(`[proposePatch] runId=${run.id} repoId=${dto.repoId}`);

    let stepIndex = 0;

    try {
      const repo = await this.runStage(
        run.id, stepIndex++, 'resolve_repo', StepType.REASONING, undefined,
        { repoId: dto.repoId },
        () => this.repoService.findOne(dto.repoId),
      );

      const topKFiles = Math.min(dto.topKFiles ?? DEFAULT_FILE_TOP_K, MAX_FILES_TO_READ);

      const candidates = await this.runStage<FileMatchResult[]>(
        run.id, stepIndex++, 'find_target_files', StepType.TOOL_CALL, 'search_files',
        { query: dto.request, topK: topKFiles },
        async () => {
          const searched = await this.repoSearch.findCandidates(dto.repoId, { query: dto.request, topK: topKFiles });
          if (!dto.filePaths || dto.filePaths.length === 0) return searched;

          const foundPaths = new Set(searched.map((c) => c.filePath));
          const explicit: FileMatchResult[] = dto.filePaths
            .filter((fp) => !foundPaths.has(fp))
            .map((fp) => ({
              fileId: '',
              repoId: dto.repoId,
              filePath: fp,
              fileName: fp.split('/').pop() ?? fp,
              sizeBytes: 0,
              lineCount: 0,
              matchReason: MatchReason.CANDIDATE_SCORED,
              matchDetail: 'Explicitly requested by caller',
              score: 1.0,
            }));
          return [...explicit, ...searched].slice(0, topKFiles);
        },
      );

      const targetFiles = await this.runStage<Array<{ filePath: string; content: string }>>(
        run.id, stepIndex++, 'read_target_files', StepType.TOOL_CALL, 'read_files',
        { filePaths: candidates.map((c) => c.filePath) },
        async () => {
          const results: Array<{ filePath: string; content: string }> = [];

          for (const candidate of candidates) {
            try {
              const file = await this.repoService.readFileByPath(dto.repoId, candidate.filePath);
              results.push({ filePath: file.filePath, content: truncateLines(file.content, MAX_CONTEXT_LINES_PER_FILE) });

              if (dto.includeTests !== false) {
                const specPath = deriveSpecPath(candidate.filePath);
                if (specPath) {
                  try {
                    const specFile = await this.repoService.readFileByPath(dto.repoId, specPath);
                    results.push({ filePath: specFile.filePath, content: truncateLines(specFile.content, 100) });
                  } catch {
                    // No adjacent test file — non-fatal.
                  }
                }
              }
            } catch {
              this.logger.warn(`[proposePatch] Could not read ${candidate.filePath} — skipping`);
            }
          }

          return results;
        },
      );

      const chunks = await this.runStage<ChunkResult[]>(
        run.id, stepIndex++, 'retrieve_standards', StepType.TOOL_CALL, 'knowledge_retrieval',
        { query: dto.request, topK: DEFAULT_KNOWLEDGE_TOP_K },
        () => this.retrieval.retrieve({ query: dto.request, topK: DEFAULT_KNOWLEDGE_TOP_K }),
      );

      const context = buildContextText(chunks, undefined);

      const llmOutput = await this.runStage(
        run.id, stepIndex++, 'llm_propose_patch', StepType.LLM_CALL, undefined,
        { request: dto.request.slice(0, 100), fileCount: targetFiles.length },
        () => this.llm.proposePatch({
          request: dto.request,
          repoName: repo.fullName,
          targetFiles,
          context: context ?? undefined,
          constraints: dto.constraints,
        }),
      );

      const validation = await this.runStage(
        run.id, stepIndex++, 'validate_patch', StepType.VALIDATION, undefined,
        { riskLevel: llmOutput.riskLevel, filePaths: llmOutput.filePaths },
        async () => {
          const result = this.patchValidator.validatePatchProposal(llmOutput);
          if (!result.valid) {
            throw new ValidationException(
              `Patch proposal failed validation: ${result.errors.join('; ')}`,
            );
          }
          return result;
        },
      );

      const patchRecord = await this.runStage(
        run.id, stepIndex++, 'persist_patch', StepType.TOOL_CALL, undefined,
        { title: llmOutput.title, riskLevel: llmOutput.riskLevel },
        () => this.patchService.create({
          title: llmOutput.title,
          description: buildPatchDescription(llmOutput),
          diff: llmOutput.diff,
          filePaths: llmOutput.filePaths,
          riskLevel: llmOutput.riskLevel as RiskLevel,
          runId: run.id,
          repoId: dto.repoId,
        }),
      );

      const durationMs = Date.now() - start;

      await this.runsService.complete(
        run.id,
        { patchId: patchRecord.id, riskLevel: llmOutput.riskLevel, filePaths: llmOutput.filePaths },
        durationMs,
      );

      return {
        runId: run.id,
        patchId: patchRecord.id,
        title: llmOutput.title,
        description: llmOutput.description,
        diff: llmOutput.diff,
        filePaths: llmOutput.filePaths,
        riskLevel: llmOutput.riskLevel as RiskLevel,
        breakingChanges: llmOutput.breakingChanges,
        reasoning: llmOutput.reasoning,
        testingNotes: llmOutput.testingNotes,
        validationWarnings: validation.warnings,
        durationMs,
      };
    } catch (err: unknown) {
      await this.runsService.fail(run.id, toMessage(err), Date.now() - start);
      this.logger.error(`[proposePatch] runId=${run.id} FAILED: ${toMessage(err)}`);
      throw err;
    }
  }

  // ─── generateTests() ──────────────────────────────────────────────────────

  async generateTests(dto: GenerateTestsAgentDto): Promise<GenerateTestsAgentResponseDto> {
    const start = Date.now();

    const run = await this.runsService.create({
      type: RunType.GENERATE_TESTS,
      repoId: dto.repoId,
      input: { filePath: dto.filePath, framework: dto.framework },
    });

    await this.runsService.markRunning(run.id);
    this.logger.log(`[generateTests] runId=${run.id} filePath=${dto.filePath}`);

    let stepIndex = 0;

    try {
      const fileData = await this.runStage(
        run.id, stepIndex++, 'read_target_file', StepType.TOOL_CALL, 'read_file',
        { repoId: dto.repoId, filePath: dto.filePath },
        () => this.repoService.readFileByPath(dto.repoId, dto.filePath),
      );

      const existingTestContent = await this.runStage<string | undefined>(
        run.id, stepIndex++, 'find_existing_tests', StepType.TOOL_CALL, 'read_file',
        { targetSpec: deriveSpecPath(dto.filePath) ?? 'none' },
        async () => {
          const specPath = deriveSpecPath(dto.filePath);
          if (specPath) {
            try {
              const specFile = await this.repoService.readFileByPath(dto.repoId, specPath);
              return specFile.content;
            } catch {
              // Not found — fall through to search-based approach.
            }
          }

          const specsFound = await this.repoSearch.findCandidates(dto.repoId, {
            query: 'spec test jest describe it',
            topK: 3,
          });

          for (const spec of specsFound) {
            if (spec.filePath.endsWith('.spec.ts') || spec.filePath.endsWith('.test.ts')) {
              try {
                const specFile = await this.repoService.readFileByPath(dto.repoId, spec.filePath);
                return truncateLines(specFile.content, 80);
              } catch {
                continue;
              }
            }
          }

          return undefined;
        },
      );

      const knowledgeQuery = `testing conventions jest ${dto.filePath} ${dto.additionalContext ?? ''}`.trim();

      const chunks = await this.runStage<ChunkResult[]>(
        run.id, stepIndex++, 'retrieve_test_context', StepType.TOOL_CALL, 'knowledge_retrieval',
        { query: knowledgeQuery },
        () => this.retrieval.retrieve({ query: knowledgeQuery, topK: 5 }),
      );

      const contextText = buildContextText(chunks, dto.additionalContext);

      const llmOutput = await this.runStage(
        run.id, stepIndex++, 'llm_generate_tests', StepType.LLM_CALL, undefined,
        { filePath: dto.filePath, lineCount: fileData.lineCount, hasExistingTests: !!existingTestContent },
        () => this.llm.generateTests({
          filePath: fileData.filePath,
          content: truncateLines(fileData.content, MAX_CONTEXT_LINES_PER_FILE),
          language: fileData.language ?? undefined,
          framework: dto.framework,
          existingTestContent: existingTestContent
            ? (contextText ? `${contextText}\n\n---\n\n${existingTestContent}` : existingTestContent)
            : contextText ?? undefined,
        }),
      );

      const validation = await this.runStage(
        run.id, stepIndex++, 'validate_tests', StepType.VALIDATION, undefined,
        { testFile: llmOutput.testFile, testCount: llmOutput.testCount },
        async () => {
          const result = this.patchValidator.validateTestOutput(llmOutput);
          if (!result.valid) {
            throw new ValidationException(
              `Generated test output failed validation: ${result.errors.join('; ')}`,
            );
          }
          return result;
        },
      );

      const testRecord = await this.runStage(
        run.id, stepIndex++, 'persist_tests', StepType.TOOL_CALL, undefined,
        { testFile: llmOutput.testFile },
        () => this.testgenService.persistOrchestrated({
          repoId: dto.repoId,
          runId: run.id,
          targetFile: dto.filePath,
          llmOutput,
        }),
      );

      const durationMs = Date.now() - start;

      await this.runsService.complete(
        run.id,
        { testgenId: testRecord.id, testFile: llmOutput.testFile, testCount: llmOutput.testCount },
        durationMs,
      );

      return {
        runId: run.id,
        testgenId: testRecord.id,
        targetFile: dto.filePath,
        testFile: llmOutput.testFile,
        content: llmOutput.content,
        framework: llmOutput.framework,
        testCount: llmOutput.testCount,
        coveredScenarios: llmOutput.coveredScenarios,
        setupNotes: llmOutput.setupNotes,
        mockedDependencies: llmOutput.mockedDependencies,
        validationWarnings: validation.warnings,
        durationMs,
      };
    } catch (err: unknown) {
      await this.runsService.fail(run.id, toMessage(err), Date.now() - start);
      this.logger.error(`[generateTests] runId=${run.id} FAILED: ${toMessage(err)}`);
      throw err;
    }
  }

  // ─── review() ─────────────────────────────────────────────────────────────

  async review(dto: ReviewCodeDto): Promise<ReviewCodeResponseDto> {
    const start = Date.now();

    const run = await this.runsService.create({
      type: RunType.REVIEW_CODE,
      repoId: dto.repoId,
      input: { filePath: dto.filePath, focusAreas: dto.focusAreas },
    });

    await this.runsService.markRunning(run.id);
    this.logger.log(`[review] runId=${run.id} filePath=${dto.filePath}`);

    let stepIndex = 0;

    try {
      await this.runStage(
        run.id, stepIndex++, 'resolve_repo', StepType.REASONING, undefined,
        { repoId: dto.repoId },
        () => this.repoService.findOne(dto.repoId),
      );

      const fileData = await this.runStage(
        run.id, stepIndex++, 'read_target_file', StepType.TOOL_CALL, 'read_file',
        { repoId: dto.repoId, filePath: dto.filePath },
        () => this.repoService.readFileByPath(dto.repoId, dto.filePath),
      );

      const knowledgeQuery = `code review ${dto.filePath} ${dto.focusAreas?.join(' ') ?? ''} ${dto.additionalContext ?? ''}`.trim();

      const chunks = await this.runStage<ChunkResult[]>(
        run.id, stepIndex++, 'retrieve_context', StepType.TOOL_CALL, 'knowledge_retrieval',
        { query: knowledgeQuery },
        () => this.retrieval.retrieve({ query: knowledgeQuery, topK: 5 }),
      );

      const contextText = buildContextText(chunks, dto.additionalContext);

      const llmOutput = await this.runStage(
        run.id, stepIndex++, 'llm_review', StepType.LLM_CALL, undefined,
        { filePath: dto.filePath, lineCount: fileData.lineCount },
        () => this.llm.reviewCode({
          filePath: fileData.filePath,
          content: truncateLines(fileData.content, MAX_CONTEXT_LINES_PER_FILE),
          language: fileData.language ?? undefined,
          focusAreas: dto.focusAreas,
          additionalContext: contextText ?? dto.additionalContext,
        }),
      );

      const reviewRecord = await this.runStage(
        run.id, stepIndex++, 'persist_review', StepType.TOOL_CALL, undefined,
        { overallRisk: llmOutput.overallRisk, findingCount: llmOutput.findings.length },
        () => this.reviewService.persistOrchestrated({
          repoId: dto.repoId,
          runId: run.id,
          filePath: dto.filePath,
          llmOutput,
        }),
      );

      const durationMs = Date.now() - start;

      await this.runsService.complete(
        run.id,
        { reviewId: reviewRecord.id, overallRisk: llmOutput.overallRisk, findingCount: llmOutput.findings.length },
        durationMs,
      );

      return {
        runId: run.id,
        reviewId: reviewRecord.id,
        filePath: dto.filePath,
        summary: llmOutput.summary,
        overallRisk: llmOutput.overallRisk,
        findings: llmOutput.findings,
        positives: llmOutput.positives,
        testingRecommendations: llmOutput.testingRecommendations,
        durationMs,
      };
    } catch (err: unknown) {
      await this.runsService.fail(run.id, toMessage(err), Date.now() - start);
      this.logger.error(`[review] runId=${run.id} FAILED: ${toMessage(err)}`);
      throw err;
    }
  }

  // ─── runTests() ───────────────────────────────────────────────────────────

  async runTests(dto: RunTestsAgentDto): Promise<RunTestsAgentResponseDto> {
    const start = Date.now();

    const run = await this.runsService.create({
      type: RunType.RUN_TESTS,
      repoId: dto.repoId,
      input: { testgenId: dto.testgenId, approvalId: dto.approvalId, script: dto.script },
    });

    await this.runsService.markRunning(run.id);
    this.logger.log(`[runTests] runId=${run.id} testgenId=${dto.testgenId}`);

    let stepIndex = 0;

    try {
      await this.runStage(
        run.id, stepIndex++, 'resolve_repo', StepType.REASONING, undefined,
        { repoId: dto.repoId },
        () => this.repoService.findOne(dto.repoId),
      );

      await this.runStage(
        run.id, stepIndex++, 'check_approval_gate', StepType.VALIDATION, undefined,
        { approvalId: dto.approvalId },
        async () => {
          const approval = await this.approvalService.findOne(dto.approvalId);
          if (approval.status !== ApprovalStatus.APPROVED) {
            throw new ValidationException(
              `Approval "${dto.approvalId}" has status "${approval.status}" — ` +
              `running tests requires an APPROVED approval. ` +
              `Approve the request via PATCH /api/v1/approvals/${dto.approvalId}/approve first.`,
            );
          }
          return approval;
        },
      );

      await this.runStage(
        run.id, stepIndex++, 'load_testgen', StepType.REASONING, undefined,
        { testgenId: dto.testgenId },
        () => this.testgenService.findOne(dto.testgenId),
      );

      const script = dto.script ?? 'test';

      const testResult = await this.runStage(
        run.id, stepIndex++, 'run_tests', StepType.TOOL_CALL, 'run_tests',
        { repoId: dto.repoId, script },
        () => this.runTestsTool.execute(
          { repoId: dto.repoId, script, timeoutMs: dto.timeoutMs },
          { runId: run.id },
        ),
      );

      const resultRecord = await this.runStage(
        run.id, stepIndex++, 'persist_result', StepType.TOOL_CALL, undefined,
        { passed: testResult.passed, exitCode: testResult.exitCode },
        () => this.testrunnerService.persistResult({
          runId: run.id,
          testgenId: dto.testgenId,
          repoId: dto.repoId,
          script,
          exitCode: testResult.exitCode,
          passed: testResult.passed,
          stdout: testResult.stdout,
          stderr: testResult.stderr,
          durationMs: testResult.durationMs,
          timedOut: testResult.timedOut,
          command: testResult.command,
        }),
      );

      const durationMs = Date.now() - start;

      await this.runsService.complete(
        run.id,
        { testRunResultId: resultRecord.id, passed: testResult.passed, exitCode: testResult.exitCode },
        durationMs,
      );

      return {
        runId: run.id,
        testRunResultId: resultRecord.id,
        testgenId: dto.testgenId,
        passed: testResult.passed,
        exitCode: testResult.exitCode,
        stdout: testResult.stdout,
        stderr: testResult.stderr,
        durationMs: testResult.durationMs,
        timedOut: testResult.timedOut,
        command: testResult.command,
      };
    } catch (err: unknown) {
      await this.runsService.fail(run.id, toMessage(err), Date.now() - start);
      this.logger.error(`[runTests] runId=${run.id} FAILED: ${toMessage(err)}`);
      throw err;
    }
  }

  // ─── createPrDraft() ──────────────────────────────────────────────────────

  async createPrDraft(dto: CreatePrDraftAgentDto): Promise<CreatePrDraftAgentResponseDto> {
    const start = Date.now();

    const run = await this.runsService.create({
      type: RunType.CREATE_PR_DRAFT,
      repoId: dto.repoId,
      input: {
        patchId: dto.patchId,
        approvalId: dto.approvalId,
        fileCount: dto.changedFiles.length,
        testgenId: dto.testgenId,
      },
    });

    await this.runsService.markRunning(run.id);
    this.logger.log(`[createPrDraft] runId=${run.id} patchId=${dto.patchId}`);

    let stepIndex = 0;

    try {
      // ── Stage 1: Resolve repo ─────────────────────────────────────────────
      const repo = await this.runStage(
        run.id, stepIndex++, 'resolve_repo', StepType.REASONING, undefined,
        { repoId: dto.repoId },
        () => this.repoService.findOne(dto.repoId),
      );

      // ── Stage 2: Verify patch + approval gate ─────────────────────────────
      const { patch, approval } = await this.runStage(
        run.id, stepIndex++, 'check_patch_and_approval', StepType.VALIDATION, undefined,
        { patchId: dto.patchId, approvalId: dto.approvalId },
        async () => {
          const patch = await this.patchService.findOne(dto.patchId);
          const approval = await this.approvalService.findOne(dto.approvalId);

          if (approval.status !== ApprovalStatus.APPROVED) {
            throw new ValidationException(
              `Approval "${dto.approvalId}" has status "${approval.status}" — ` +
              `PR draft creation requires an APPROVED approval. ` +
              `Approve the request via PATCH /api/v1/approvals/${dto.approvalId}/approve first.`,
            );
          }

          if (approval.patchId !== null && approval.patchId !== dto.patchId) {
            throw new ValidationException(
              `Approval "${dto.approvalId}" is linked to patch "${approval.patchId}" ` +
              `but the request specifies patch "${dto.patchId}"`,
            );
          }

          return { patch, approval };
        },
      );

      // ── Stage 3: Optionally load the generated test file ──────────────────
      const assembledFiles = await this.runStage<Array<{ filePath: string; content: string }>>(
        run.id, stepIndex++, 'assemble_files', StepType.REASONING, undefined,
        { changedFileCount: dto.changedFiles.length, testgenId: dto.testgenId ?? null },
        async () => {
          const files = dto.changedFiles.map((f) => ({
            filePath: f.filePath,
            content: f.content,
          }));

          if (dto.testgenId) {
            try {
              const testRecord = await this.testgenService.findOne(dto.testgenId);
              const alreadyIncluded = files.some((f) => f.filePath === testRecord.testFile);
              if (!alreadyIncluded) {
                files.push({ filePath: testRecord.testFile, content: testRecord.content });
                this.logger.log(`[createPrDraft] Added generated test: ${testRecord.testFile}`);
              }
            } catch {
              this.logger.warn(`[createPrDraft] testgenId=${dto.testgenId} not found — skipping`);
            }
          }

          return files;
        },
      );

      // ── Stage 4: LLM — generate PR title, body, branch name, labels ──────
      const llmOutput = await this.runStage(
        run.id, stepIndex++, 'llm_draft_pr', StepType.LLM_CALL, undefined,
        { patchTitle: patch.title, riskLevel: patch.riskLevel },
        () => this.llm.createPrDraft({
          repoName: repo.fullName,
          diff: patch.diff,
          patchTitle: patch.title,
          patchDescription: patch.description ?? patch.title,
          suggestedBranch: buildBranchName(patch.title),
          baseBranch: dto.baseBranch ?? this.config.githubBaseBranch,
          teamReviewers: dto.teamReviewers,
        }),
      );

      const baseBranch = dto.baseBranch ?? this.config.githubBaseBranch;
      const headBranch = llmOutput.headBranch;

      // ── Stage 5: Create branch ────────────────────────────────────────────
      const { owner, repo: repoName } = splitRepoFullName(repo.fullName);

      await this.runStage(
        run.id, stepIndex++, 'create_branch', StepType.TOOL_CALL, 'github_create_branch',
        { owner, repo: repoName, headBranch, baseBranch },
        () => this.githubService.createBranch({ owner, repo: repoName, branchName: headBranch, baseBranch }),
      );

      // ── Stage 6: Create commit ────────────────────────────────────────────
      const commitMessage = dto.commitMessage ?? llmOutput.title;

      const commitSha = await this.runStage(
        run.id, stepIndex++, 'create_commit', StepType.TOOL_CALL, 'github_create_commit',
        { branchName: headBranch, fileCount: assembledFiles.length },
        () => this.githubService.createCommit({
          owner,
          repo: repoName,
          branchName: headBranch,
          message: commitMessage,
          files: assembledFiles,
        }),
      );

      // ── Stage 7: Create pull request ──────────────────────────────────────
      const prResult = await this.runStage(
        run.id, stepIndex++, 'create_pr', StepType.TOOL_CALL, 'github_create_pr',
        { title: llmOutput.title, isDraft: llmOutput.isDraft },
        () => this.githubService.createPullRequest({
          owner,
          repo: repoName,
          title: llmOutput.title,
          body: llmOutput.body,
          headBranch,
          baseBranch,
          labels: llmOutput.labels,
          reviewers: llmOutput.reviewers,
          isDraft: llmOutput.isDraft,
        }),
      );

      // ── Stage 8: Persist PR draft ─────────────────────────────────────────
      const prDraftRecord = await this.runStage(
        run.id, stepIndex++, 'persist_pr_draft', StepType.TOOL_CALL, undefined,
        { prNumber: prResult.prNumber, prUrl: prResult.prUrl },
        () => this.prDraftService.create({
          repoFullName: repo.fullName,
          title: llmOutput.title,
          body: llmOutput.body,
          headBranch,
          baseBranch,
          labels: llmOutput.labels,
          runId: run.id,
          repoId: dto.repoId,
          metadata: {
            patchId: dto.patchId,
            approvalId: dto.approvalId,
            commitSha,
            checklist: llmOutput.checklist,
            riskLevel: patch.riskLevel,
            fileCount: assembledFiles.length,
          },
        }),
      );

      // Update the PR draft record with the actual GitHub PR number and URL.
      await this.prDraftService.update(prDraftRecord.id, {
        prNumber: prResult.prNumber,
        prUrl: prResult.prUrl,
        status: PrDraftStatus.OPEN,
      });

      // ── Finalise ──────────────────────────────────────────────────────────
      const durationMs = Date.now() - start;

      await this.runsService.complete(
        run.id,
        {
          prDraftId: prDraftRecord.id,
          prNumber: prResult.prNumber,
          prUrl: prResult.prUrl,
          headBranch,
        },
        durationMs,
      );

      this.logger.log(
        `[createPrDraft] runId=${run.id} PR #${prResult.prNumber} created: ${prResult.prUrl}`,
      );

      return {
        runId: run.id,
        prDraftId: prDraftRecord.id,
        prNumber: prResult.prNumber,
        prUrl: prResult.prUrl,
        title: llmOutput.title,
        body: llmOutput.body,
        headBranch,
        baseBranch,
        labels: llmOutput.labels,
        checklist: llmOutput.checklist,
        riskLevel: patch.riskLevel,
        isDraft: prResult.isDraft,
        status: PrDraftStatus.OPEN,
        durationMs,
      };
    } catch (err: unknown) {
      await this.runsService.fail(run.id, toMessage(err), Date.now() - start);
      this.logger.error(`[createPrDraft] runId=${run.id} FAILED: ${toMessage(err)}`);
      throw err;
    }
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  /**
   * Run a single orchestration stage with full step lifecycle tracking.
   * On failure the step is marked FAILED and the error is re-thrown so the
   * caller's top-level try/catch can fail the run.
   */
  private async runStage<T>(
    runId: string,
    stepIndex: number,
    stageName: string,
    type: StepType,
    toolName: string | undefined,
    input: Record<string, unknown>,
    work: () => Promise<T>,
  ): Promise<T> {
    const stageStart = Date.now();

    const step = await this.runsService.appendStep(runId, {
      stepIndex,
      type,
      stageName,
      toolName,
      input,
    });

    await this.runsService.startStep(step.id);

    try {
      const result = await work();
      const durationMs = Date.now() - stageStart;

      await this.runsService.completeStep(step.id, {
        output: serializeOutput(result),
        resultSummary: buildSummary(stageName, result),
        durationMs,
      });

      this.logger.debug(`[stage:${stageName}] completed in ${durationMs}ms`);
      return result;
    } catch (err: unknown) {
      const durationMs = Date.now() - stageStart;
      const message = toMessage(err);
      await this.runsService.failStep(step.id, { error: message, durationMs });
      this.logger.warn(`[stage:${stageName}] failed in ${durationMs}ms: ${message}`);
      throw err;
    }
  }
}

// ─── Module-level utilities ───────────────────────────────────────────────────

function truncateLines(content: string, maxLines: number): string {
  const lines = content.split('\n');
  if (lines.length <= maxLines) return content;
  const truncated = lines.slice(0, maxLines);
  truncated.push(`// ... (truncated — showing first ${maxLines} of ${lines.length} lines)`);
  return truncated.join('\n');
}

function toMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function serializeOutput(result: unknown): Record<string, unknown> {
  if (result === null || result === undefined) return {};
  if (Array.isArray(result)) return { items: result, count: result.length };
  if (typeof result === 'object') return result as Record<string, unknown>;
  return { value: result };
}

function buildSummary(stageName: string, result: unknown): string {
  if (Array.isArray(result)) return `${stageName}: returned ${result.length} items`;
  if (result && typeof result === 'object' && 'answer' in result) return `${stageName}: LLM answer produced`;
  if (result && typeof result === 'object' && 'summary' in result) return `${stageName}: code explanation produced`;
  if (result && typeof result === 'object' && 'files' in result) return `${stageName}: files ranked`;
  if (result && typeof result === 'object' && 'diff' in result) return `${stageName}: patch diff produced`;
  if (result && typeof result === 'object' && 'content' in result) return `${stageName}: test content produced`;
  if (result && typeof result === 'object' && 'prNumber' in result) return `${stageName}: PR created`;
  if (result && typeof result === 'object' && 'headBranch' in result) return `${stageName}: branch created`;
  return `${stageName}: completed`;
}

function buildKnowledgeContext(chunks: ChunkResult[]): string | undefined {
  if (chunks.length === 0) return undefined;
  return chunks.map((c) => `[${c.sourceTitle}]\n${c.content}`).join('\n\n---\n\n');
}

function buildContextText(chunks: ChunkResult[], extra: string | undefined): string | undefined {
  const parts: string[] = [];
  if (extra) parts.push(extra);
  if (chunks.length > 0) parts.push(...chunks.map((c) => `[${c.sourceTitle}]\n${c.content}`));
  return parts.length > 0 ? parts.join('\n\n---\n\n') : undefined;
}

/**
 * Derive the expected spec file path from a source file path.
 * Returns `undefined` if the source file itself is already a spec.
 */
function deriveSpecPath(filePath: string): string | undefined {
  if (filePath.includes('.spec.') || filePath.includes('.test.')) return undefined;
  return filePath.replace(/\.(ts|js|tsx|jsx)$/, '.spec.$1');
}

/**
 * Build a rich description for the PatchProposal DB record.
 */
function buildPatchDescription(output: {
  description: string;
  reasoning: string;
  testingNotes: string;
  breakingChanges: boolean;
}): string {
  return [
    output.description,
    '',
    `**Reasoning:** ${output.reasoning}`,
    '',
    `**Testing notes:** ${output.testingNotes}`,
    '',
    `**Breaking changes:** ${output.breakingChanges ? 'Yes' : 'No'}`,
  ].join('\n');
}

/**
 * Derive a kebab-case branch name from a patch title.
 * Examples:
 *   "Fix email case sensitivity in login" → "fix/email-case-sensitivity-in-login"
 *   "Add OAuth2 support"                 → "feat/add-oauth2-support"
 */
function buildBranchName(title: string): string {
  const lower = title.toLowerCase().trim();

  let prefix = 'chore';
  if (lower.startsWith('fix') || lower.startsWith('bug')) prefix = 'fix';
  else if (lower.startsWith('add') || lower.startsWith('feat') || lower.startsWith('implement')) prefix = 'feat';
  else if (lower.startsWith('refactor') || lower.startsWith('clean') || lower.startsWith('move')) prefix = 'refactor';

  const slug = lower
    .replace(/[^a-z0-9\s-]/g, '')   // strip non-alphanumeric except spaces/hyphens
    .replace(/\s+/g, '-')            // spaces → hyphens
    .replace(/-+/g, '-')             // collapse consecutive hyphens
    .slice(0, 50)                    // cap length
    .replace(/-$/, '');              // strip trailing hyphen

  return `${prefix}/${slug}`;
}
