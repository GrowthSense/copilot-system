import { IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class ExecuteToolDto {
  @IsString()
  @IsNotEmpty()
  toolName: string;

  @IsObject()
  input: Record<string, unknown>;

  /** Link execution to an existing run for audit logging. */
  @IsOptional()
  @IsString()
  runId?: string;

  /** Link execution to a specific step within the run. */
  @IsOptional()
  @IsString()
  stepId?: string;
}
