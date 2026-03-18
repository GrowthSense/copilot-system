import { Test, TestingModule } from '@nestjs/testing';
import { AuditService } from './audit.service';
import { DatabaseService } from '../database/database.service';
import { AuditAction } from '../../common/enums/audit-action.enum';

const mockDb = {
  auditLog: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
};

describe('AuditService', () => {
  let service: AuditService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        { provide: DatabaseService, useValue: mockDb },
      ],
    }).compile();

    service = module.get<AuditService>(AuditService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('log', () => {
    it('creates an audit log entry', async () => {
      const dto = {
        action: AuditAction.RUN_CREATED,
        runId: 'run-1',
        entityType: 'AgentRun',
        entityId: 'run-1',
        detail: { type: 'ANSWER_QUESTION' },
      };
      const mockEntry = {
        id: 'log-1',
        action: AuditAction.RUN_CREATED,
        runId: 'run-1',
        actorType: 'system',
        actorId: null,
        entityType: 'AgentRun',
        entityId: 'run-1',
        detail: dto.detail,
        ipAddress: null,
        createdAt: new Date(),
      };
      mockDb.auditLog.create.mockResolvedValue(mockEntry);

      const result = await service.log(dto);
      expect(result.id).toBe('log-1');
      expect(result.action).toBe(AuditAction.RUN_CREATED);
    });

    it('defaults actorType to "system" when not provided', async () => {
      const dto = { action: AuditAction.TOOL_EXECUTED };
      mockDb.auditLog.create.mockResolvedValue({
        id: 'log-2',
        action: AuditAction.TOOL_EXECUTED,
        runId: null,
        actorType: 'system',
        actorId: null,
        entityType: null,
        entityId: null,
        detail: {},
        ipAddress: null,
        createdAt: new Date(),
      });

      await service.log(dto);
      expect(mockDb.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ actorType: 'system' }),
        }),
      );
    });
  });

  describe('findByRun', () => {
    it('returns audit logs ordered by createdAt asc', async () => {
      const mockEntries = [
        { id: 'log-1', action: AuditAction.RUN_CREATED, runId: 'run-1', actorType: 'system', actorId: null, entityType: null, entityId: null, detail: {}, ipAddress: null, createdAt: new Date() },
        { id: 'log-2', action: AuditAction.RUN_STARTED, runId: 'run-1', actorType: 'system', actorId: null, entityType: null, entityId: null, detail: {}, ipAddress: null, createdAt: new Date() },
      ];
      mockDb.auditLog.findMany.mockResolvedValue(mockEntries);

      const result = await service.findByRun('run-1');
      expect(result).toHaveLength(2);
      expect(mockDb.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { runId: 'run-1' } }),
      );
    });
  });

  describe('findRecent', () => {
    it('respects limit parameter', async () => {
      mockDb.auditLog.findMany.mockResolvedValue([]);
      await service.findRecent(25);
      expect(mockDb.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 25 }),
      );
    });
  });
});
