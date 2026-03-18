import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * A single file whose full new content will be committed to the branch.
 * Must contain the complete file content — not a diff.
 */
export class ChangedFileDto {
  /**
   * Relative file path within the repository.
   * E.g. "src/auth/auth.service.ts"
   */
  @IsString()
  @IsNotEmpty()
  filePath: string;

  /**
   * Full new UTF-8 content for the file.
   */
  @IsString()
  content: string;
}

export class CreatePrDraftAgentDto {
  /**
   * The registered repository ID.
   * The repo record must have a `fullName` in "owner/repo" format.
   */
  @IsString()
  @IsNotEmpty()
  repoId: string;

  /**
   * ID of the PatchProposal record produced by a prior `propose-patch` run.
   * Used to load the diff, risk level, title, and description for the PR.
   */
  @IsString()
  @IsNotEmpty()
  patchId: string;

  /**
   * ID of the ApprovalRequest that authorises this PR creation.
   * Must have status APPROVED. If the approval does not reference this
   * patch, the request will be rejected with a validation error.
   */
  @IsString()
  @IsNotEmpty()
  approvalId: string;

  /**
   * Files to commit to the branch.
   * Each entry must contain the **full new content** (not a patch) for its path.
   * At least one file is required.
   */
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChangedFileDto)
  changedFiles: ChangedFileDto[];

  /**
   * Optional ID of a GeneratedTest record (from `generate-tests`).
   * When provided, the test file is added to the commit alongside the changed files.
   */
  @IsOptional()
  @IsString()
  testgenId?: string;

  /**
   * Override the base branch for the PR (default: GITHUB_BASE_BRANCH env var, then "main").
   */
  @IsOptional()
  @IsString()
  baseBranch?: string;

  /**
   * GitHub usernames to request a review from.
   * Passed to the LLM as context and submitted via the GitHub API.
   */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  teamReviewers?: string[];

  /**
   * Custom commit message. When omitted, the orchestrator uses the LLM-generated PR title.
   */
  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  commitMessage?: string;
}
