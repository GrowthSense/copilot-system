export class FoundFileDto {
  filePath: string;
  fileName: string;
  language: string | null;
  /** Lines of code. */
  lineCount: number;
  /** Normalised relevance score in [0, 1]. */
  relevanceScore: number;
  /** Why this file was selected by the LLM. */
  reason: string;
  /** Short content snippet (only present when includeSnippet=true). */
  snippet?: string;
}

export class FindRelevantFilesResponseDto {
  runId: string;
  query: string;
  files: FoundFileDto[];
  /** LLM description of the search strategy it used. */
  searchStrategy: string;
  /** Total candidate files the LLM was given to rank (before filtering). */
  totalCandidates: number;
  durationMs: number;
}
