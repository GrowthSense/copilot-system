import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateRepoDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  cloneUrl?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  defaultBranch?: string;
}
