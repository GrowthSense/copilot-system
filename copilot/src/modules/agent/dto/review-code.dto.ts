import { IsString, IsOptional, IsArray } from 'class-validator';

export class ReviewCodeDto {
  @IsString()
  repoId: string;

  @IsString()
  filePath: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  focusAreas?: string[];

  @IsOptional()
  @IsString()
  additionalContext?: string;
}
