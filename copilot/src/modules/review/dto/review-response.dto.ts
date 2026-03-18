import { Exclude, Expose, Type } from 'class-transformer';

@Exclude()
export class ReviewResponseDto {
  @Expose() id: string;
  @Expose() runId: string | null;
  @Expose() repoId: string | null;
  @Expose() filePath: string;
  @Expose() summary: string;
  @Expose() overallRisk: string;
  @Expose() findings: unknown[];
  @Expose() positives: string[];
  @Expose() testingRecs: string[];
  @Expose() @Type(() => Date) createdAt: Date;
  @Expose() @Type(() => Date) updatedAt: Date;
}
