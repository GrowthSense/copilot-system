import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class ChatRequestDto {
  @IsString()
  @IsNotEmpty()
  sessionId: string;

  @IsString()
  @IsNotEmpty()
  repoId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  message: string;
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
}

export class ChatErrorResponseDto {
  error: true;
  message: string;
}
