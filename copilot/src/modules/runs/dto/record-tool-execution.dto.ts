import { IsBoolean, IsInt, IsNotEmpty, IsObject, IsOptional, IsString, Min } from 'class-validator';

export class RecordToolExecutionDto {
  @IsString()
  @IsNotEmpty()
  toolName: string;

  @IsObject()
  parameters: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  result?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  error?: string;

  @IsBoolean()
  isSuccess: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  durationMs?: number;

  @IsOptional()
  @IsString()
  stepId?: string;
}
