import { Test, TestingModule } from '@nestjs/testing';
import { AgentController } from './agent.controller';
import { AgentService } from './agent.service';
import { RunType } from '../../common/enums/run-type.enum';
import { RunStatus } from '../../common/enums/run-status.enum';

const mockAgentService = {
  createRun: jest.fn(),
  getRun: jest.fn(),
  listRuns: jest.fn(),
};

describe('AgentController', () => {
  let controller: AgentController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AgentController],
      providers: [{ provide: AgentService, useValue: mockAgentService }],
    }).compile();

    controller = module.get<AgentController>(AgentController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createRun', () => {
    it('should create an agent run and return created response', async () => {
      const dto = { type: RunType.ANSWER_QUESTION, prompt: 'What does this file do?' };
      const mockRun = {
        id: 'run-1',
        type: RunType.ANSWER_QUESTION,
        status: RunStatus.PENDING,
      };
      mockAgentService.createRun.mockResolvedValue(mockRun);

      const result = await controller.createRun(dto);

      expect(result.success).toBe(true);
      expect(result.statusCode).toBe(201);
      expect(result.data).toEqual(mockRun);
      expect(mockAgentService.createRun).toHaveBeenCalledWith(dto);
    });
  });

  describe('listRuns', () => {
    it('should return list of agent runs', async () => {
      const mockRuns = [{ id: 'run-1' }, { id: 'run-2' }];
      mockAgentService.listRuns.mockResolvedValue(mockRuns);

      const result = await controller.listRuns();

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockRuns);
    });
  });

  describe('getRun', () => {
    it('should return a single run by id', async () => {
      const mockRun = {
        id: 'run-1',
        type: RunType.EXPLAIN_CODE,
        status: RunStatus.COMPLETED,
      };
      mockAgentService.getRun.mockResolvedValue(mockRun);

      const result = await controller.getRun('run-1');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockRun);
      expect(mockAgentService.getRun).toHaveBeenCalledWith('run-1');
    });
  });
});
