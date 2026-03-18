import { RepoFileStatus } from '../../../common/enums/repo-file-status.enum';

export class RepoFileResponseDto {
  id: string;
  repoId: string;
  indexId: string;
  filePath: string;
  fileName: string;
  extension: string | null;
  language: string | null;
  sizeBytes: number;
  lineCount: number;
  contentHash: string;
  status: RepoFileStatus;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}
