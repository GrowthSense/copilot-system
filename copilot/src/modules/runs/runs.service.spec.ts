import { Test, TestingModule } from '@nestjs/testing';
import { RunsService } from './runs.service';
import { DatabaseService } from '../database/database.service';
import { RunType } from '../../common/enums/run-type.enum';
import { RunStatus } from '../../common/enums/run-status.enum';
import { StepStatus } from '../../common/enums/step-status.enum';
import { StepType } from '../../common/enums/step-type.enum';
import { ResourceNotFoundException, ValidationException } from '../../common/exceptions/app.exception';

const baseRun = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 'run-1',
  type: RunType.ANSWER_QUESTION,
  status: RunStatus.PENDING,
  repoId: null,
  input: { prompt: 'test' },
  output: null,
  error: null,
  durationMs: null,
  promptTokens: null,
  completionTokens: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  startedAt: null,
  completedAt: null,
  ...overrides,
});

const baseStep = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 'step-1',
  runId: 'run-1',
  stepIndex: 0,
  type: StepType.REASONING,
  status: StepStatus.PENDING,
  stageName: 'gather_context',
  toolName: null,
  input: null,
  output: null,
  resultSummary: null,
  error: null,
  durationMs: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  startedAt: null,
  completedAt: null,
  ...overrides,
});

const mockDb = {
  agentRun: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
  agentRunStep: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
  toolExecution: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
};

describe('RunsService', () => {
  let service: RunsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RunsService,
        { provide: DatabaseService, useValue: mockDb },
      ],
    }).compile();

    service = module.get<RunsService>(RunsService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─── Run lifecycle ──────────────────────────────────────────────────────────

  describe('create', () => {
    it('creates a run with PENDING status', async () => {
      const dto = { type: RunType.FIND_FILES, input: { prompt: 'find auth files' } };
      mockDb.agentRun.create.mockResolvedValue(baseRun({ type: RunType.FIND_FILES }));

      const result = await service.create(dto);

      expect(result.id).toBe('run-1');
      expect(mockDb.agentRun.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: RunStatus.PENDING }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('returns a run when found', async () => {
      mockDb.agentRun.findUnique.mockResolvedValue(baseRun());
      const result = await service.findOne('run-1');
      expect(result.id).toBe('run-1');
    });

    it('throws ResourceNotFoundException when not found', async () => {
      mockDb.agentRun.findUnique.mockResolvedValue(null);
      await expect(service.findOne('bad-id')).rejects.toThrow(ResourceNotFoundException);
    });
  });

  describe('findOneWithSteps', () => {
    it('returns run with steps included', async () => {
      const runWithSteps = { ...baseRun(), steps: [baseStep()] };
      mockDb.agentRun.findUnique.mockResolvedValue(runWithSteps);

      const result = await service.findOneWithSteps('run-1');
      expect(result.id).toBe('run-1');
      expect(result.steps).toHaveLength(1);
    });

    it('throws when run not found', async () => {
      mockDb.agentRun.findUnique.mockResolvedValue(null);
      await expect(service.findOneWithSteps('bad')).rejects.toThrow(ResourceNotFoundException);
    });
  });

  describe('markRunning', () => {
    it('transitions PENDING → RUNNING', async () => {
      mockDb.agentRun.findUnique.mockResolvedValue(baseRun({ status: RunStatus.PENDING }));
      mockDb.agentRun.update.mockResolvedValue(baseRun({ status: RunStatus.RUNNING, startedAt: new Date() }));

      const result = await service.markRunning('run-1');
      expect(result.status).toBe(RunStatus.RUNNING);
      expect(mockDb.agentRun.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: RunStatus.RUNNING }) }),
      );
    });

    it('rejects invalid transition COMPLETED → RUNNING', async () => {
      mockDb.agentRun.findUnique.mockResolvedValue(baseRun({ status: RunStatus.COMPLETED }));
      await expect(service.markRunning('run-1')).rejects.toThrow(ValidationException);
    });
  });

  describe('complete', () => {
    it('transitions RUNNING → COMPLETED with output', async () => {
      const output = { answer: '42' };
      mockDb.agentRun.findUnique.mockResolvedValue(baseRun({ status: RunStatus.RUNNING }));
      mockDb.agentRun.update.mockResolvedValue(
        baseRun({ status: RunStatus.COMPLETED, output, durationMs: 1200, completedAt: new Date() }),
      );

      const result = await service.complete('run-1', output, 1200);
      expect(result.status).toBe(RunStatus.COMPLETED);
    });

    it('rejects completing an already-completed run', async () => {
      mockDb.agentRun.findUnique.mockResolvedValue(baseRun({ status: RunStatus.COMPLETED }));
      await expect(service.complete('run-1', {}, 0)).rejects.toThrow(ValidationException);
    });
  });

  describe('fail', () => {
    it('transitions RUNNING → FAILED with error', async () => {
      mockDb.agentRun.findUnique.mockResolvedValue(baseRun({ status: RunStatus.RUNNING }));
      mockDb.agentRun.update.mockResolvedValue(
        baseRun({ status: RunStatus.FAILED, error: 'LLM timeout', durationMs: 5000, completedAt: new Date() }),
      );

      const result = await service.fail('run-1', 'LLM timeout', 5000);
      expect(result.status).toBe(RunStatus.FAILED);
      expect(result.error).toBe('LLM timeout');
    });

    it('rejects failing a CANCELLED run', async () => {
      mockDb.agentRun.findUnique.mockResolvedValue(baseRun({ status: RunStatus.CANCELLED }));
      await expect(service.fail('run-1', 'err')).rejects.toThrow(ValidationException);
    });
  });

  describe('cancel', () => {
    it('transitions PENDING → CANCELLED', async () => {
      mockDb.agentRun.findUnique.mockResolvedValue(baseRun({ status: RunStatus.PENDING }));
      mockDb.agentRun.update.mockResolvedValue(baseRun({ status: RunStatus.CANCELLED, completedAt: new Date() }));

      const result = await service.cancel('run-1');
      expect(result.status).toBe(RunStatus.CANCELLED);
    });

    it('rejects cancelling a FAILED run', async () => {
      mockDb.agentRun.findUnique.mockResolvedValue(baseRun({ status: RunStatus.FAILED }));
      await expect(service.cancel('run-1')).rejects.toThrow(ValidationException);
    });
  });

  // ─── Step management ────────────────────────────────────────────────────────

  describe('appendStep', () => {
    it('creates a new step for an active run', async () => {
      mockDb.agentRun.findUnique.mockResolvedValue(baseRun({ status: RunStatus.RUNNING }));
      mockDb.agentRunStep.create.mockResolvedValue(baseStep());

      const dto = { stepIndex: 0, type: StepType.REASONING, stageName: 'gather_context' };
      const result = await service.appendStep('run-1', dto);

      expect(result.id).toBe('step-1');
      expect(result.status).toBe(StepStatus.PENDING);
    });

    it('rejects appending a step to a completed run', async () => {
      mockDb.agentRun.findUnique.mockResolvedValue(baseRun({ status: RunStatus.COMPLETED }));
      await expect(
        service.appendStep('run-1', { stepIndex: 0, type: StepType.REASONING }),
      ).rejects.toThrow(ValidationException);
    });

    it('throws when run not found', async () => {
      mockDb.agentRun.findUnique.mockResolvedValue(null);
      await expect(
        service.appendStep('bad', { stepIndex: 0, type: StepType.TOOL_CALL }),
      ).rejects.toThrow(ResourceNotFoundException);
    });
  });

  describe('startStep', () => {
    it('transitions step PENDING → RUNNING', async () => {
      mockDb.agentRunStep.findUnique.mockResolvedValue(baseStep({ status: StepStatus.PENDING }));
      mockDb.agentRunStep.update.mockResolvedValue(
        baseStep({ status: StepStatus.RUNNING, startedAt: new Date() }),
      );

      const result = await service.startStep('step-1');
      expect(result.status).toBe(StepStatus.RUNNING);
    });

    it('rejects starting an already-running step', async () => {
      mockDb.agentRunStep.findUnique.mockResolvedValue(baseStep({ status: StepStatus.RUNNING }));
      await expect(service.startStep('step-1')).rejects.toThrow(ValidationException);
    });
  });

  describe('completeStep', () => {
    it('transitions step RUNNING → COMPLETED', async () => {
      mockDb.agentRunStep.findUnique.mockResolvedValue(baseStep({ status: StepStatus.RUNNING }));
      mockDb.agentRunStep.update.mockResolvedValue(
        baseStep({ status: StepStatus.COMPLETED, resultSummary: 'Done', durationMs: 300, completedAt: new Date() }),
      );

      const result = await service.completeStep('step-1', { durationMs: 300, resultSummary: 'Done' });
      expect(result.status).toBe(StepStatus.COMPLETED);
      expect(result.resultSummary).toBe('Done');
    });

    it('rejects completing a PENDING step', async () => {
      mockDb.agentRunStep.findUnique.mockResolvedValue(baseStep({ status: StepStatus.PENDING }));
      await expect(service.completeStep('step-1', { durationMs: 0 })).rejects.toThrow(ValidationException);
    });
  });

  describe('failStep', () => {
    it('transitions step RUNNING → FAILED', async () => {
      mockDb.agentRunStep.findUnique.mockResolvedValue(baseStep({ status: StepStatus.RUNNING }));
      mockDb.agentRunStep.update.mockResolvedValue(
        baseStep({ status: StepStatus.FAILED, error: 'timeout', completedAt: new Date() }),
      );

      const result = await service.failStep('step-1', { error: 'timeout' });
      expect(result.status).toBe(StepStatus.FAILED);
    });

    it('rejects failing an already-completed step', async () => {
      mockDb.agentRunStep.findUnique.mockResolvedValue(baseStep({ status: StepStatus.COMPLETED }));
      await expect(service.failStep('step-1', { error: 'too late' })).rejects.toThrow(ValidationException);
    });
  });

  // ─── Tool executions ────────────────────────────────────────────────────────

  describe('recordToolExecution', () => {
    it('records a successful tool execution', async () => {
      mockDb.agentRun.findUnique.mockResolvedValue(baseRun({ status: RunStatus.RUNNING }));
      const mockExecution = {
        id: 'exec-1',
        runId: 'run-1',
        stepId: null,
        toolName: 'find_files',
        parameters: { query: 'auth' },
        result: { files: ['src/auth.ts'] },
        error: null,
        isSuccess: true,
        durationMs: 120,
        createdAt: new Date(),
        completedAt: new Date(),
      };
      mockDb.toolExecution.create.mockResolvedValue(mockExecution);

      const dto = {
        toolName: 'find_files',
        parameters: { query: 'auth' },
        result: { files: ['src/auth.ts'] },
        isSuccess: true,
        durationMs: 120,
      };
      const result = await service.recordToolExecution('run-1', dto);
      expect(result.id).toBe('exec-1');
      expect(result.isSuccess).toBe(true);
    });

    it('throws when run not found', async () => {
      mockDb.agentRun.findUnique.mockResolvedValue(null);
      await expect(
        service.recordToolExecution('bad', { toolName: 'x', parameters: {}, isSuccess: false }),
      ).rejects.toThrow(ResourceNotFoundException);
    });
  });
});
