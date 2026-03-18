import { IndexStatus } from '../../../common/enums/index-status.enum';

export class RepoIndexResponseDto {
  id: string;
  repoId: string;
  status: IndexStatus;
  localPath: string;
  branch: string;
  ignorePatterns: string[];
  totalFiles: number;
  indexedFiles: number;
  skippedFiles: number;
  errorFiles: number;
  errorLog: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
