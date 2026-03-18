import { Exclude, Expose, Type } from 'class-transformer';
import { PrDraftStatus } from '../../../common/enums/pr-draft-status.enum';

@Exclude()
export class PrDraftResponseDto {
  @Expose() id: string;
  @Expose() runId: string | null;
  @Expose() repoId: string | null;
  @Expose() repoFullName: string;
  @Expose() title: string;
  @Expose() body: string;
  @Expose() headBranch: string;
  @Expose() baseBranch: string;
  @Expose() labels: string[];
  @Expose() status: PrDraftStatus;
  @Expose() prNumber: number | null;
  @Expose() prUrl: string | null;
  @Expose() metadata: Record<string, unknown>;
  @Expose() @Type(() => Date) createdAt: Date;
  @Expose() @Type(() => Date) updatedAt: Date;
  @Expose() @Type(() => Date) submittedAt: Date | null;
}
