import { Exclude, Expose, Type } from 'class-transformer';
import { RiskLevel } from '../../../common/enums/risk-level.enum';

@Exclude()
export class PatchResponseDto {
  @Expose() id: string;
  @Expose() title: string;
  @Expose() description: string | null;
  @Expose() diff: string;
  @Expose() filePaths: string[];
  @Expose() riskLevel: RiskLevel;
  @Expose() isApplied: boolean;
  @Expose() prUrl: string | null;
  @Expose() runId: string | null;
  @Expose() repoId: string | null;
  @Expose() @Type(() => Date) createdAt: Date;
  @Expose() @Type(() => Date) updatedAt: Date;
  @Expose() @Type(() => Date) appliedAt: Date | null;
}
