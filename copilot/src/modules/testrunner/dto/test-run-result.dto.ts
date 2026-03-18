import { Exclude, Expose, Type } from 'class-transformer';

@Exclude()
export class TestRunResultDto {
  @Expose() id: string;
  @Expose() runId: string | null;
  @Expose() testgenId: string | null;
  @Expose() repoId: string | null;
  @Expose() script: string;
  @Expose() exitCode: number;
  @Expose() passed: boolean;
  @Expose() stdout: string;
  @Expose() stderr: string;
  @Expose() durationMs: number;
  @Expose() timedOut: boolean;
  @Expose() command: string;
  @Expose() @Type(() => Date) createdAt: Date;
}
