import { Test, TestingModule } from '@nestjs/testing';
import { AgentController } from '../agent.controller';
import { AgentService } from '../agent.service';
import { AskRepoQuestionDto } from '../dto/ask-repo-question.dto';
import { FindRelevantFilesDto } from '../dto/find-relevant-files.dto';
import { ExplainCodeDto } from '../dto/explain-code.dto';
import { ProposePatchDto } from '../dto/propose-patch.dto';
import { GenerateTestsAgentDto } from '../dto/generate-tests-agent.dto';
import { CreatePrDraftAgentDto } from '../dto/create-pr-draft-agent.dto';
import { AskRepoQuestionResponseDto } from '../dto/ask-repo-question-response.dto';
import { FindRelevantFilesResponseDto } from '../dto/find-relevant-files-response.dto';
import { ExplainCodeResponseDto } from '../dto/explain-code-response.dto';
import { ProposePatchResponseDto } from '../dto/propose-patch-response.dto';
import { GenerateTestsAgentResponseDto } from '../dto/generate-tests-agent-response.dto';
import { CreatePrDraftAgentResponseDto } from '../dto/create-pr-draft-agent-response.dto';
import { RiskLevel } from '../../../common/enums/risk-level.enum';
import { PrDraftStatus } from '../../../common/enums/pr-draft-status.enum';

describe('AgentController', () => {
  let controller: AgentController;
  let agentService: jest.Mocked<AgentService>;

  beforeEach(async () => {
    agentService = {
      ask: jest.fn(),
      findFiles: jest.fn(),
      explain: jest.fn(),
      proposePatch: jest.fn(),
      generateTests: jest.fn(),
      createPrDraft: jest.fn(),
      createRun: jest.fn(),
      getRun: jest.fn(),
      listRuns: jest.fn(),
    } as unknown as jest.Mocked<AgentService>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AgentController],
      providers: [{ provide: AgentService, useValue: agentService }],
    }).compile();

    controller = module.get(AgentController);
  });

  afterEach(() => jest.clearAllMocks());

  // ─── POST /agent/ask ──────────────────────────────────────────────────────

  describe('POST /agent/ask', () => {
    it('delegates to agentService.ask and wraps result in ApiResponse', async () => {
      const dto: AskRepoQuestionDto = { repoId: 'r1', question: 'How does auth work?' };
      const serviceResult: AskRepoQuestionResponseDto = {
        runId: 'run-1',
        question: dto.question,
        answer: 'Auth is in AuthService.',
        confidence: 0.9,
        relevantFiles: [{ filePath: 'src/auth/auth.service.ts' }],
        reasoning: 'AuthService signs JWTs.',
        caveats: [],
        durationMs: 350,
      };
      agentService.ask.mockResolvedValue(serviceResult);

      const response = await controller.ask(dto);

      expect(response.success).toBe(true);
      expect(response.data).toEqual(serviceResult);
      expect(response.message).toBe('Question answered');
      expect(agentService.ask).toHaveBeenCalledWith(dto);
    });

    it('propagates errors from agentService.ask', async () => {
      agentService.ask.mockRejectedValue(new Error('LLM unavailable'));
      const dto: AskRepoQuestionDto = { repoId: 'r1', question: 'Some question?' };
      await expect(controller.ask(dto)).rejects.toThrow('LLM unavailable');
    });
  });

  // ─── POST /agent/find-files ───────────────────────────────────────────────

  describe('POST /agent/find-files', () => {
    it('delegates to agentService.findFiles and wraps result', async () => {
      const dto: FindRelevantFilesDto = { repoId: 'r1', query: 'database migrations' };
      const serviceResult: FindRelevantFilesResponseDto = {
        runId: 'run-2',
        query: dto.query,
        files: [
          {
            filePath: 'src/db/migrations.ts',
            fileName: 'migrations.ts',
            language: 'typescript',
            lineCount: 200,
            relevanceScore: 0.95,
            reason: 'Directly handles migrations',
          },
        ],
        searchStrategy: 'filename + content matching',
        totalCandidates: 3,
        durationMs: 180,
      };
      agentService.findFiles.mockResolvedValue(serviceResult);

      const response = await controller.findFiles(dto);

      expect(response.success).toBe(true);
      expect(response.data?.files).toHaveLength(1);
      expect(response.message).toBe('Relevant files found');
    });
  });

  // ─── POST /agent/explain ──────────────────────────────────────────────────

  describe('POST /agent/explain', () => {
    it('delegates to agentService.explain and wraps result', async () => {
      const dto: ExplainCodeDto = { repoId: 'r1', filePath: 'src/auth/auth.service.ts' };
      const serviceResult: ExplainCodeResponseDto = {
        runId: 'run-3',
        filePath: dto.filePath,
        summary: 'Manages JWT issuance and verification.',
        purpose: 'Handles authentication for the API.',
        keyComponents: [{ name: 'AuthService', type: 'class', description: 'Injectable auth service' }],
        dependencies: ['@nestjs/jwt', '@nestjs/common'],
        sideEffects: ['reads User table'],
        complexity: 'low',
        testability: 'high',
        suggestions: ['Extract token expiry config'],
        durationMs: 420,
      };
      agentService.explain.mockResolvedValue(serviceResult);

      const response = await controller.explain(dto);

      expect(response.success).toBe(true);
      expect(response.data?.summary).toBe('Manages JWT issuance and verification.');
      expect(response.message).toBe('Code explained');
    });
  });

  // ─── POST /agent/propose-patch ────────────────────────────────────────────

  describe('POST /agent/propose-patch', () => {
    it('delegates to agentService.proposePatch and wraps result', async () => {
      const dto: ProposePatchDto = {
        repoId: 'r1',
        request: 'Fix the email case-sensitivity bug in login.',
      };
      const serviceResult: ProposePatchResponseDto = {
        runId: 'run-4',
        patchId: 'patch-1',
        title: 'Fix email case sensitivity in login',
        description: 'Normalise email to lower-case before lookup.',
        diff: `--- a/src/auth/auth.service.ts\n+++ b/src/auth/auth.service.ts\n@@ -10 +10 @@\n-email\n+email.toLowerCase()`,
        filePaths: ['src/auth/auth.service.ts'],
        riskLevel: RiskLevel.LOW,
        breakingChanges: false,
        reasoning: 'Email addresses are case-insensitive per RFC 5321.',
        testingNotes: 'Login with mixed-case email should succeed.',
        validationWarnings: [],
        durationMs: 2400,
      };
      agentService.proposePatch.mockResolvedValue(serviceResult);

      const response = await controller.proposePatch(dto);

      expect(response.success).toBe(true);
      expect(response.data).toEqual(serviceResult);
      expect(response.message).toBe('Patch proposal created');
      expect(agentService.proposePatch).toHaveBeenCalledWith(dto);
    });

    it('includes validation warnings in the response', async () => {
      const dto: ProposePatchDto = { repoId: 'r1', request: 'Refactor auth middleware.' };
      agentService.proposePatch.mockResolvedValue({
        runId: 'run-5',
        patchId: 'patch-2',
        title: 'Refactor auth',
        description: 'Refactored',
        diff: `--- a/src/auth/jwt.strategy.ts\n+++ b/src/auth/jwt.strategy.ts\n@@ -1 +1 @@\n-old\n+new`,
        filePaths: ['src/auth/jwt.strategy.ts'],
        riskLevel: RiskLevel.LOW,
        breakingChanges: false,
        reasoning: 'Cleaner code.',
        testingNotes: 'Test JWT validation.',
        validationWarnings: ['security-sensitive path detected at LOW risk'],
        durationMs: 1800,
      });

      const response = await controller.proposePatch(dto);

      expect(response.data?.validationWarnings).toContain('security-sensitive path detected at LOW risk');
    });

    it('propagates errors from agentService.proposePatch', async () => {
      const dto: ProposePatchDto = { repoId: 'r1', request: 'Do something to the codebase.' };
      agentService.proposePatch.mockRejectedValue(new Error('Validation failed: Diff is empty'));

      await expect(controller.proposePatch(dto)).rejects.toThrow('Validation failed: Diff is empty');
    });
  });

  // ─── POST /agent/generate-tests ───────────────────────────────────────────

  describe('POST /agent/generate-tests', () => {
    it('delegates to agentService.generateTests and wraps result', async () => {
      const dto: GenerateTestsAgentDto = {
        repoId: 'r1',
        filePath: 'src/auth/auth.service.ts',
      };
      const serviceResult: GenerateTestsAgentResponseDto = {
        runId: 'run-6',
        testgenId: 'testgen-1',
        targetFile: dto.filePath,
        testFile: 'src/auth/auth.service.spec.ts',
        content: `describe('AuthService', () => { it('should login', () => { expect(true).toBe(true); }); });`,
        framework: 'jest',
        testCount: 1,
        coveredScenarios: ['login'],
        setupNotes: 'Mock DatabaseService.',
        mockedDependencies: ['DatabaseService'],
        validationWarnings: [],
        durationMs: 3100,
      };
      agentService.generateTests.mockResolvedValue(serviceResult);

      const response = await controller.generateTests(dto);

      expect(response.success).toBe(true);
      expect(response.data).toEqual(serviceResult);
      expect(response.message).toBe('Tests generated');
      expect(agentService.generateTests).toHaveBeenCalledWith(dto);
    });

    it('forwards optional framework and additionalContext to the service', async () => {
      const dto: GenerateTestsAgentDto = {
        repoId: 'r1',
        filePath: 'src/auth/auth.service.ts',
        framework: 'vitest',
        additionalContext: 'Focus on error cases.',
      };
      agentService.generateTests.mockResolvedValue({
        runId: 'run-7',
        testgenId: 'testgen-2',
        targetFile: dto.filePath,
        testFile: 'src/auth/auth.service.spec.ts',
        content: `test('error case', () => {});`,
        framework: 'vitest',
        testCount: 1,
        coveredScenarios: ['error case'],
        setupNotes: '',
        mockedDependencies: [],
        validationWarnings: [],
        durationMs: 2800,
      });

      await controller.generateTests(dto);

      expect(agentService.generateTests).toHaveBeenCalledWith(
        expect.objectContaining({ framework: 'vitest', additionalContext: 'Focus on error cases.' }),
      );
    });

    it('propagates errors from agentService.generateTests', async () => {
      const dto: GenerateTestsAgentDto = { repoId: 'r1', filePath: 'src/missing/file.ts' };
      agentService.generateTests.mockRejectedValue(new Error('File not indexed'));

      await expect(controller.generateTests(dto)).rejects.toThrow('File not indexed');
    });
  });

  // ─── POST /agent/create-pr-draft ─────────────────────────────────────────

  describe('POST /agent/create-pr-draft', () => {
    const dto: CreatePrDraftAgentDto = {
      repoId: 'r1',
      patchId: 'patch-1',
      approvalId: 'approval-1',
      changedFiles: [
        { filePath: 'src/auth/auth.service.ts', content: 'export class AuthService {}' },
      ],
    };

    it('delegates to agentService.createPrDraft and wraps result', async () => {
      const serviceResult: CreatePrDraftAgentResponseDto = {
        runId: 'run-8',
        prDraftId: 'prdraft-1',
        prNumber: 42,
        prUrl: 'https://github.com/buntu/copilot/pull/42',
        title: 'fix: normalise email to lower-case on login',
        body: '## Summary\nFix login.',
        headBranch: 'fix/normalise-email',
        baseBranch: 'main',
        labels: ['bug'],
        checklist: ['Unit tests added'],
        riskLevel: RiskLevel.LOW,
        isDraft: true,
        status: PrDraftStatus.OPEN,
        durationMs: 4200,
      };
      agentService.createPrDraft.mockResolvedValue(serviceResult);

      const response = await controller.createPrDraft(dto);

      expect(response.success).toBe(true);
      expect(response.data).toEqual(serviceResult);
      expect(response.message).toBe('PR draft created');
      expect(agentService.createPrDraft).toHaveBeenCalledWith(dto);
    });

    it('propagates errors from agentService.createPrDraft', async () => {
      agentService.createPrDraft.mockRejectedValue(
        new Error('Approval "approval-1" has status "WAITING"'),
      );

      await expect(controller.createPrDraft(dto)).rejects.toThrow(
        'Approval "approval-1" has status "WAITING"',
      );
    });
  });

  // ─── Run management ───────────────────────────────────────────────────────

  describe('GET /agent/runs', () => {
    it('returns an ok-wrapped list of runs', async () => {
      agentService.listRuns.mockResolvedValue([]);
      const response = await controller.listRuns();
      expect(response.success).toBe(true);
      expect(response.data).toEqual([]);
    });
  });

  describe('GET /agent/runs/:id', () => {
    it('returns an ok-wrapped run', async () => {
      const run = { id: 'run-1' } as any;
      agentService.getRun.mockResolvedValue(run);
      const response = await controller.getRun('run-1');
      expect(response.data?.id).toBe('run-1');
    });
  });
});
