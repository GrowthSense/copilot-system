import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class FindRelevantFilesDto {
  @IsString()
  @IsNotEmpty()
  repoId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  query: string;

  /** Maximum files to return. Default: 10, max: 30. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(30)
  topK?: number;

  /**
   * When true, include a short snippet of matching content for each file.
   * Increases response size. Default: false.
   */
  @IsOptional()
  @IsBoolean()
  includeSnippet?: boolean;
}
