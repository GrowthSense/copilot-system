import { IsEnum, IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';
import { RunType } from '../../../common/enums/run-type.enum';

export class CreateRunDto {
  @IsEnum(RunType)
  type: RunType;

  @IsObject()
  @IsNotEmpty()
  input: Record<string, unknown>;

  @IsOptional()
  @IsString()
  repoId?: string;
}
