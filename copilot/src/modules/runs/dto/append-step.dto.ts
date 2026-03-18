import { IsEnum, IsInt, IsNotEmpty, IsObject, IsOptional, IsString, Min } from 'class-validator';
import { StepType } from '../../../common/enums/step-type.enum';

export class AppendStepDto {
  @IsInt()
  @Min(0)
  stepIndex: number;

  @IsEnum(StepType)
  type: StepType;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  stageName?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  toolName?: string;

  @IsOptional()
  @IsObject()
  input?: Record<string, unknown>;
}
