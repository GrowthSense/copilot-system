import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateAgentTaskDto {
  @IsOptional()
  @IsString()
  repoId?: string;

  @IsString()
  @MaxLength(2000)
  goal: string;           // what the user wants done (used as both title & userPrompt)

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  context?: string;       // optional extra context

  @IsOptional()
  @IsString()
  pathPrefix?: string;
}
