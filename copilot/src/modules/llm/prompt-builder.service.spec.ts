import { Test, TestingModule } from '@nestjs/testing';
import { PromptBuilderService } from './prompt-builder.service';

describe('PromptBuilderService', () => {
  let service: PromptBuilderService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PromptBuilderService],
    }).compile();

    service = module.get<PromptBuilderService>(PromptBuilderService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─── buildRepoQuestion ─────────────────────────────────────────────────────

  describe('buildRepoQuestion', () => {
    const input = {
      question: 'How does authentication work?',
      repoName: 'buntu/api',
      codeContext: [{ filePath: 'src/auth.service.ts', content: 'export class AuthService {}' }],
    };

    it('returns exactly two messages', () => {
      const messages = service.buildRepoQuestion(input);
      expect(messages).toHaveLength(2);
    });

    it('first message is the system role', () => {
      const [system] = service.buildRepoQuestion(input);
      expect(system.role).toBe('system');
    });

    it('second message is from the user', () => {
      const [, user] = service.buildRepoQuestion(input);
      expect(user.role).toBe('user');
    });

    it('system message contains JSON schema documentation', () => {
      const [system] = service.buildRepoQuestion(input);
      expect(system.content).toContain('"answer"');
      expect(system.content).toContain('"confidence"');
      expect(system.content).toContain('"relevantFiles"');
    });

    it('user message contains the question', () => {
      const [, user] = service.buildRepoQuestion(input);
      expect(user.content).toContain(input.question);
    });

    it('user message contains the repo name', () => {
      const [, user] = service.buildRepoQuestion(input);
      expect(user.content).toContain(input.repoName);
    });

    it('user message contains the file path from context', () => {
      const [, user] = service.buildRepoQuestion(input);
      expect(user.content).toContain('src/auth.service.ts');
    });

    it('system message contains JSON output contract', () => {
      const [system] = service.buildRepoQuestion(input);
      expect(system.content).toContain('valid JSON object');
    });
  });

  // ─── buildFindFiles ────────────────────────────────────────────────────────

  describe('buildFindFiles', () => {
    const input = {
      query: 'database connection pooling',
      repoName: 'buntu/api',
      fileList: ['src/database/database.service.ts', 'src/app.module.ts'],
      limit: 5,
    };

    it('returns two messages with correct roles', () => {
      const messages = service.buildFindFiles(input);
      expect(messages).toHaveLength(2);
      expect(messages[0].role).toBe('system');
      expect(messages[1].role).toBe('user');
    });

    it('user message includes the query', () => {
      const [, user] = service.buildFindFiles(input);
      expect(user.content).toContain(input.query);
    });

    it('user message includes file paths from the list', () => {
      const [, user] = service.buildFindFiles(input);
      expect(user.content).toContain('src/database/database.service.ts');
    });

    it('user message includes the limit', () => {
      const [, user] = service.buildFindFiles(input);
      expect(user.content).toContain('5');
    });

    it('system message contains schema doc fields', () => {
      const [system] = service.buildFindFiles(input);
      expect(system.content).toContain('"relevanceScore"');
      expect(system.content).toContain('"searchStrategy"');
    });
  });

  // ─── buildExplainCode ──────────────────────────────────────────────────────

  describe('buildExplainCode', () => {
    const input = {
      filePath: 'src/runs/runs.service.ts',
      content: 'export class RunsService { async create() {} }',
      language: 'TypeScript',
    };

    it('user message contains the file path', () => {
      const [, user] = service.buildExplainCode(input);
      expect(user.content).toContain(input.filePath);
    });

    it('user message contains the source content', () => {
      const [, user] = service.buildExplainCode(input);
      expect(user.content).toContain('RunsService');
    });

    it('user message includes language annotation when provided', () => {
      const [, user] = service.buildExplainCode(input);
      expect(user.content).toContain('TypeScript');
    });

    it('system message contains complexity field doc', () => {
      const [system] = service.buildExplainCode(input);
      expect(system.content).toContain('"complexity"');
    });
  });

  // ─── buildProposePatch ─────────────────────────────────────────────────────

  describe('buildProposePatch', () => {
    const input = {
      request: 'Add input validation to the createRun endpoint',
      repoName: 'buntu/api',
      targetFiles: [{ filePath: 'src/runs/runs.controller.ts', content: '@Controller() export class RunsController {}' }],
    };

    it('user message contains the change request', () => {
      const [, user] = service.buildProposePatch(input);
      expect(user.content).toContain(input.request);
    });

    it('user message contains the target file path', () => {
      const [, user] = service.buildProposePatch(input);
      expect(user.content).toContain('src/runs/runs.controller.ts');
    });

    it('system message references riskLevel and breakingChanges', () => {
      const [system] = service.buildProposePatch(input);
      expect(system.content).toContain('"riskLevel"');
      expect(system.content).toContain('"breakingChanges"');
    });

    it('includes additional constraints in user message when provided', () => {
      const withConstraints = { ...input, constraints: ['Do not change public API'] };
      const [, user] = service.buildProposePatch(withConstraints);
      expect(user.content).toContain('Do not change public API');
    });
  });

  // ─── buildGenerateTests ────────────────────────────────────────────────────

  describe('buildGenerateTests', () => {
    const input = {
      filePath: 'src/audit/audit.service.ts',
      content: 'export class AuditService { async log() {} }',
      framework: 'jest',
    };

    it('user message contains the file to test', () => {
      const [, user] = service.buildGenerateTests(input);
      expect(user.content).toContain(input.filePath);
    });

    it('user message specifies the framework', () => {
      const [, user] = service.buildGenerateTests(input);
      expect(user.content).toContain('jest');
    });

    it('system message references testCount', () => {
      const [system] = service.buildGenerateTests(input);
      expect(system.content).toContain('"testCount"');
    });
  });

  // ─── buildCreatePrDraft ────────────────────────────────────────────────────

  describe('buildCreatePrDraft', () => {
    const input = {
      repoName: 'buntu/api',
      diff: '--- a/src/auth.ts\n+++ b/src/auth.ts\n@@ -1 +1 @@\n-old\n+new',
      patchTitle: 'Fix auth token expiry',
      patchDescription: 'Corrects the JWT expiry calculation',
      suggestedBranch: 'fix/auth-token-expiry',
      baseBranch: 'main',
      teamReviewers: ['alice', 'bob'],
    };

    it('user message contains the patch title', () => {
      const [, user] = service.buildCreatePrDraft(input);
      expect(user.content).toContain(input.patchTitle);
    });

    it('user message contains the diff', () => {
      const [, user] = service.buildCreatePrDraft(input);
      expect(user.content).toContain('--- a/src/auth.ts');
    });

    it('user message lists reviewers when provided', () => {
      const [, user] = service.buildCreatePrDraft(input);
      expect(user.content).toContain('alice');
      expect(user.content).toContain('bob');
    });

    it('system message references isDraft and checklist', () => {
      const [system] = service.buildCreatePrDraft(input);
      expect(system.content).toContain('"isDraft"');
      expect(system.content).toContain('"checklist"');
    });
  });
});
