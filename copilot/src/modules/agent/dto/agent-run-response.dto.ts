import { Exclude, Expose, Type } from 'class-transformer';
import { RunStatus } from '../../../common/enums/run-status.enum';
import { RunType } from '../../../common/enums/run-type.enum';

@Exclude()
export class AgentRunResponseDto {
  @Expose()
  id: string;

  @Expose()
  type: RunType;

  @Expose()
  status: RunStatus;

  @Expose()
  repoId: string | null;

  @Expose()
  input: Record<string, unknown>;

  @Expose()
  output: Record<string, unknown> | null;

  @Expose()
  error: string | null;

  @Expose()
  durationMs: number | null;

  @Expose()
  @Type(() => Date)
  createdAt: Date;

  @Expose()
  @Type(() => Date)
  completedAt: Date | null;
}
