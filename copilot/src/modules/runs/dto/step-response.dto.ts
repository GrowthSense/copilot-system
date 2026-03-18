import { Exclude, Expose, Type } from 'class-transformer';
import { StepStatus } from '../../../common/enums/step-status.enum';
import { StepType } from '../../../common/enums/step-type.enum';

@Exclude()
export class StepResponseDto {
  @Expose() id: string;
  @Expose() runId: string;
  @Expose() stepIndex: number;
  @Expose() type: StepType;
  @Expose() status: StepStatus;
  @Expose() stageName: string | null;
  @Expose() toolName: string | null;
  @Expose() input: Record<string, unknown> | null;
  @Expose() output: Record<string, unknown> | null;
  @Expose() resultSummary: string | null;
  @Expose() error: string | null;
  @Expose() durationMs: number | null;
  @Expose() @Type(() => Date) createdAt: Date;
  @Expose() @Type(() => Date) updatedAt: Date;
  @Expose() @Type(() => Date) startedAt: Date | null;
  @Expose() @Type(() => Date) completedAt: Date | null;
}
