import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class GenerateTestsAgentDto {
  @IsString()
  @IsNotEmpty()
  repoId: string;

  /**
   * Relative path to the source file to generate tests for.
   * E.g. "src/modules/auth/auth.service.ts"
   */
  @IsString()
  @IsNotEmpty()
  filePath: string;

  /**
   * Test framework preference. Default: "jest".
   * If omitted, the orchestrator will infer it from nearby test files.
   */
  @IsOptional()
  @IsString()
  framework?: string;

  /**
   * Optional guidance for the LLM about what to focus on.
   * E.g. "focus on edge cases in the token expiry logic".
   */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  additionalContext?: string;
}
