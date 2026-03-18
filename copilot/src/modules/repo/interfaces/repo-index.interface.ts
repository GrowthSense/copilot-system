export enum MatchReason {
  FILENAME_EXACT = 'FILENAME_EXACT',
  FILENAME_FUZZY = 'FILENAME_FUZZY',
  PATH_FRAGMENT = 'PATH_FRAGMENT',
  KEYWORD_IN_CONTENT = 'KEYWORD_IN_CONTENT',
  CANDIDATE_SCORED = 'CANDIDATE_SCORED',
}

export enum SearchMode {
  FILENAME = 'filename',
  PATH = 'path',
  KEYWORD = 'keyword',
  ALL = 'all',
}

// ─── File reading ─────────────────────────────────────────────────────────────

export interface ReadFileSuccess {
  isBinary: false;
  content: string;
  lineCount: number;
  sizeBytes: number;
}

export interface ReadFileSkipped {
  isBinary: true;
  reason: 'binary' | 'too_large' | 'unreadable';
  sizeBytes: number;
}

export type FileReadAttempt = ReadFileSuccess | ReadFileSkipped;

// ─── Indexing options ─────────────────────────────────────────────────────────

export interface IndexingOptions {
  localPath: string;
  branch?: string;
  additionalIgnorePatterns?: string[];
  maxFileSizeBytes?: number;
}

// ─── Search / map results ─────────────────────────────────────────────────────

export interface FileMatchResult {
  fileId: string;
  repoId: string;
  filePath: string;
  fileName: string;
  extension?: string;
  language?: string;
  sizeBytes: number;
  lineCount: number;
  /** Primary reason this file was included in results. */
  matchReason: MatchReason;
  /** Human-readable explanation of why the file matched. */
  matchDetail: string;
  /** Normalised relevance score in [0, 1]. */
  score: number;
}

export interface DirectoryNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: DirectoryNode[];
  language?: string;
  sizeBytes?: number;
}

export interface IndexSummary {
  totalFiles: number;
  totalLines: number;
  totalSizeBytes: number;
  languageBreakdown: Array<{ language: string; fileCount: number; lineCount: number }>;
}
