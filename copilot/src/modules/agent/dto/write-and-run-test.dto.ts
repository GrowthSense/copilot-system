import { IsOptional, IsString, IsNumber } from 'class-validator';

export class WriteAndRunTestDto {
  @IsString()
  repoId: string;

  @IsString()
  testgenId: string;

  @IsOptional()
  @IsString()
  script?: 'test' | 'test:cov';

  @IsOptional()
  @IsNumber()
  timeoutMs?: number;
}
