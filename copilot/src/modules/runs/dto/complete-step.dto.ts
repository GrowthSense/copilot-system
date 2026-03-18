import { IsInt, IsNotEmpty, IsObject, IsOptional, IsString, Min } from 'class-validator';

export class CompleteStepDto {
  @IsOptional()
  @IsObject()
  output?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  resultSummary?: string;

  @IsInt()
  @Min(0)
  durationMs: number;
}
