import {
  IsArray,
  IsBoolean,
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

export class ProposePatchDto {
  @IsString()
  @IsNotEmpty()
  repoId: string;

  /**
   * Natural language description of the bug to fix or change to make.
   * E.g. "The login endpoint returns 500 when the user email contains uppercase letters."
   */
  @IsString()
  @MinLength(10, { message: 'Request must be at least 10 characters' })
  @MaxLength(3000)
  request: string;

  /**
   * Explicit relative file paths to include as context.
   * When provided, these are read and passed to the LLM in addition to
   * any files discovered via search.
   */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  filePaths?: string[];

  /**
   * Additional constraints forwarded verbatim to the LLM.
   * E.g. ["Do not change the public API", "Keep the existing error handling style"].
   */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  constraints?: string[];

  /**
   * Maximum number of candidate files to discover via search.
   * Default: 5, max: 10.
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  topKFiles?: number;

  /**
   * Whether to gather adjacent test files alongside the target files.
   * Helps the LLM understand the testing style and adjust testingNotes.
   * Default: true.
   */
  @IsOptional()
  @IsBoolean()
  includeTests?: boolean;
}
