import { IsArray, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { RiskLevel } from '../../../common/enums/risk-level.enum';

export class CreatePatchDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  @IsNotEmpty()
  diff: string;

  @IsArray()
  @IsString({ each: true })
  filePaths: string[];

  @IsOptional()
  @IsEnum(RiskLevel)
  riskLevel?: RiskLevel;

  @IsOptional()
  @IsString()
  runId?: string;

  @IsOptional()
  @IsString()
  repoId?: string;
}
