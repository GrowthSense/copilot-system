import { IsArray, IsNotEmpty, IsOptional, IsString } from 'class-validator';

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
}
