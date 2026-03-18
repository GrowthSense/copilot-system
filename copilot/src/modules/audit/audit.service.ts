import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreateAuditLogDto } from './dto/create-audit-log.dto';
import { AuditLogResponseDto } from './dto/audit-log-response.dto';
import { ResourceNotFoundException } from '../../common/exceptions/app.exception';
import { Prisma } from '@prisma/client';
import { plainToInstance } from 'class-transformer';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly db: DatabaseService) {}

  async log(dto: CreateAuditLogDto): Promise<AuditLogResponseDto> {
    const entry = await this.db.auditLog.create({
      data: {
        action: dto.action,
        runId: dto.runId ?? null,
        actorType: dto.actorType ?? 'system',
        actorId: dto.actorId ?? null,
        entityType: dto.entityType ?? null,
        entityId: dto.entityId ?? null,
        detail: (dto.detail ?? {}) as Prisma.InputJsonValue,
        ipAddress: dto.ipAddress ?? null,
      },
    });
    this.logger.debug(`Audit: ${entry.action} [${entry.actorType}] entity=${entry.entityType}:${entry.entityId}`);
    return plainToInstance(AuditLogResponseDto, entry, { excludeExtraneousValues: true });
  }

  async findByRun(runId: string): Promise<AuditLogResponseDto[]> {
    const entries = await this.db.auditLog.findMany({
      where: { runId },
      orderBy: { createdAt: 'asc' },
    });
    return plainToInstance(AuditLogResponseDto, entries, { excludeExtraneousValues: true });
  }

  async findByEntity(entityType: string, entityId: string): Promise<AuditLogResponseDto[]> {
    const entries = await this.db.auditLog.findMany({
      where: { entityType, entityId },
      orderBy: { createdAt: 'asc' },
    });
    return plainToInstance(AuditLogResponseDto, entries, { excludeExtraneousValues: true });
  }

  async findRecent(limit = 100): Promise<AuditLogResponseDto[]> {
    const entries = await this.db.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return plainToInstance(AuditLogResponseDto, entries, { excludeExtraneousValues: true });
  }
}
