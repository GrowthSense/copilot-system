import { IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class FindCandidatesDto {
  /** Natural language query — e.g. "where is JWT token validation?". */
  @IsString()
  @IsNotEmpty()
  query: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  topK?: number = 10;

  /**
   * Optional path prefix filter (e.g. "backend/" or "src/").
   * When set, only files whose filePath starts with this prefix are searched.
   */
  @IsOptional()
  @IsString()
  pathPrefix?: string;
}
