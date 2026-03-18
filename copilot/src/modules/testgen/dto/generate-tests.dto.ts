import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class GenerateTestsDto {
  @IsString()
  @IsNotEmpty()
  targetFile: string;

  @IsString()
  @IsNotEmpty()
  sourceContent: string;

  @IsOptional()
  @IsString()
  repoId?: string;

  @IsOptional()
  @IsString()
  runId?: string;

  @IsOptional()
  @IsString()
  framework?: string;
}
