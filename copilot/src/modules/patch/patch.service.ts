import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreatePatchDto } from './dto/create-patch.dto';
import { PatchResponseDto } from './dto/patch-response.dto';
import { RiskLevel } from '../../common/enums/risk-level.enum';
import { ResourceNotFoundException } from '../../common/exceptions/app.exception';
import { plainToInstance } from 'class-transformer';

@Injectable()
export class PatchService {
  private readonly logger = new Logger(PatchService.name);

  constructor(private readonly db: DatabaseService) {}

  async create(dto: CreatePatchDto): Promise<PatchResponseDto> {
    const patch = await this.db.patchProposal.create({
      data: {
        title: dto.title,
        description: dto.description ?? null,
        diff: dto.diff,
        filePaths: dto.filePaths,
        riskLevel: dto.riskLevel ?? RiskLevel.LOW,
        runId: dto.runId ?? null,
        repoId: dto.repoId ?? null,
      },
    });
    this.logger.log(`Created patch proposal: ${patch.id} — "${patch.title}" [${patch.riskLevel}]`);
    return plainToInstance(PatchResponseDto, patch, { excludeExtraneousValues: true });
  }

  async findAll(repoId?: string): Promise<PatchResponseDto[]> {
    const patches = await this.db.patchProposal.findMany({
      where: repoId ? { repoId } : undefined,
      orderBy: { createdAt: 'desc' },
    });
    return plainToInstance(PatchResponseDto, patches, { excludeExtraneousValues: true });
  }

  async findOne(id: string): Promise<PatchResponseDto> {
    const patch = await this.db.patchProposal.findUnique({ where: { id } });
    if (!patch) throw new ResourceNotFoundException('PatchProposal', id);
    return plainToInstance(PatchResponseDto, patch, { excludeExtraneousValues: true });
  }

  async markApplied(id: string, prUrl?: string): Promise<PatchResponseDto> {
    const patch = await this.db.patchProposal.findUnique({ where: { id } });
    if (!patch) throw new ResourceNotFoundException('PatchProposal', id);

    const updated = await this.db.patchProposal.update({
      where: { id },
      data: {
        isApplied: true,
        appliedAt: new Date(),
        prUrl: prUrl ?? null,
      },
    });
    this.logger.log(`Patch proposal ${id} marked as applied`);
    return plainToInstance(PatchResponseDto, updated, { excludeExtraneousValues: true });
  }
}
