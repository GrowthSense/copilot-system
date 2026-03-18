import { Test, TestingModule } from '@nestjs/testing';
import { AgentService } from './agent.service';
import { DatabaseService } from '../database/database.service';
import { RunsService } from '../runs/runs.service';
import { RunType } from '../../common/enums/run-type.enum';
import { RunStatus } from '../../common/enums/run-status.enum';
import { ResourceNotFoundException } from '../../common/exceptions/app.exception';

const mockDb = {
  agentRun: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
};

const mockRunsService = {};

describe('AgentService', () => {
  let service: AgentService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgentService,
        { provide: DatabaseService, useValue: mockDb },
        { provide: RunsService, useValue: mockRunsService },
      ],
    }).compile();

    service = module.get<AgentService>(AgentService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createRun', () => {
    it('should create and return a new agent run', async () => {
      const dto = {
        type: RunType.ANSWER_QUESTION,
        prompt: 'What does auth.service.ts do?',
      };
      const mockCreated = {
        id: 'run-1',
        type: RunType.ANSWER_QUESTION,
        status: RunStatus.PENDING,
        repoId: null,
        input: { prompt: dto.prompt, context: {} },
        output: null,
        error: null,
        durationMs: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        completedAt: null,
      };
      mockDb.agentRun.create.mockResolvedValue(mockCreated);

      const result = await service.createRun(dto);

      expect(mockDb.agentRun.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: RunType.ANSWER_QUESTION,
            status: RunStatus.PENDING,
          }),
        }),
      );
      expect(result.id).toBe('run-1');
    });
  });

  describe('getRun', () => {
    it('should return run when found', async () => {
      const mockRun = {
        id: 'run-1',
        type: RunType.EXPLAIN_CODE,
        status: RunStatus.COMPLETED,
        repoId: null,
        input: {},
        output: null,
        error: null,
        durationMs: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        completedAt: null,
      };
      mockDb.agentRun.findUnique.mockResolvedValue(mockRun);

      const result = await service.getRun('run-1');
      expect(result.id).toBe('run-1');
    });

    it('should throw ResourceNotFoundException when not found', async () => {
      mockDb.agentRun.findUnique.mockResolvedValue(null);
      await expect(service.getRun('nonexistent')).rejects.toThrow(ResourceNotFoundException);
    });
  });

  describe('listRuns', () => {
    it('should return a list of agent runs', async () => {
      const mockRuns = [
        {
          id: 'run-1',
          type: RunType.FIND_FILES,
          status: RunStatus.COMPLETED,
          repoId: null,
          input: {},
          output: null,
          error: null,
          durationMs: 200,
          createdAt: new Date(),
          updatedAt: new Date(),
          completedAt: new Date(),
        },
      ];
      mockDb.agentRun.findMany.mockResolvedValue(mockRuns);

      const result = await service.listRuns();
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('run-1');
    });
  });
});
