import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class ExplainCodeDto {
  @IsString()
  @IsNotEmpty()
  repoId: string;

  /** Relative path to the file within the repository (e.g. "src/modules/auth/auth.service.ts"). */
  @IsString()
  @IsNotEmpty()
  filePath: string;

  /**
   * Optional natural language context to guide the explanation.
   * E.g. "focus on how this interacts with the database".
   */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  additionalContext?: string;
}
