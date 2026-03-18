import { MatchReason } from '../interfaces/repo-index.interface';

export class FileMatchResponseDto {
  fileId: string;
  repoId: string;
  filePath: string;
  fileName: string;
  extension: string | null;
  language: string | null;
  sizeBytes: number;
  lineCount: number;
  matchReason: MatchReason;
  matchDetail: string;
  /** Normalised relevance score in [0, 1]. */
  score: number;
}
