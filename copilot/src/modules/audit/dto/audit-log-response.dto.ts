import { Exclude, Expose, Type } from 'class-transformer';
import { AuditAction } from '../../../common/enums/audit-action.enum';

@Exclude()
export class AuditLogResponseDto {
  @Expose() id: string;
  @Expose() runId: string | null;
  @Expose() action: AuditAction;
  @Expose() actorType: string;
  @Expose() actorId: string | null;
  @Expose() entityType: string | null;
  @Expose() entityId: string | null;
  @Expose() detail: Record<string, unknown>;
  @Expose() ipAddress: string | null;
  @Expose() @Type(() => Date) createdAt: Date;
}
