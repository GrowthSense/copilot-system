import { Exclude, Expose, Type } from 'class-transformer';

@Exclude()
export class ToolExecutionResponseDto {
  @Expose() id: string;
  @Expose() runId: string;
  @Expose() stepId: string | null;
  @Expose() toolName: string;
  @Expose() parameters: Record<string, unknown>;
  @Expose() result: Record<string, unknown> | null;
  @Expose() error: string | null;
  @Expose() isSuccess: boolean;
  @Expose() durationMs: number | null;
  @Expose() @Type(() => Date) createdAt: Date;
  @Expose() @Type(() => Date) completedAt: Date | null;
}
