import { IsEnum, IsObject, IsOptional, IsString } from 'class-validator';
import { AuditAction } from '../../../common/enums/audit-action.enum';

export class CreateAuditLogDto {
  @IsEnum(AuditAction)
  action: AuditAction;

  @IsOptional()
  @IsString()
  runId?: string;

  @IsOptional()
  @IsString()
  actorType?: string;

  @IsOptional()
  @IsString()
  actorId?: string;

  @IsOptional()
  @IsString()
  entityType?: string;

  @IsOptional()
  @IsString()
  entityId?: string;

  @IsOptional()
  @IsObject()
  detail?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  ipAddress?: string;
}
