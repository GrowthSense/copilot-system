import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { RiskLevel } from '../../../common/enums/risk-level.enum';

export class CreateApprovalRequestDto {
  @IsEnum(RiskLevel)
  riskLevel: RiskLevel;

  @IsString()
  @IsNotEmpty()
  reason: string;

  @IsOptional()
  @IsString()
  runId?: string;

  @IsOptional()
  @IsString()
  patchId?: string;

  @IsOptional()
  @IsString()
  prDraftId?: string;

  @IsOptional()
  @IsString()
  testgenId?: string;

  @IsOptional()
  expiresAt?: Date;
}
