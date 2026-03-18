import { Exclude, Expose, Type } from 'class-transformer';
import { ApprovalStatus } from '../../../common/enums/approval-status.enum';
import { RiskLevel } from '../../../common/enums/risk-level.enum';

@Exclude()
export class ApprovalResponseDto {
  @Expose() id: string;
  @Expose() runId: string | null;
  @Expose() patchId: string | null;
  @Expose() prDraftId: string | null;
  @Expose() status: ApprovalStatus;
  @Expose() riskLevel: RiskLevel;
  @Expose() reason: string;
  @Expose() reviewedBy: string | null;
  @Expose() reviewNotes: string | null;
  @Expose() @Type(() => Date) expiresAt: Date | null;
  @Expose() @Type(() => Date) reviewedAt: Date | null;
  @Expose() @Type(() => Date) createdAt: Date;
  @Expose() @Type(() => Date) updatedAt: Date;
}
