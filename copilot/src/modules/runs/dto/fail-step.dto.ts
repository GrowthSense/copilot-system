import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class FailStepDto {
  @IsString()
  @IsNotEmpty()
  error: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  durationMs?: number;
}
