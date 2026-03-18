import { Test, TestingModule } from '@nestjs/testing';
import { ToolsExecutor } from '../tools.executor';
import { ToolsRegistry } from '../tools.registry';
import { RunsService } from '../../runs/runs.service';
import { IAgentTool, ToolExecutionContext } from '../interfaces/agent-tool.interface';

describe('ToolsExecutor', () => {
  let executor: ToolsExecutor;
  let registry: jest.Mocked<Pick<ToolsRegistry, 'get' | 'getAll'>>;
  let runsService: jest.Mocked<Pick<RunsService, 'recordToolExecution'>>;

  const mockTool: IAgentTool = {
    name: 'mock_tool',
    description: 'A mock tool',
    requiresApproval: false,
    getDefinition: jest.fn(),
    execute: jest.fn(),
  };

  beforeEach(async () => {
    registry = {
      get: jest.fn(),
      getAll: jest.fn().mockReturnValue([]),
    };

    runsService = {
      recordToolExecution: jest.fn().mockResolvedValue({}),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ToolsExecutor,
        { provide: ToolsRegistry, useValue: registry },
        { provide: RunsService, useValue: runsService },
      ],
    }).compile();

    executor = module.get(ToolsExecutor);
  });

  afterEach(() => jest.clearAllMocks());

  describe('successful execution', () => {
    it('returns success=true and the tool output', async () => {
      const output = { matches: [], totalMatches: 0 };
      (mockTool.execute as jest.Mock).mockResolvedValue(output);
      registry.get.mockReturnValue(mockTool);

      const context: ToolExecutionContext = {};
      const result = await executor.execute('mock_tool', { repoId: 'r1', pattern: 'foo' }, context);

      expect(result.success).toBe(true);
      expect(result.output).toEqual(output);
      expect(result.error).toBeUndefined();
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
      expect(result.requiresApproval).toBe(false);
    });

    it('persists a ToolExecution record when runId is present', async () => {
      (mockTool.execute as jest.Mock).mockResolvedValue({ ok: true });
      registry.get.mockReturnValue(mockTool);

      const context: ToolExecutionContext = { runId: 'run-1', stepId: 'step-1' };
      await executor.execute('mock_tool', {}, context);

      expect(runsService.recordToolExecution).toHaveBeenCalledWith('run-1', expect.objectContaining({
        toolName: 'mock_tool',
        isSuccess: true,
        stepId: 'step-1',
      }));
    });

    it('does NOT persist when runId is absent', async () => {
      (mockTool.execute as jest.Mock).mockResolvedValue({});
      registry.get.mockReturnValue(mockTool);

      await executor.execute('mock_tool', {}, {});

      expect(runsService.recordToolExecution).not.toHaveBeenCalled();
    });
  });

  describe('failed execution', () => {
    it('returns success=false with error message when tool throws', async () => {
      (mockTool.execute as jest.Mock).mockRejectedValue(new Error('grep timed out'));
      registry.get.mockReturnValue(mockTool);

      const result = await executor.execute('mock_tool', {}, {});

      expect(result.success).toBe(false);
      expect(result.output).toBeNull();
      expect(result.error).toBe('grep timed out');
    });

    it('persists failure record when runId is present', async () => {
      (mockTool.execute as jest.Mock).mockRejectedValue(new Error('oops'));
      registry.get.mockReturnValue(mockTool);

      await executor.execute('mock_tool', {}, { runId: 'run-2' });

      expect(runsService.recordToolExecution).toHaveBeenCalledWith('run-2', expect.objectContaining({
        isSuccess: false,
        error: 'oops',
      }));
    });
  });

  describe('unknown tool', () => {
    it('returns success=false with descriptive error', async () => {
      registry.get.mockReturnValue(undefined);
      registry.getAll.mockReturnValue([mockTool]);

      const result = await executor.execute('no_such_tool', {}, {});

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown tool');
      expect(result.error).toContain('no_such_tool');
    });
  });

  describe('persistence failure', () => {
    it('does not propagate a DB persistence error to the caller', async () => {
      (mockTool.execute as jest.Mock).mockResolvedValue({});
      registry.get.mockReturnValue(mockTool);
      runsService.recordToolExecution.mockRejectedValue(new Error('DB down'));

      const result = await executor.execute('mock_tool', {}, { runId: 'run-3' });

      // The tool result should still be success — the DB error is swallowed.
      expect(result.success).toBe(true);
    });
  });
});
