import { Test, TestingModule } from '@nestjs/testing';
import { ChatService } from '../chat.service';
import { ChatOrchestrator } from '../chat.orchestrator';
import { ChatMemoryService } from '../chat.memory.service';
import { RunsService } from '../../runs/runs.service';
import { RepoService } from '../../repo/repo.service';
import { RunType } from '../../../common/enums/run-type.enum';
import { RunStatus } from '../../../common/enums/run-status.enum';
import { ChatRequestDto } from '../dto/chat.dto';
import { ResourceNotFoundException } from '../../../common/exceptions/app.exception';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRun(id = 'run-chat-1') {
  return {
    id,
    type: RunType.CHAT,
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

function makeRepo() {
  return { id: 'repo-1', name: 'copilot', fullName: 'buntu/copilot', isActive: true };
}

const VALID_DTO: ChatRequestDto = {
  sessionId: 'sess-abc',
  repoId: 'repo-1',
  message: 'Where is the JWT authentication implemented?',
};

const ORCHESTRATOR_RESULT = {
  reply: 'JWT authentication is implemented in `src/auth/auth.service.ts`.',
  relevantFiles: ['src/auth/auth.service.ts'],
  sources: ['Architecture Decision Records'],
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ChatService', () => {
  let service: ChatService;
  let orchestrator: jest.Mocked<ChatOrchestrator>;
  let memory: jest.Mocked<ChatMemoryService>;
  let runsService: jest.Mocked<RunsService>;
  let repoService: jest.Mocked<RepoService>;

  beforeEach(async () => {
    orchestrator = {
      chat: jest.fn(),
    } as unknown as jest.Mocked<ChatOrchestrator>;

    memory = {
      addMessage: jest.fn(),
      getHistory: jest.fn().mockReturnValue([]),
      getContextWindow: jest.fn().mockReturnValue([]),
      clearSession: jest.fn(),
      getSessionCount: jest.fn().mockReturnValue(0),
    } as unknown as jest.Mocked<ChatMemoryService>;

    runsService = {
      create: jest.fn(),
      markRunning: jest.fn(),
      complete: jest.fn(),
      fail: jest.fn(),
    } as unknown as jest.Mocked<RunsService>;

    repoService = {
      findOne: jest.fn(),
    } as unknown as jest.Mocked<RepoService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        { provide: ChatOrchestrator, useValue: orchestrator },
        { provide: ChatMemoryService, useValue: memory },
        { provide: RunsService, useValue: runsService },
        { provide: RepoService, useValue: repoService },
      ],
    }).compile();

    service = module.get(ChatService);

    runsService.create.mockResolvedValue(makeRun() as any);
    runsService.markRunning.mockResolvedValue(makeRun() as any);
    runsService.complete.mockResolvedValue(makeRun() as any);
    runsService.fail.mockResolvedValue(makeRun() as any);
    repoService.findOne.mockResolvedValue(makeRepo() as any);
  });

  afterEach(() => jest.clearAllMocks());

  // ─── Normal chat ──────────────────────────────────────────────────────────

  describe('normal chat flow', () => {
    it('creates a CHAT run, calls orchestrator, stores messages, returns response', async () => {
      orchestrator.chat.mockResolvedValue(ORCHESTRATOR_RESULT);

      const result = await service.chat(VALID_DTO);

      // Run lifecycle
      expect(runsService.create).toHaveBeenCalledWith(
        expect.objectContaining({ type: RunType.CHAT, repoId: 'repo-1' }),
      );
      expect(runsService.markRunning).toHaveBeenCalledWith('run-chat-1');
      expect(runsService.complete).toHaveBeenCalledWith(
        'run-chat-1',
        expect.objectContaining({ sessionId: 'sess-abc' }),
        expect.any(Number),
      );

      // Memory: user message stored before LLM call, assistant reply stored after
      expect(memory.addMessage).toHaveBeenCalledWith('sess-abc', 'user', VALID_DTO.message);
      expect(memory.addMessage).toHaveBeenCalledWith('sess-abc', 'assistant', ORCHESTRATOR_RESULT.reply);

      // Orchestrator called with correct repo name
      expect(orchestrator.chat).toHaveBeenCalledWith(
        'sess-abc',
        'repo-1',
        VALID_DTO.message,
        'buntu/copilot',
      );

      // Response shape
      expect(result.reply).toBe(ORCHESTRATOR_RESULT.reply);
      expect(result.relevantFiles).toEqual(['src/auth/auth.service.ts']);
      expect(result.sources).toEqual(['Architecture Decision Records']);
      expect(result.runId).toBe('run-chat-1');
      expect(result.sessionId).toBe('sess-abc');
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('calls repoService.findOne to resolve the repo full name', async () => {
      orchestrator.chat.mockResolvedValue(ORCHESTRATOR_RESULT);

      await service.chat(VALID_DTO);

      expect(repoService.findOne).toHaveBeenCalledWith('repo-1');
    });
  });

  // ─── Empty context results ────────────────────────────────────────────────

  describe('empty context results', () => {
    it('returns a valid response when LLM produces empty relevantFiles and sources', async () => {
      orchestrator.chat.mockResolvedValue({
        reply: 'I could not find any directly relevant files for that query.',
        relevantFiles: [],
        sources: [],
      });

      const result = await service.chat(VALID_DTO);

      expect(result.reply).toBeTruthy();
      expect(result.relevantFiles).toEqual([]);
      expect(result.sources).toEqual([]);
      expect(runsService.complete).toHaveBeenCalled();
      expect(runsService.fail).not.toHaveBeenCalled();
    });

    it('still saves user and assistant messages to memory even with empty context', async () => {
      orchestrator.chat.mockResolvedValue({
        reply: 'No results found.',
        relevantFiles: [],
        sources: [],
      });

      await service.chat(VALID_DTO);

      expect(memory.addMessage).toHaveBeenCalledTimes(2);
      expect(memory.addMessage).toHaveBeenNthCalledWith(1, 'sess-abc', 'user', VALID_DTO.message);
      expect(memory.addMessage).toHaveBeenNthCalledWith(2, 'sess-abc', 'assistant', 'No results found.');
    });
  });

  // ─── Error handling ───────────────────────────────────────────────────────

  describe('error handling', () => {
    it('marks the run as failed and rethrows when the orchestrator throws', async () => {
      const error = new Error('LLM context window exceeded');
      orchestrator.chat.mockRejectedValue(error);

      await expect(service.chat(VALID_DTO)).rejects.toThrow('LLM context window exceeded');

      expect(runsService.fail).toHaveBeenCalledWith(
        'run-chat-1',
        'LLM context window exceeded',
        expect.any(Number),
      );
      expect(runsService.complete).not.toHaveBeenCalled();
    });

    it('marks the run as failed and rethrows when repoService.findOne throws', async () => {
      repoService.findOne.mockRejectedValue(
        new ResourceNotFoundException('Repo', 'repo-1'),
      );

      await expect(service.chat(VALID_DTO)).rejects.toThrow(ResourceNotFoundException);

      expect(runsService.fail).toHaveBeenCalled();
      expect(orchestrator.chat).not.toHaveBeenCalled();
    });

    it('does not add the assistant reply to memory when the orchestrator fails', async () => {
      orchestrator.chat.mockRejectedValue(new Error('provider error'));

      await expect(service.chat(VALID_DTO)).rejects.toThrow();

      // User message was stored, but the assistant reply must NOT be stored
      // since there was no reply.
      const addCalls = memory.addMessage.mock.calls;
      const assistantCalls = addCalls.filter(([, role]) => role === 'assistant');
      expect(assistantCalls).toHaveLength(0);
    });
  });
});
