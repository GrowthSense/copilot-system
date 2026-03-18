import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreatePrDraftDto } from './dto/create-pr-draft.dto';
import { UpdatePrDraftDto } from './dto/update-pr-draft.dto';
import { PrDraftResponseDto } from './dto/pr-draft-response.dto';
import { PrDraftStatus } from '../../common/enums/pr-draft-status.enum';
import {
  ResourceNotFoundException,
  ValidationException,
} from '../../common/exceptions/app.exception';
import { Prisma } from '@prisma/client';
import { plainToInstance } from 'class-transformer';

const TERMINAL_PR_STATUSES: ReadonlySet<PrDraftStatus> = new Set([
  PrDraftStatus.MERGED,
  PrDraftStatus.CLOSED,
  PrDraftStatus.ABANDONED,
]);

@Injectable()
export class PrDraftService {
  private readonly logger = new Logger(PrDraftService.name);

  constructor(private readonly db: DatabaseService) {}

  async create(dto: CreatePrDraftDto): Promise<PrDraftResponseDto> {
    const draft = await this.db.pullRequestDraft.create({
      data: {
        repoFullName: dto.repoFullName,
        title: dto.title,
        body: dto.body,
        headBranch: dto.headBranch,
        baseBranch: dto.baseBranch ?? 'main',
        labels: dto.labels ?? [],
        status: PrDraftStatus.DRAFT,
        runId: dto.runId ?? null,
        repoId: dto.repoId ?? null,
        metadata: (dto.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });
    this.logger.log(`PR draft created: ${draft.id} — "${draft.title}" on ${draft.repoFullName}`);
    return plainToInstance(PrDraftResponseDto, draft, { excludeExtraneousValues: true });
  }

  async findAll(repoFullName?: string): Promise<PrDraftResponseDto[]> {
    const drafts = await this.db.pullRequestDraft.findMany({
      where: repoFullName ? { repoFullName } : undefined,
      orderBy: { createdAt: 'desc' },
    });
    return plainToInstance(PrDraftResponseDto, drafts, { excludeExtraneousValues: true });
  }

  async findOne(id: string): Promise<PrDraftResponseDto> {
    const draft = await this.db.pullRequestDraft.findUnique({ where: { id } });
    if (!draft) throw new ResourceNotFoundException('PullRequestDraft', id);
    return plainToInstance(PrDraftResponseDto, draft, { excludeExtraneousValues: true });
  }

  async update(id: string, dto: UpdatePrDraftDto): Promise<PrDraftResponseDto> {
    const draft = await this.db.pullRequestDraft.findUnique({ where: { id } });
    if (!draft) throw new ResourceNotFoundException('PullRequestDraft', id);

    if (TERMINAL_PR_STATUSES.has(draft.status as PrDraftStatus)) {
      throw new ValidationException(
        `PR draft "${id}" is in terminal status "${draft.status}" and cannot be updated`,
      );
    }

    const isSubmitting =
      dto.status === PrDraftStatus.OPEN && draft.status === PrDraftStatus.DRAFT;

    const updated = await this.db.pullRequestDraft.update({
      where: { id },
      data: {
        status: dto.status ?? undefined,
        prNumber: dto.prNumber ?? undefined,
        prUrl: dto.prUrl ?? undefined,
        submittedAt: isSubmitting ? new Date() : undefined,
      },
    });
    return plainToInstance(PrDraftResponseDto, updated, { excludeExtraneousValues: true });
  }

  async close(id: string): Promise<PrDraftResponseDto> {
    const draft = await this.db.pullRequestDraft.findUnique({ where: { id } });
    if (!draft) throw new ResourceNotFoundException('PullRequestDraft', id);
    if (TERMINAL_PR_STATUSES.has(draft.status as PrDraftStatus)) {
      throw new ValidationException(
        `PR draft "${id}" is already in terminal status "${draft.status}"`,
      );
    }

    const updated = await this.db.pullRequestDraft.update({
      where: { id },
      data: { status: PrDraftStatus.CLOSED },
    });
    return plainToInstance(PrDraftResponseDto, updated, { excludeExtraneousValues: true });
  }
}
