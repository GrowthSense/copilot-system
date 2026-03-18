import { Test, TestingModule } from '@nestjs/testing';
import { ApprovalService } from './approval.service';
import { DatabaseService } from '../database/database.service';
import { ApprovalStatus } from '../../common/enums/approval-status.enum';
import { RiskLevel } from '../../common/enums/risk-level.enum';
import { ResourceNotFoundException, ValidationException } from '../../common/exceptions/app.exception';

const baseApproval = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 'appr-1',
  runId: 'run-1',
  patchId: null,
  prDraftId: null,
  status: ApprovalStatus.WAITING,
  riskLevel: RiskLevel.HIGH,
  reason: 'Patch modifies auth middleware',
  reviewedBy: null,
  reviewNotes: null,
  expiresAt: null,
  reviewedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const mockDb = {
  approvalRequest: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
};

describe('ApprovalService', () => {
  let service: ApprovalService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApprovalService,
        { provide: DatabaseService, useValue: mockDb },
      ],
    }).compile();

    service = module.get<ApprovalService>(ApprovalService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('creates an approval request with WAITING status', async () => {
      const dto = {
        riskLevel: RiskLevel.HIGH,
        reason: 'Modifies auth middleware',
        runId: 'run-1',
      };
      mockDb.approvalRequest.create.mockResolvedValue(baseApproval());

      const result = await service.create(dto);
      expect(result.id).toBe('appr-1');
      expect(result.status).toBe(ApprovalStatus.WAITING);
      expect(mockDb.approvalRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: ApprovalStatus.WAITING }),
        }),
      );
    });
  });

  describe('approve', () => {
    it('approves a WAITING request', async () => {
      mockDb.approvalRequest.findUnique.mockResolvedValue(baseApproval());
      mockDb.approvalRequest.update.mockResolvedValue(
        baseApproval({
          status: ApprovalStatus.APPROVED,
          reviewedBy: 'jane@buntu.finance',
          reviewedAt: new Date(),
        }),
      );

      const result = await service.approve('appr-1', { reviewedBy: 'jane@buntu.finance' });
      expect(result.status).toBe(ApprovalStatus.APPROVED);
      expect(result.reviewedBy).toBe('jane@buntu.finance');
    });

    it('rejects approving an already-approved request', async () => {
      mockDb.approvalRequest.findUnique.mockResolvedValue(
        baseApproval({ status: ApprovalStatus.APPROVED }),
      );
      await expect(
        service.approve('appr-1', { reviewedBy: 'x' }),
      ).rejects.toThrow(ValidationException);
    });

    it('throws ResourceNotFoundException when request not found', async () => {
      mockDb.approvalRequest.findUnique.mockResolvedValue(null);
      await expect(
        service.approve('bad', { reviewedBy: 'x' }),
      ).rejects.toThrow(ResourceNotFoundException);
    });
  });

  describe('reject', () => {
    it('rejects a WAITING request', async () => {
      mockDb.approvalRequest.findUnique.mockResolvedValue(baseApproval());
      mockDb.approvalRequest.update.mockResolvedValue(
        baseApproval({
          status: ApprovalStatus.REJECTED,
          reviewedBy: 'john@buntu.finance',
          reviewNotes: 'Too risky',
          reviewedAt: new Date(),
        }),
      );

      const result = await service.reject('appr-1', {
        reviewedBy: 'john@buntu.finance',
        reviewNotes: 'Too risky',
      });
      expect(result.status).toBe(ApprovalStatus.REJECTED);
      expect(result.reviewNotes).toBe('Too risky');
    });

    it('rejects rejecting an already-rejected request', async () => {
      mockDb.approvalRequest.findUnique.mockResolvedValue(
        baseApproval({ status: ApprovalStatus.REJECTED }),
      );
      await expect(
        service.reject('appr-1', { reviewedBy: 'x' }),
      ).rejects.toThrow(ValidationException);
    });
  });

  describe('findPending', () => {
    it('queries by WAITING status ordered by risk level desc', async () => {
      mockDb.approvalRequest.findMany.mockResolvedValue([baseApproval()]);
      const result = await service.findPending();
      expect(result).toHaveLength(1);
      expect(mockDb.approvalRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: ApprovalStatus.WAITING },
        }),
      );
    });
  });
});
