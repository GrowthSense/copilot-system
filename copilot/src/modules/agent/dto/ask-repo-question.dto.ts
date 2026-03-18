import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class AskRepoQuestionDto {
  @IsString()
  @IsNotEmpty()
  repoId: string;

  @IsString()
  @MinLength(5, { message: 'Question must be at least 5 characters' })
  @MaxLength(2000, { message: 'Question must not exceed 2000 characters' })
  question: string;

  /** Maximum files to retrieve and pass as context to the LLM. Default: 5, max: 10. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  topKFiles?: number;

  /** Maximum knowledge chunks to retrieve for background context. Default: 8, max: 20. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  topKChunks?: number;
}
