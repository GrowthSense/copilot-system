import { Exclude, Expose, Type } from 'class-transformer';
import { RunStatus } from '../../../common/enums/run-status.enum';
import { RunType } from '../../../common/enums/run-type.enum';
import { StepResponseDto } from './step-response.dto';

@Exclude()
export class RunDetailResponseDto {
  @Expose() id: string;
  @Expose() type: RunType;
  @Expose() status: RunStatus;
  @Expose() repoId: string | null;
  @Expose() input: Record<string, unknown>;
  @Expose() output: Record<string, unknown> | null;
  @Expose() error: string | null;
  @Expose() durationMs: number | null;
  @Expose() promptTokens: number | null;
  @Expose() completionTokens: number | null;
  @Expose() @Type(() => StepResponseDto) steps: StepResponseDto[];
  @Expose() @Type(() => Date) createdAt: Date;
  @Expose() @Type(() => Date) updatedAt: Date;
  @Expose() @Type(() => Date) startedAt: Date | null;
  @Expose() @Type(() => Date) completedAt: Date | null;
}
