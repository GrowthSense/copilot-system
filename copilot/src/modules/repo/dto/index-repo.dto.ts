import { IsArray, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class IndexRepoDto {
  /** Absolute path to the repository root on the local filesystem. */
  @IsString()
  @IsNotEmpty()
  localPath: string;

  @IsOptional()
  @IsString()
  branch?: string;

  /** Patterns appended to the built-in defaults (node_modules, .git, dist, …). */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  additionalIgnorePatterns?: string[];

  /** Override the default 512 KB per-file limit. Minimum: 1 KB. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1024)
  maxFileSizeBytes?: number;
}
