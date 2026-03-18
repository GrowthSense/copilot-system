import { IsString, IsOptional, IsNumber } from 'class-validator';

export class RunTestsAgentDto {
  @IsString()
  repoId: string;

  @IsString()
  testgenId: string;

  @IsString()
  approvalId: string;

  @IsOptional()
  @IsString()
  script?: 'test' | 'test:cov' | 'test:e2e';

  @IsOptional()
  @IsNumber()
  timeoutMs?: number;
}
