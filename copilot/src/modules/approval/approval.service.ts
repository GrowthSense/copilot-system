import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreateApprovalRequestDto } from './dto/create-approval-request.dto';
import { ReviewApprovalDto } from './dto/review-approval.dto';
import { ApprovalResponseDto } from './dto/approval-response.dto';
import { ApprovalStatus } from '../../common/enums/approval-status.enum';
import {
  ResourceNotFoundException,
  ValidationException,
} from '../../common/exceptions/app.exception';
import { plainToInstance } from 'class-transformer';

@Injectable()
export class ApprovalService {
  private readonly logger = new Logger(ApprovalService.name);

  constructor(private readonly db: DatabaseService) {}

  async create(dto: CreateApprovalRequestDto): Promise<ApprovalResponseDto> {
    const request = await this.db.approvalRequest.create({
      data: {
        riskLevel: dto.riskLevel,
        reason: dto.reason,
        status: ApprovalStatus.WAITING,
        runId: dto.runId ?? null,
        patchId: dto.patchId ?? null,
        prDraftId: dto.prDraftId ?? null,
        testgenId: dto.testgenId ?? null,
        expiresAt: dto.expiresAt ?? null,
      },
    });
    this.logger.log(
      `Approval request created: ${request.id} [${request.riskLevel}] for run=${request.runId ?? 'none'}`,
    );
    return plainToInstance(ApprovalResponseDto, request, { excludeExtraneousValues: true });
  }

  async findPending(): Promise<ApprovalResponseDto[]> {
    const requests = await this.db.approvalRequest.findMany({
      where: { status: ApprovalStatus.WAITING },
      orderBy: [{ riskLevel: 'desc' }, { createdAt: 'asc' }],
    });
    return plainToInstance(ApprovalResponseDto, requests, { excludeExtraneousValues: true });
  }

  async findByRun(runId: string): Promise<ApprovalResponseDto[]> {
    const requests = await this.db.approvalRequest.findMany({
      where: { runId },
      orderBy: { createdAt: 'desc' },
    });
    return plainToInstance(ApprovalResponseDto, requests, { excludeExtraneousValues: true });
  }

  async findOne(id: string): Promise<ApprovalResponseDto> {
    const request = await this.db.approvalRequest.findUnique({ where: { id } });
    if (!request) throw new ResourceNotFoundException('ApprovalRequest', id);
    return plainToInstance(ApprovalResponseDto, request, { excludeExtraneousValues: true });
  }

  async approve(id: string, dto: ReviewApprovalDto): Promise<ApprovalResponseDto> {
    const request = await this.db.approvalRequest.findUnique({ where: { id } });
    if (!request) throw new ResourceNotFoundException('ApprovalRequest', id);
    this.assertWaiting(request.status, id);

    const updated = await this.db.approvalRequest.update({
      where: { id },
      data: {
        status: ApprovalStatus.APPROVED,
        reviewedBy: dto.reviewedBy,
        reviewNotes: dto.reviewNotes ?? null,
        reviewedAt: new Date(),
      },
    });
    this.logger.log(`Approval ${id} approved by ${dto.reviewedBy}`);
    return plainToInstance(ApprovalResponseDto, updated, { excludeExtraneousValues: true });
  }

  async reject(id: string, dto: ReviewApprovalDto): Promise<ApprovalResponseDto> {
    const request = await this.db.approvalRequest.findUnique({ where: { id } });
    if (!request) throw new ResourceNotFoundException('ApprovalRequest', id);
    this.assertWaiting(request.status, id);

    const updated = await this.db.approvalRequest.update({
      where: { id },
      data: {
        status: ApprovalStatus.REJECTED,
        reviewedBy: dto.reviewedBy,
        reviewNotes: dto.reviewNotes ?? null,
        reviewedAt: new Date(),
      },
    });
    this.logger.log(`Approval ${id} rejected by ${dto.reviewedBy}`);
    return plainToInstance(ApprovalResponseDto, updated, { excludeExtraneousValues: true });
  }

  private assertWaiting(status: string, id: string): void {
    if (status !== ApprovalStatus.WAITING) {
      throw new ValidationException(
        `Approval request "${id}" is already in terminal status "${status}" and cannot be reviewed`,
      );
    }
  }
}
