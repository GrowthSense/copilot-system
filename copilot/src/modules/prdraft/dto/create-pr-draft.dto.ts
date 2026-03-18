import { IsArray, IsEnum, IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';
import { PrDraftStatus } from '../../../common/enums/pr-draft-status.enum';

export class CreatePrDraftDto {
  @IsString()
  @IsNotEmpty()
  repoFullName: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  body: string;

  @IsString()
  @IsNotEmpty()
  headBranch: string;

  @IsOptional()
  @IsString()
  baseBranch?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  labels?: string[];

  @IsOptional()
  @IsString()
  runId?: string;

  @IsOptional()
  @IsString()
  repoId?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
