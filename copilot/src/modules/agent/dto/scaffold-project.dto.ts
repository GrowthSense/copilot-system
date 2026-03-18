import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class ScaffoldProjectDto {
  /** Natural language description of the project to build. */
  @IsString()
  @IsNotEmpty()
  description: string;

  /** Directory name for the new project (e.g. "user-api"). */
  @IsString()
  @IsNotEmpty()
  projectName: string;

  /** Absolute path to the directory where the project will be created. */
  @IsString()
  @IsNotEmpty()
  outputDir: string;

  /** Optional framework hint (e.g. "nestjs", "nextjs", "react"). */
  @IsOptional()
  @IsString()
  frameworkHint?: string;

  /**
   * ID of an APPROVED ApprovalRequest.
   * Obtain one via POST /api/v1/approvals then PATCH /api/v1/approvals/:id/approve.
   */
  @IsString()
  @IsNotEmpty()
  approvalId: string;
}
