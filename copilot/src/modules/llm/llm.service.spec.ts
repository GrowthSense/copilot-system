import { Test, TestingModule } from '@nestjs/testing';
import { LlmService } from './llm.service';
import { PromptBuilderService } from './prompt-builder.service';
import { OutputParserService } from './output-parser.service';
import { GuardrailsService } from './guardrails.service';
import { LLM_PROVIDER_TOKEN } from './providers/llm-provider.token';
import { AppConfigService } from '../../config/config.service';
import { LlmOutputParseException, LlmGuardrailException } from './llm.exception';
import { RepoQuestionOutputSchema } from './schemas/repo-question.schema';
import { z } from 'zod';

const TestSchema = z.object({ value: z.string() });

const mockProvider = {
  providerName: 'mock',
  complete: jest.fn(),
};

const mockConfig = {
  llmStructuredOutputRetries: 2,
  llmMaxContextTokens: 100000,
  llmModel: 'gpt-4o',
  llmMaxTokens: 4096,
  llmTemperature: 0.2,
};

const mockPromptBuilder = {
  buildRepoQuestion: jest.fn().mockReturnValue([{ role: 'user', content: 'q' }]),
  buildFindFiles: jest.fn().mockReturnValue([{ role: 'user', content: 'q' }]),
  buildExplainCode: jest.fn().mockReturnValue([{ role: 'user', content: 'q' }]),
  buildProposePatch: jest.fn().mockReturnValue([{ role: 'user', content: 'q' }]),
  buildGenerateTests: jest.fn().mockReturnValue([{ role: 'user', content: 'q' }]),
  buildCreatePrDraft: jest.fn().mockReturnValue([{ role: 'user', content: 'q' }]),
};

const mockOutputParser = {
  safeParseJson: jest.fn(),
  parseJson: jest.fn(),
};

const mockGuardrails = {
  assertMessagesNotEmpty: jest.fn(),
  assertContextWithinBudget: jest.fn(),
  assertResponseNotEmpty: jest.fn(),
  assertFinishReasonNotLength: jest.fn(),
};

const okResponse = {
  content: '{"value":"hello"}',
  model: 'gpt-4o',
  promptTokens: 10,
  completionTokens: 5,
  totalTokens: 15,
  finishReason: 'stop',
};

describe('LlmService', () => {
  let service: LlmService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LlmService,
        { provide: LLM_PROVIDER_TOKEN, useValue: mockProvider },
        { provide: AppConfigService, useValue: mockConfig },
        { provide: PromptBuilderService, useValue: mockPromptBuilder },
        { provide: OutputParserService, useValue: mockOutputParser },
        { provide: GuardrailsService, useValue: mockGuardrails },
      ],
    }).compile();

    service = module.get<LlmService>(LlmService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─── completeStructured ────────────────────────────────────────────────────

  describe('completeStructured', () => {
    it('returns parsed data on first attempt', async () => {
      mockProvider.complete.mockResolvedValue(okResponse);
      mockOutputParser.safeParseJson.mockReturnValue({ success: true, data: { value: 'hello' } });

      const result = await service.completeStructured(
        [{ role: 'user', content: 'test' }],
        TestSchema,
      );

      expect(result).toEqual({ value: 'hello' });
      expect(mockProvider.complete).toHaveBeenCalledTimes(1);
    });

    it('retries when parse fails and succeeds on retry', async () => {
      const parseError = new LlmOutputParseException('bad json', 'raw');
      mockProvider.complete.mockResolvedValue(okResponse);
      mockOutputParser.safeParseJson
        .mockReturnValueOnce({ success: false, error: parseError })
        .mockReturnValueOnce({ success: true, data: { value: 'fixed' } });

      const result = await service.completeStructured(
        [{ role: 'user', content: 'test' }],
        TestSchema,
      );

      expect(result).toEqual({ value: 'fixed' });
      expect(mockProvider.complete).toHaveBeenCalledTimes(2);
    });

    it('appends correction feedback to messages on retry', async () => {
      const parseError = new LlmOutputParseException('missing field', 'bad');
      mockProvider.complete.mockResolvedValue(okResponse);
      mockOutputParser.safeParseJson
        .mockReturnValueOnce({ success: false, error: parseError })
        .mockReturnValueOnce({ success: true, data: { value: 'ok' } });

      await service.completeStructured([{ role: 'user', content: 'original' }], TestSchema);

      const secondCallMessages = mockProvider.complete.mock.calls[1][0].messages;
      expect(secondCallMessages).toHaveLength(3); // original + assistant (bad) + user (correction)
      expect(secondCallMessages[2].role).toBe('user');
      expect(secondCallMessages[2].content).toContain('not valid JSON');
    });

    it('throws LlmOutputParseException after all retries exhausted', async () => {
      const parseError = new LlmOutputParseException('always fails', 'raw');
      mockProvider.complete.mockResolvedValue(okResponse);
      mockOutputParser.safeParseJson.mockReturnValue({ success: false, error: parseError });

      await expect(
        service.completeStructured([{ role: 'user', content: 'test' }], TestSchema),
      ).rejects.toThrow(LlmOutputParseException);

      // 1 initial + 2 retries = 3 total calls
      expect(mockProvider.complete).toHaveBeenCalledTimes(3);
    });

    it('propagates guardrail exceptions without retrying', async () => {
      mockGuardrails.assertContextWithinBudget.mockImplementation(() => {
        throw new LlmGuardrailException('context too large');
      });

      await expect(
        service.completeStructured([{ role: 'user', content: 'test' }], TestSchema),
      ).rejects.toThrow(LlmGuardrailException);

      expect(mockProvider.complete).not.toHaveBeenCalled();
    });

    it('uses json_object response format on every call', async () => {
      mockProvider.complete.mockResolvedValue(okResponse);
      mockOutputParser.safeParseJson.mockReturnValue({ success: true, data: { value: 'x' } });

      await service.completeStructured([{ role: 'user', content: 'test' }], TestSchema);

      expect(mockProvider.complete).toHaveBeenCalledWith(
        expect.objectContaining({ responseFormat: 'json_object' }),
      );
    });
  });

  // ─── Task-specific methods ─────────────────────────────────────────────────

  describe('answerRepoQuestion', () => {
    it('delegates to promptBuilder and completeStructured', async () => {
      mockProvider.complete.mockResolvedValue(okResponse);
      const validOutput = {
        answer: 'It handles auth',
        confidence: 0.9,
        relevantFiles: ['src/auth.ts'],
        reasoning: 'Found auth service',
        caveats: [],
      };
      mockOutputParser.safeParseJson.mockReturnValue({ success: true, data: validOutput });

      const result = await service.answerRepoQuestion({
        question: 'What handles auth?',
        repoName: 'buntu/api',
        codeContext: [],
      });

      expect(result.answer).toBe('It handles auth');
      expect(mockPromptBuilder.buildRepoQuestion).toHaveBeenCalledTimes(1);
    });
  });

  describe('findFiles', () => {
    it('delegates to promptBuilder and returns parsed output', async () => {
      mockProvider.complete.mockResolvedValue(okResponse);
      const validOutput = {
        files: [{ path: 'src/auth.ts', relevanceScore: 0.95, reason: 'auth logic' }],
        searchStrategy: 'keyword match',
        totalMatches: 1,
      };
      mockOutputParser.safeParseJson.mockReturnValue({ success: true, data: validOutput });

      const result = await service.findFiles({
        query: 'authentication',
        repoName: 'buntu/api',
        fileList: ['src/auth.ts'],
      });

      expect(result.files).toHaveLength(1);
      expect(mockPromptBuilder.buildFindFiles).toHaveBeenCalledTimes(1);
    });
  });
});
