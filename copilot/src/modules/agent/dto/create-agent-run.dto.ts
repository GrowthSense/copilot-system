import {
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';
import { RunType } from '../../../common/enums/run-type.enum';

export class CreateAgentRunDto {
  @IsEnum(RunType)
  type: RunType;

  @IsString()
  @IsNotEmpty()
  prompt: string;

  @IsOptional()
  @IsString()
  repoId?: string;

  @IsOptional()
  @IsObject()
  context?: Record<string, unknown>;
}
