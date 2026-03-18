import { Test, TestingModule } from '@nestjs/testing';
import { AgentOrchestrator } from '../agent.orchestrator';
import { RunsService } from '../../runs/runs.service';
import { LlmService } from '../../llm/llm.service';
import { RetrievalService } from '../../knowledge/retrieval.service';
import { RepoSearchService } from '../../repo/repo-search.service';
import { RepoService } from '../../repo/repo.service';
import { PatchService } from '../../patch/patch.service';
import { PatchValidatorService } from '../../patch/patch-validator.service';
import { TestgenService } from '../../testgen/testgen.service';
import { ApprovalService } from '../../approval/approval.service';
import { PrDraftService } from '../../prdraft/prdraft.service';
import { GithubService } from '../../github/github.service';
import { AppConfigService } from '../../../config/config.service';
import { RunType } from '../../../common/enums/run-type.enum';
import { RunStatus } from '../../../common/enums/run-status.enum';
import { RiskLevel } from '../../../common/enums/risk-level.enum';
import { ApprovalStatus } from '../../../common/enums/approval-status.enum';
import { PrDraftStatus } from '../../../common/enums/pr-draft-status.enum';
import { ValidationException } from '../../../common/exceptions/app.exception';
import { AskRepoQuestionDto } from '../dto/ask-repo-question.dto';
import { FindRelevantFilesDto } from '../dto/find-relevant-files.dto';
import { ExplainCodeDto } from '../dto/explain-code.dto';
import { ProposePatchDto } from '../dto/propose-patch.dto';
import { GenerateTestsAgentDto } from '../dto/generate-tests-agent.dto';
import { CreatePrDraftAgentDto } from '../dto/create-pr-draft-agent.dto';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRun(id = 'run-1') {
  return {
    id,
    type: RunType.ANSWER_QUESTION,
    status: RunStatus.RUNNING,
    repoId: 'repo-1',
    input: {},
    output: null,
    error: null,
    durationMs: null,
    createdAt: new Date(),
    completedAt: null,
  };
}

function makeStep(id = 'step-1') {
  return { id, stepIndex: 0, type: 'TOOL_CALL', status: 'RUNNING' };
}

function makeRepo() {
  return { id: 'repo-1', name: 'copilot', fullName: 'buntu/copilot', isActive: true };
}

function makeCandidate(filePath: string) {
  return {
    fileId: 'f1',
    repoId: 'repo-1',
    filePath,
    fileName: filePath.split('/').pop()!,
    sizeBytes: 1024,
    lineCount: 80,
    matchReason: 'CANDIDATE_SCORED' as const,
    matchDetail: `matches query`,
    score: 0.9,
  };
}

function makeFileData(filePath: string, content = 'export class Foo {}') {
  return {
    fileId: 'f1',
    repoId: 'repo-1',
    filePath,
    fileName: filePath.split('/').pop()!,
    language: 'typescript',
    sizeBytes: content.length,
    lineCount: content.split('\n').length,
    content,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('AgentOrchestrator', () => {
  let orchestrator: AgentOrchestrator;

  let runsService: jest.Mocked<RunsService>;
  let llmService: jest.Mocked<LlmService>;
  let retrieval: jest.Mocked<RetrievalService>;
  let repoSearch: jest.Mocked<RepoSearchService>;
  let repoService: jest.Mocked<RepoService>;
  let patchService: jest.Mocked<PatchService>;
  let patchValidator: jest.Mocked<PatchValidatorService>;
  let testgenService: jest.Mocked<TestgenService>;
  let approvalService: jest.Mocked<ApprovalService>;
  let prDraftService: jest.Mocked<PrDraftService>;
  let githubService: jest.Mocked<GithubService>;
  let appConfig: jest.Mocked<AppConfigService>;

  beforeEach(async () => {
    runsService = {
      create: jest.fn(),
      markRunning: jest.fn(),
      complete: jest.fn(),
      fail: jest.fn(),
      appendStep: jest.fn(),
      startStep: jest.fn(),
      completeStep: jest.fn(),
      failStep: jest.fn(),
    } as unknown as jest.Mocked<RunsService>;

    llmService = {
      answerRepoQuestion: jest.fn(),
      findFiles: jest.fn(),
      explainCode: jest.fn(),
      proposePatch: jest.fn(),
      generateTests: jest.fn(),
      createPrDraft: jest.fn(),
    } as unknown as jest.Mocked<LlmService>;

    retrieval = {
      retrieve: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<RetrievalService>;

    repoSearch = {
      findCandidates: jest.fn(),
    } as unknown as jest.Mocked<RepoSearchService>;

    repoService = {
      findOne: jest.fn(),
      readFileByPath: jest.fn(),
    } as unknown as jest.Mocked<RepoService>;

    patchService = {
      create: jest.fn(),
      findOne: jest.fn(),
    } as unknown as jest.Mocked<PatchService>;

    patchValidator = {
      validatePatchProposal: jest.fn(),
      validateTestOutput: jest.fn(),
    } as unknown as jest.Mocked<PatchValidatorService>;

    testgenService = {
      persistOrchestrated: jest.fn(),
      findOne: jest.fn(),
    } as unknown as jest.Mocked<TestgenService>;

    approvalService = {
      findOne: jest.fn(),
    } as unknown as jest.Mocked<ApprovalService>;

    prDraftService = {
      create: jest.fn(),
      update: jest.fn(),
    } as unknown as jest.Mocked<PrDraftService>;

    githubService = {
      createBranch: jest.fn(),
      createCommit: jest.fn(),
      createPullRequest: jest.fn(),
    } as unknown as jest.Mocked<GithubService>;

    appConfig = {
      githubBaseBranch: 'main',
    } as unknown as jest.Mocked<AppConfigService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgentOrchestrator,
        { provide: RunsService, useValue: runsService },
        { provide: LlmService, useValue: llmService },
        { provide: RetrievalService, useValue: retrieval },
        { provide: RepoSearchService, useValue: repoSearch },
        { provide: RepoService, useValue: repoService },
        { provide: PatchService, useValue: patchService },
        { provide: PatchValidatorService, useValue: patchValidator },
        { provide: TestgenService, useValue: testgenService },
        { provide: ApprovalService, useValue: approvalService },
        { provide: PrDraftService, useValue: prDraftService },
        { provide: GithubService, useValue: githubService },
        { provide: AppConfigService, useValue: appConfig },
      ],
    }).compile();

    orchestrator = module.get(AgentOrchestrator);

    // Wire shared step stubs
    runsService.create.mockResolvedValue(makeRun() as any);
    runsService.markRunning.mockResolvedValue(makeRun() as any);
    runsService.complete.mockResolvedValue(makeRun() as any);
    runsService.fail.mockResolvedValue(makeRun() as any);
    runsService.appendStep.mockResolvedValue(makeStep() as any);
    runsService.startStep.mockResolvedValue(makeStep() as any);
    runsService.completeStep.mockResolvedValue(makeStep() as any);
    runsService.failStep.mockResolvedValue(makeStep() as any);
    repoService.findOne.mockResolvedValue(makeRepo() as any);
  });

  afterEach(() => jest.clearAllMocks());

  // ─── ask() ────────────────────────────────────────────────────────────────

  describe('ask()', () => {
    const dto: AskRepoQuestionDto = {
      repoId: 'repo-1',
      question: 'Where is JWT auth implemented?',
    };

    it('creates and marks a run, runs all stages, completes the run', async () => {
      repoSearch.findCandidates.mockResolvedValue([makeCandidate('src/auth/auth.service.ts')]);
      repoService.readFileByPath.mockResolvedValue({
        fileId: 'f1', repoId: 'repo-1',
        filePath: 'src/auth/auth.service.ts', fileName: 'auth.service.ts',
        language: 'typescript', sizeBytes: 1024, lineCount: 50,
        content: 'export class AuthService {}',
      });
      llmService.answerRepoQuestion.mockResolvedValue({
        answer: 'JWT is in AuthService.',
        confidence: 0.9,
        relevantFiles: ['src/auth/auth.service.ts'],
        reasoning: 'AuthService handles tokens.',
        caveats: [],
      });

      const result = await orchestrator.ask(dto);

      expect(runsService.create).toHaveBeenCalledWith(expect.objectContaining({ type: RunType.ANSWER_QUESTION }));
      expect(runsService.markRunning).toHaveBeenCalled();
      expect(runsService.complete).toHaveBeenCalled();
      expect(result.answer).toBe('JWT is in AuthService.');
      expect(result.confidence).toBe(0.9);
      expect(result.relevantFiles).toHaveLength(1);
      expect(result.runId).toBe('run-1');
    });

    it('logs each stage as a step', async () => {
      repoSearch.findCandidates.mockResolvedValue([]);
      repoService.readFileByPath.mockRejectedValue(new Error('no file'));
      llmService.answerRepoQuestion.mockResolvedValue({
        answer: 'Unknown.',
        confidence: 0.2,
        relevantFiles: [],
        reasoning: 'No context.',
        caveats: ['No files found'],
      });

      await orchestrator.ask(dto);

      // At least: resolve_repo, retrieve_knowledge, find_candidate_files, read_files, llm_answer
      expect(runsService.appendStep.mock.calls.length).toBeGreaterThanOrEqual(4);
    });

    it('fails the run and rethrows when LLM throws', async () => {
      repoSearch.findCandidates.mockResolvedValue([]);
      llmService.answerRepoQuestion.mockRejectedValue(new Error('LLM timeout'));

      await expect(orchestrator.ask(dto)).rejects.toThrow('LLM timeout');
      expect(runsService.fail).toHaveBeenCalledWith('run-1', 'LLM timeout', expect.any(Number));
    });

    it('fails the run when repo lookup throws', async () => {
      repoService.findOne.mockRejectedValue(new Error('Repo not found'));

      await expect(orchestrator.ask(dto)).rejects.toThrow('Repo not found');
      expect(runsService.fail).toHaveBeenCalled();
    });
  });

  // ─── findFiles() ──────────────────────────────────────────────────────────

  describe('findFiles()', () => {
    const dto: FindRelevantFilesDto = {
      repoId: 'repo-1',
      query: 'database connection pooling',
    };

    it('returns ranked files with reasons', async () => {
      repoSearch.findCandidates.mockResolvedValue([
        makeCandidate('src/database/database.service.ts'),
        makeCandidate('src/database/pool.ts'),
      ]);
      llmService.findFiles.mockResolvedValue({
        files: [
          { path: 'src/database/database.service.ts', relevanceScore: 0.95, reason: 'Main DB service' },
          { path: 'src/database/pool.ts', relevanceScore: 0.8, reason: 'Pool config' },
        ],
        searchStrategy: 'keyword + path matching',
        totalMatches: 2,
      });

      const result = await orchestrator.findFiles(dto);

      expect(result.files).toHaveLength(2);
      expect(result.files[0].filePath).toBe('src/database/database.service.ts');
      expect(result.files[0].reason).toBe('Main DB service');
      expect(result.searchStrategy).toBe('keyword + path matching');
      expect(result.totalCandidates).toBe(2);
    });

    it('short-circuits and returns empty when no candidates found', async () => {
      repoSearch.findCandidates.mockResolvedValue([]);

      const result = await orchestrator.findFiles(dto);

      expect(result.files).toHaveLength(0);
      expect(llmService.findFiles).not.toHaveBeenCalled();
      expect(runsService.complete).toHaveBeenCalled();
    });

    it('fails the run when LLM throws', async () => {
      repoSearch.findCandidates.mockResolvedValue([makeCandidate('src/db.ts')]);
      llmService.findFiles.mockRejectedValue(new Error('rate limited'));

      await expect(orchestrator.findFiles(dto)).rejects.toThrow('rate limited');
      expect(runsService.fail).toHaveBeenCalled();
    });
  });

  // ─── explain() ────────────────────────────────────────────────────────────

  describe('explain()', () => {
    const dto: ExplainCodeDto = {
      repoId: 'repo-1',
      filePath: 'src/auth/auth.service.ts',
    };

    it('reads the file, retrieves context, calls LLM, returns explanation', async () => {
      repoService.readFileByPath.mockResolvedValue({
        fileId: 'f1', repoId: 'repo-1',
        filePath: 'src/auth/auth.service.ts', fileName: 'auth.service.ts',
        language: 'typescript', sizeBytes: 2048, lineCount: 120,
        content: 'export class AuthService { sign() {} verify() {} }',
      });
      llmService.explainCode.mockResolvedValue({
        summary: 'Handles JWT auth',
        purpose: 'Issues and verifies JWTs',
        keyComponents: [{ name: 'sign', type: 'function', description: 'Signs tokens' }],
        dependencies: ['jsonwebtoken'],
        sideEffects: ['reads DB for user'],
        complexity: 'low',
        testability: 'high',
        suggestions: ['Add refresh token support'],
      });

      const result = await orchestrator.explain(dto);

      expect(result.summary).toBe('Handles JWT auth');
      expect(result.complexity).toBe('low');
      expect(result.keyComponents).toHaveLength(1);
      expect(result.runId).toBe('run-1');
    });

    it('fails the run when the file cannot be read', async () => {
      repoService.readFileByPath.mockRejectedValue(new Error('File not found'));

      await expect(orchestrator.explain(dto)).rejects.toThrow('File not found');
      expect(runsService.fail).toHaveBeenCalled();
      expect(llmService.explainCode).not.toHaveBeenCalled();
    });
  });

  // ─── proposePatch() ───────────────────────────────────────────────────────

  describe('proposePatch()', () => {
    const dto: ProposePatchDto = {
      repoId: 'repo-1',
      request: 'Fix the email case-sensitivity bug in the login flow.',
    };

    const validLlmPatchOutput = {
      title: 'Fix email case sensitivity in login',
      description: 'Normalise email to lower-case before lookup.',
      diff: `--- a/src/auth/auth.service.ts\n+++ b/src/auth/auth.service.ts\n@@ -10,1 +10,1 @@\n-  const user = await db.user.findUnique({ where: { email } });\n+  const user = await db.user.findUnique({ where: { email: email.toLowerCase() } });`,
      filePaths: ['src/auth/auth.service.ts'],
      riskLevel: 'LOW',
      reasoning: 'Email addresses are case-insensitive per RFC 5321.',
      testingNotes: 'Login with mixed-case email should succeed.',
      breakingChanges: false,
    };

    function setupHappyPath() {
      repoSearch.findCandidates.mockResolvedValue([makeCandidate('src/auth/auth.service.ts')]);
      repoService.readFileByPath.mockResolvedValue(
        makeFileData('src/auth/auth.service.ts', 'const user = await db.user.findUnique({ where: { email } });'),
      );
      llmService.proposePatch.mockResolvedValue(validLlmPatchOutput as any);
      patchValidator.validatePatchProposal.mockReturnValue({ valid: true, errors: [], warnings: [] });
      patchService.create.mockResolvedValue({ id: 'patch-1' } as any);
    }

    it('resolves repo, finds files, reads them, calls LLM, validates, persists, returns response', async () => {
      setupHappyPath();

      const result = await orchestrator.proposePatch(dto);

      expect(runsService.create).toHaveBeenCalledWith(expect.objectContaining({ type: RunType.PROPOSE_PATCH }));
      expect(repoSearch.findCandidates).toHaveBeenCalled();
      expect(repoService.readFileByPath).toHaveBeenCalled();
      expect(llmService.proposePatch).toHaveBeenCalledWith(
        expect.objectContaining({ request: dto.request, repoName: 'buntu/copilot' }),
      );
      expect(patchValidator.validatePatchProposal).toHaveBeenCalledWith(validLlmPatchOutput);
      expect(patchService.create).toHaveBeenCalledWith(
        expect.objectContaining({ riskLevel: RiskLevel.LOW, runId: 'run-1', repoId: dto.repoId }),
      );
      expect(runsService.complete).toHaveBeenCalled();

      expect(result.runId).toBe('run-1');
      expect(result.patchId).toBe('patch-1');
      expect(result.title).toBe('Fix email case sensitivity in login');
      expect(result.riskLevel).toBe(RiskLevel.LOW);
      expect(result.breakingChanges).toBe(false);
      expect(result.validationWarnings).toEqual([]);
    });

    it('includes explicit filePaths in candidate search alongside search results', async () => {
      repoSearch.findCandidates.mockResolvedValue([makeCandidate('src/auth/auth.service.ts')]);
      repoService.readFileByPath.mockResolvedValue(makeFileData('src/auth/auth.service.ts'));
      llmService.proposePatch.mockResolvedValue(validLlmPatchOutput as any);
      patchValidator.validatePatchProposal.mockReturnValue({ valid: true, errors: [], warnings: [] });
      patchService.create.mockResolvedValue({ id: 'patch-2' } as any);

      const dtoWithPaths: ProposePatchDto = {
        ...dto,
        filePaths: ['src/auth/jwt.strategy.ts'],
      };

      const result = await orchestrator.proposePatch(dtoWithPaths);

      // proposePatch calls readFileByPath for all candidates; explicit path is attempted
      expect(repoService.readFileByPath).toHaveBeenCalled();
      expect(result.patchId).toBe('patch-2');
    });

    it('surfaces validation warnings in the response without failing', async () => {
      repoSearch.findCandidates.mockResolvedValue([makeCandidate('src/auth/auth.service.ts')]);
      repoService.readFileByPath.mockResolvedValue(makeFileData('src/auth/auth.service.ts'));
      llmService.proposePatch.mockResolvedValue(validLlmPatchOutput as any);
      patchValidator.validatePatchProposal.mockReturnValue({
        valid: true,
        errors: [],
        warnings: ['security-sensitive path detected at LOW risk'],
      });
      patchService.create.mockResolvedValue({ id: 'patch-3' } as any);

      const result = await orchestrator.proposePatch(dto);

      expect(result.validationWarnings).toContain('security-sensitive path detected at LOW risk');
      expect(runsService.complete).toHaveBeenCalled();
    });

    it('throws ValidationException and fails the run when patch validation fails', async () => {
      repoSearch.findCandidates.mockResolvedValue([makeCandidate('src/auth/auth.service.ts')]);
      repoService.readFileByPath.mockResolvedValue(makeFileData('src/auth/auth.service.ts'));
      llmService.proposePatch.mockResolvedValue({ ...validLlmPatchOutput, diff: '' } as any);
      patchValidator.validatePatchProposal.mockReturnValue({
        valid: false,
        errors: ['Diff is empty'],
        warnings: [],
      });

      await expect(orchestrator.proposePatch(dto)).rejects.toThrow(ValidationException);
      expect(runsService.fail).toHaveBeenCalledWith('run-1', expect.stringContaining('Diff is empty'), expect.any(Number));
      expect(patchService.create).not.toHaveBeenCalled();
    });

    it('fails the run and rethrows when LLM throws', async () => {
      repoSearch.findCandidates.mockResolvedValue([makeCandidate('src/auth/auth.service.ts')]);
      repoService.readFileByPath.mockResolvedValue(makeFileData('src/auth/auth.service.ts'));
      llmService.proposePatch.mockRejectedValue(new Error('LLM quota exceeded'));

      await expect(orchestrator.proposePatch(dto)).rejects.toThrow('LLM quota exceeded');
      expect(runsService.fail).toHaveBeenCalled();
      expect(patchService.create).not.toHaveBeenCalled();
    });

    it('fails the run when repo lookup throws', async () => {
      repoService.findOne.mockRejectedValue(new Error('Repo not found'));

      await expect(orchestrator.proposePatch(dto)).rejects.toThrow('Repo not found');
      expect(runsService.fail).toHaveBeenCalled();
    });

    it('continues reading other files even when one file read fails', async () => {
      repoSearch.findCandidates.mockResolvedValue([
        makeCandidate('src/auth/auth.service.ts'),
        makeCandidate('src/auth/auth.module.ts'),
      ]);
      // First file throws, second succeeds
      repoService.readFileByPath
        .mockRejectedValueOnce(new Error('binary file'))
        .mockResolvedValue(makeFileData('src/auth/auth.module.ts'));
      llmService.proposePatch.mockResolvedValue(validLlmPatchOutput as any);
      patchValidator.validatePatchProposal.mockReturnValue({ valid: true, errors: [], warnings: [] });
      patchService.create.mockResolvedValue({ id: 'patch-4' } as any);

      const result = await orchestrator.proposePatch(dto);

      expect(result.patchId).toBe('patch-4');
      expect(llmService.proposePatch).toHaveBeenCalled();
    });
  });

  // ─── generateTests() ──────────────────────────────────────────────────────

  describe('generateTests()', () => {
    const dto: GenerateTestsAgentDto = {
      repoId: 'repo-1',
      filePath: 'src/auth/auth.service.ts',
    };

    const validLlmTestOutput = {
      testFile: 'src/auth/auth.service.spec.ts',
      content: `describe('AuthService', () => { it('should login', () => { expect(true).toBe(true); }); });`,
      framework: 'jest',
      testCount: 1,
      coveredScenarios: ['login'],
      setupNotes: 'Mock DatabaseService.',
      mockedDependencies: ['DatabaseService'],
    };

    function setupHappyPath() {
      // Target file read
      repoService.readFileByPath
        .mockResolvedValueOnce(makeFileData('src/auth/auth.service.ts'))
        // Spec companion file read
        .mockResolvedValueOnce(makeFileData('src/auth/auth.service.spec.ts', `it('existing test', () => {})`));
      llmService.generateTests.mockResolvedValue(validLlmTestOutput as any);
      patchValidator.validateTestOutput.mockReturnValue({ valid: true, errors: [], warnings: [] });
      testgenService.persistOrchestrated.mockResolvedValue({ id: 'testgen-1' } as any);
    }

    it('reads target file, finds existing spec, calls LLM, validates, persists, returns response', async () => {
      setupHappyPath();

      const result = await orchestrator.generateTests(dto);

      expect(runsService.create).toHaveBeenCalledWith(expect.objectContaining({ type: RunType.GENERATE_TESTS }));
      expect(repoService.readFileByPath).toHaveBeenCalledWith(dto.repoId, dto.filePath);
      expect(llmService.generateTests).toHaveBeenCalledWith(
        expect.objectContaining({ filePath: dto.filePath, language: 'typescript' }),
      );
      expect(patchValidator.validateTestOutput).toHaveBeenCalledWith(validLlmTestOutput);
      expect(testgenService.persistOrchestrated).toHaveBeenCalledWith(
        expect.objectContaining({ repoId: dto.repoId, runId: 'run-1', targetFile: dto.filePath }),
      );
      expect(runsService.complete).toHaveBeenCalled();

      expect(result.runId).toBe('run-1');
      expect(result.testgenId).toBe('testgen-1');
      expect(result.testFile).toBe('src/auth/auth.service.spec.ts');
      expect(result.testCount).toBe(1);
      expect(result.validationWarnings).toEqual([]);
    });

    it('falls back to search when spec companion file is not found', async () => {
      // Target file succeeds
      repoService.readFileByPath
        .mockResolvedValueOnce(makeFileData('src/auth/auth.service.ts'))
        // Spec companion not found
        .mockRejectedValueOnce(new Error('Not found'))
        // Search fallback file
        .mockResolvedValueOnce(makeFileData('src/runs/runs.service.spec.ts', `it('a', () => {})`));

      repoSearch.findCandidates.mockResolvedValue([
        makeCandidate('src/runs/runs.service.spec.ts'),
      ]);

      llmService.generateTests.mockResolvedValue(validLlmTestOutput as any);
      patchValidator.validateTestOutput.mockReturnValue({ valid: true, errors: [], warnings: [] });
      testgenService.persistOrchestrated.mockResolvedValue({ id: 'testgen-2' } as any);

      const result = await orchestrator.generateTests(dto);

      expect(repoSearch.findCandidates).toHaveBeenCalled();
      expect(result.testgenId).toBe('testgen-2');
    });

    it('proceeds without existing test context when no spec file is found anywhere', async () => {
      repoService.readFileByPath
        .mockResolvedValueOnce(makeFileData('src/auth/auth.service.ts'))
        .mockRejectedValue(new Error('Not found'));

      repoSearch.findCandidates.mockResolvedValue([]);

      llmService.generateTests.mockResolvedValue(validLlmTestOutput as any);
      patchValidator.validateTestOutput.mockReturnValue({ valid: true, errors: [], warnings: [] });
      testgenService.persistOrchestrated.mockResolvedValue({ id: 'testgen-3' } as any);

      const result = await orchestrator.generateTests(dto);

      expect(result.testgenId).toBe('testgen-3');
      // LLM is still called even without existing test context
      expect(llmService.generateTests).toHaveBeenCalled();
    });

    it('surfaces validation warnings without failing', async () => {
      setupHappyPath();
      patchValidator.validateTestOutput.mockReturnValue({
        valid: true,
        errors: [],
        warnings: ['testCount mismatch: declared 5 but only found 1 it() call'],
      });

      const result = await orchestrator.generateTests(dto);

      expect(result.validationWarnings).toContain('testCount mismatch: declared 5 but only found 1 it() call');
      expect(runsService.complete).toHaveBeenCalled();
    });

    it('throws ValidationException and fails the run when test validation fails', async () => {
      repoService.readFileByPath.mockResolvedValueOnce(makeFileData('src/auth/auth.service.ts'));
      repoSearch.findCandidates.mockResolvedValue([]);
      llmService.generateTests.mockResolvedValue({ ...validLlmTestOutput, content: 'export const x = 1;' } as any);
      patchValidator.validateTestOutput.mockReturnValue({
        valid: false,
        errors: ['Content has no test calls (it/test/describe)'],
        warnings: [],
      });

      await expect(orchestrator.generateTests(dto)).rejects.toThrow(ValidationException);
      expect(runsService.fail).toHaveBeenCalledWith(
        'run-1',
        expect.stringContaining('no test calls'),
        expect.any(Number),
      );
      expect(testgenService.persistOrchestrated).not.toHaveBeenCalled();
    });

    it('fails the run and rethrows when LLM throws', async () => {
      repoService.readFileByPath.mockResolvedValueOnce(makeFileData('src/auth/auth.service.ts'));
      repoSearch.findCandidates.mockResolvedValue([]);
      llmService.generateTests.mockRejectedValue(new Error('context window exceeded'));

      await expect(orchestrator.generateTests(dto)).rejects.toThrow('context window exceeded');
      expect(runsService.fail).toHaveBeenCalled();
      expect(testgenService.persistOrchestrated).not.toHaveBeenCalled();
    });

    it('fails the run when the target file cannot be read', async () => {
      repoService.readFileByPath.mockRejectedValue(new Error('File not indexed'));

      await expect(orchestrator.generateTests(dto)).rejects.toThrow('File not indexed');
      expect(runsService.fail).toHaveBeenCalled();
      expect(llmService.generateTests).not.toHaveBeenCalled();
    });
  });

  // ─── createPrDraft() ──────────────────────────────────────────────────────

  describe('createPrDraft()', () => {
    const dto: CreatePrDraftAgentDto = {
      repoId: 'repo-1',
      patchId: 'patch-1',
      approvalId: 'approval-1',
      changedFiles: [
        { filePath: 'src/auth/auth.service.ts', content: 'export class AuthService {}' },
      ],
    };

    const mockPatch = {
      id: 'patch-1',
      title: 'Fix email case sensitivity in login',
      diff: `--- a/src/auth/auth.service.ts\n+++ b/src/auth/auth.service.ts\n@@ -1 +1 @@\n-email\n+email.toLowerCase()`,
      description: 'Normalise email.',
      riskLevel: RiskLevel.LOW,
    };

    const mockApproval = {
      id: 'approval-1',
      status: ApprovalStatus.APPROVED,
      patchId: 'patch-1',
    };

    const mockLlmOutput = {
      title: 'fix: normalise email to lower-case on login',
      body: '## Summary\nNormalise email.\n\n## Checklist\n- [x] Unit tests',
      headBranch: 'fix/fix-normalise-email-to-lower-case-on-login',
      labels: ['bug'],
      reviewers: ['alice'],
      checklist: ['Unit tests added'],
      isDraft: true,
    };

    const mockPrResult = {
      prNumber: 42,
      prUrl: 'https://github.com/buntu/copilot/pull/42',
      isDraft: true,
      headBranch: 'fix/fix-normalise-email-to-lower-case-on-login',
      baseBranch: 'main',
      nodeId: 'PR_node_001',
    };

    function setupHappyPath() {
      patchService.findOne.mockResolvedValue(mockPatch as any);
      approvalService.findOne.mockResolvedValue(mockApproval as any);
      llmService.createPrDraft.mockResolvedValue(mockLlmOutput as any);
      githubService.createBranch.mockResolvedValue(undefined);
      githubService.createCommit.mockResolvedValue('new-commit-sha');
      githubService.createPullRequest.mockResolvedValue(mockPrResult as any);
      prDraftService.create.mockResolvedValue({ id: 'prdraft-1' } as any);
      prDraftService.update.mockResolvedValue(undefined as any);
    }

    it('resolves repo, validates approval, calls LLM, creates branch/commit/PR, persists draft', async () => {
      setupHappyPath();

      const result = await orchestrator.createPrDraft(dto);

      expect(runsService.create).toHaveBeenCalledWith(
        expect.objectContaining({ type: RunType.CREATE_PR_DRAFT }),
      );
      expect(patchService.findOne).toHaveBeenCalledWith('patch-1');
      expect(approvalService.findOne).toHaveBeenCalledWith('approval-1');
      expect(llmService.createPrDraft).toHaveBeenCalledWith(
        expect.objectContaining({ patchTitle: mockPatch.title, repoName: 'buntu/copilot' }),
      );
      expect(githubService.createBranch).toHaveBeenCalledWith(
        expect.objectContaining({ branchName: mockLlmOutput.headBranch, baseBranch: 'main' }),
      );
      expect(githubService.createCommit).toHaveBeenCalledWith(
        expect.objectContaining({
          branchName: mockLlmOutput.headBranch,
          files: expect.arrayContaining([
            expect.objectContaining({ filePath: 'src/auth/auth.service.ts' }),
          ]),
        }),
      );
      expect(githubService.createPullRequest).toHaveBeenCalledWith(
        expect.objectContaining({ title: mockLlmOutput.title, isDraft: true }),
      );
      expect(prDraftService.create).toHaveBeenCalled();
      expect(prDraftService.update).toHaveBeenCalledWith(
        'prdraft-1',
        expect.objectContaining({ prNumber: 42, status: PrDraftStatus.OPEN }),
      );
      expect(runsService.complete).toHaveBeenCalled();

      expect(result.runId).toBe('run-1');
      expect(result.prDraftId).toBe('prdraft-1');
      expect(result.prNumber).toBe(42);
      expect(result.prUrl).toBe('https://github.com/buntu/copilot/pull/42');
      expect(result.isDraft).toBe(true);
      expect(result.status).toBe(PrDraftStatus.OPEN);
    });

    it('throws ValidationException when approval status is not APPROVED', async () => {
      patchService.findOne.mockResolvedValue(mockPatch as any);
      approvalService.findOne.mockResolvedValue({
        ...mockApproval,
        status: ApprovalStatus.WAITING,
      } as any);

      await expect(orchestrator.createPrDraft(dto)).rejects.toThrow(ValidationException);
      expect(runsService.fail).toHaveBeenCalled();
      expect(githubService.createBranch).not.toHaveBeenCalled();
    });

    it('throws ValidationException when approval patchId does not match dto.patchId', async () => {
      patchService.findOne.mockResolvedValue(mockPatch as any);
      approvalService.findOne.mockResolvedValue({
        ...mockApproval,
        patchId: 'patch-OTHER',
      } as any);

      await expect(orchestrator.createPrDraft(dto)).rejects.toThrow(ValidationException);
      expect(runsService.fail).toHaveBeenCalled();
      expect(githubService.createBranch).not.toHaveBeenCalled();
    });

    it('includes generated test file when testgenId is provided and not already in changedFiles', async () => {
      setupHappyPath();
      testgenService.findOne.mockResolvedValue({
        id: 'testgen-1',
        testFile: 'src/auth/auth.service.spec.ts',
        content: `it('passes', () => {});`,
      } as any);

      const dtoWithTestgen: CreatePrDraftAgentDto = { ...dto, testgenId: 'testgen-1' };
      await orchestrator.createPrDraft(dtoWithTestgen);

      expect(githubService.createCommit).toHaveBeenCalledWith(
        expect.objectContaining({
          files: expect.arrayContaining([
            expect.objectContaining({ filePath: 'src/auth/auth.service.spec.ts' }),
          ]),
        }),
      );
    });

    it('skips testgen file when testgenId is provided but record is not found', async () => {
      setupHappyPath();
      testgenService.findOne.mockRejectedValue(new Error('Not found'));

      const dtoWithTestgen: CreatePrDraftAgentDto = { ...dto, testgenId: 'testgen-missing' };
      // Should NOT throw — missing testgen is non-fatal
      const result = await orchestrator.createPrDraft(dtoWithTestgen);

      expect(result.prNumber).toBe(42);
      expect(githubService.createCommit).toHaveBeenCalledWith(
        expect.objectContaining({ files: expect.arrayContaining([]) }),
      );
    });

    it('fails the run when GitHub branch creation throws', async () => {
      setupHappyPath();
      githubService.createBranch.mockRejectedValue(new Error('Branch already exists'));

      await expect(orchestrator.createPrDraft(dto)).rejects.toThrow('Branch already exists');
      expect(runsService.fail).toHaveBeenCalled();
      expect(githubService.createCommit).not.toHaveBeenCalled();
    });

    it('fails the run when LLM throws', async () => {
      patchService.findOne.mockResolvedValue(mockPatch as any);
      approvalService.findOne.mockResolvedValue(mockApproval as any);
      llmService.createPrDraft.mockRejectedValue(new Error('LLM context window exceeded'));

      await expect(orchestrator.createPrDraft(dto)).rejects.toThrow('LLM context window exceeded');
      expect(runsService.fail).toHaveBeenCalled();
      expect(githubService.createBranch).not.toHaveBeenCalled();
    });

    it('uses dto.baseBranch over config.githubBaseBranch when provided', async () => {
      setupHappyPath();

      const dtoWithBase: CreatePrDraftAgentDto = { ...dto, baseBranch: 'develop' };
      await orchestrator.createPrDraft(dtoWithBase);

      expect(githubService.createBranch).toHaveBeenCalledWith(
        expect.objectContaining({ baseBranch: 'develop' }),
      );
    });
  });
});
