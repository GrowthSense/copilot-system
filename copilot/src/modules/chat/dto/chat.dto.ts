import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';

export class ChatRequestDto {
  @IsString()
  @IsNotEmpty()
  sessionId: string;

  @IsOptional()
  @IsString()
  repoId?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  message: string;

  /** Optional subfolder to restrict file search to (e.g. "backend/" or "src/api/"). */
  @IsOptional()
  @IsString()
  pathPrefix?: string;
}

export class ChatResponseDto {
  reply: string;
  relevantFiles: string[];
  sources: string[];
  runId: string;
  sessionId: string;
  durationMs: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  agentAction?: Record<string, any>;
  /** Tool calls made by the agent this turn. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  toolSteps?: any[];
}

export class ChatErrorResponseDto {
  error: true;
  message: string;
}
