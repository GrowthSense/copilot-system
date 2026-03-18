import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DatabaseService } from '../database/database.service';
import { SearchFilesDto } from './dto/search-files.dto';
import { FindCandidatesDto } from './dto/find-candidates.dto';
import { FileMatchResult, MatchReason, SearchMode } from './interfaces/repo-index.interface';
import { RepoFileStatus } from '../../common/enums/repo-file-status.enum';

// Local type alias for the shape returned by Prisma repoFile queries.
type FileRow = {
  id: string;
  repoId: string;
  filePath: string;
  fileName: string;
  extension: string | null;
  language: string | null;
  sizeBytes: number;
  lineCount: number;
};

@Injectable()
export class RepoSearchService {
  private readonly logger = new Logger(RepoSearchService.name);

  constructor(private readonly db: DatabaseService) {}

  // ─── Public search entry point ────────────────────────────────────────────

  async search(repoId: string, dto: SearchFilesDto): Promise<FileMatchResult[]> {
    const { query, mode = SearchMode.ALL, topK = 20 } = dto;
    this.logger.debug(`search: repoId=${repoId} query="${query}" mode=${mode}`);

    switch (mode) {
      case SearchMode.FILENAME:
        return this.searchByFilename(repoId, query, topK);
      case SearchMode.PATH:
        return this.searchByPath(repoId, query, topK);
      case SearchMode.KEYWORD:
        return this.searchByKeyword(repoId, query, topK);
      case SearchMode.ALL:
        return this.searchAll(repoId, query, topK);
    }
  }

  // ─── Candidate finder (natural language → top files) ─────────────────────

  /**
   * Returns the most relevant files for a natural language query.
   *
   * Scoring:
   *  +3 per query term found in filename
   *  +2 per query term found in file path
   *  +1 per occurrence (capped at 5 per term) found in chunk content
   *
   * Scores are normalised to [0, 1] before returning.
   *
   * Phase 6 upgrade: replace content scoring with pgvector cosine similarity
   * on `RepoFileChunk.embedding` after symbol extraction is wired.
   */
  async findCandidates(repoId: string, dto: FindCandidatesDto): Promise<FileMatchResult[]> {
    const terms = this.tokenise(dto.query);
    if (terms.length === 0) return [];

    const scoreMap = new Map<
      string,
      { file: FileRow; score: number; reasons: Set<string> }
    >();

    // ── Filename and path term matching ──────────────────────────────────────
    const fileWhere: Prisma.RepoFileWhereInput = {
      repoId,
      status: RepoFileStatus.INDEXED,
      OR: terms.flatMap((term) => [
        { fileName: { contains: term, mode: 'insensitive' } },
        { filePath: { contains: term, mode: 'insensitive' } },
      ]),
    };

    const fileMatches = await this.db.repoFile.findMany({
      where: fileWhere,
      select: fileSelectFields(),
      take: 500,
    });

    for (const file of fileMatches) {
      let score = 0;
      const reasons = new Set<string>();

      for (const term of terms) {
        if (file.fileName.toLowerCase().includes(term)) {
          score += 3;
          reasons.add(`filename:${term}`);
        }
        if (file.filePath.toLowerCase().includes(term)) {
          score += 2;
          reasons.add(`path:${term}`);
        }
      }

      if (score > 0) scoreMap.set(file.id, { file, score, reasons });
    }

    // ── Chunk content matching ────────────────────────────────────────────────
    for (const term of terms) {
      const chunks = await this.db.repoFileChunk.findMany({
        where: {
          repoId,
          content: { contains: term, mode: 'insensitive' },
          file: { status: RepoFileStatus.INDEXED },
        },
        include: { file: { select: fileSelectFields() } },
        take: 200,
      });

      for (const chunk of chunks) {
        const hits = Math.min(this.countOccurrences(chunk.content.toLowerCase(), term), 5);
        const entry = scoreMap.get(chunk.fileId);

        if (entry) {
          entry.score += hits;
          entry.reasons.add(`content:${term}`);
        } else {
          scoreMap.set(chunk.fileId, {
            file: chunk.file,
            score: hits,
            reasons: new Set([`content:${term}`]),
          });
        }
      }
    }

    const sorted = [...scoreMap.values()]
      .sort((a, b) => b.score - a.score)
      .slice(0, dto.topK ?? 10);

    const maxScore = sorted[0]?.score ?? 1;

    return sorted.map(({ file, score, reasons }) =>
      this.toFileMatch(file, MatchReason.CANDIDATE_SCORED, this.formatReasons(reasons), score / maxScore),
    );
  }

  // ─── Targeted search methods ──────────────────────────────────────────────

  private async searchByFilename(
    repoId: string,
    query: string,
    topK: number,
  ): Promise<FileMatchResult[]> {
    const files = await this.db.repoFile.findMany({
      where: {
        repoId,
        status: RepoFileStatus.INDEXED,
        fileName: { contains: query, mode: 'insensitive' },
      },
      select: fileSelectFields(),
      take: topK,
    });

    return files.map((f) => {
      const isExact = f.fileName.toLowerCase() === query.toLowerCase();
      return this.toFileMatch(
        f,
        isExact ? MatchReason.FILENAME_EXACT : MatchReason.FILENAME_FUZZY,
        `Filename contains "${query}"`,
        isExact ? 1.0 : 0.8,
      );
    });
  }

  private async searchByPath(
    repoId: string,
    query: string,
    topK: number,
  ): Promise<FileMatchResult[]> {
    const files = await this.db.repoFile.findMany({
      where: {
        repoId,
        status: RepoFileStatus.INDEXED,
        filePath: { contains: query, mode: 'insensitive' },
      },
      select: fileSelectFields(),
      take: topK,
    });

    return files.map((f) =>
      this.toFileMatch(f, MatchReason.PATH_FRAGMENT, `Path contains "${query}"`, 0.9),
    );
  }

  private async searchByKeyword(
    repoId: string,
    query: string,
    topK: number,
  ): Promise<FileMatchResult[]> {
    const terms = this.tokenise(query);
    if (terms.length === 0) return [];

    const fileHits = new Map<string, { file: FileRow; hits: number }>();

    for (const term of terms) {
      const chunks = await this.db.repoFileChunk.findMany({
        where: {
          repoId,
          content: { contains: term, mode: 'insensitive' },
          file: { status: RepoFileStatus.INDEXED },
        },
        include: { file: { select: fileSelectFields() } },
        take: 200,
      });

      for (const chunk of chunks) {
        const hits = this.countOccurrences(chunk.content.toLowerCase(), term);
        const entry = fileHits.get(chunk.fileId);
        if (entry) {
          entry.hits += hits;
        } else {
          fileHits.set(chunk.fileId, { file: chunk.file, hits });
        }
      }
    }

    const sorted = [...fileHits.values()]
      .sort((a, b) => b.hits - a.hits)
      .slice(0, topK);

    const maxHits = sorted[0]?.hits ?? 1;

    return sorted.map(({ file, hits }) =>
      this.toFileMatch(
        file,
        MatchReason.KEYWORD_IN_CONTENT,
        `Content matches "${query}" (${hits} occurrences)`,
        hits / maxHits,
      ),
    );
  }

  private async searchAll(repoId: string, query: string, topK: number): Promise<FileMatchResult[]> {
    const [byFilename, byPath, byKeyword] = await Promise.all([
      this.searchByFilename(repoId, query, topK),
      this.searchByPath(repoId, query, topK),
      this.searchByKeyword(repoId, query, topK),
    ]);

    // Merge and deduplicate by fileId, keeping the highest score for each file.
    const merged = new Map<string, FileMatchResult>();
    for (const result of [...byFilename, ...byPath, ...byKeyword]) {
      const existing = merged.get(result.fileId);
      if (!existing || result.score > existing.score) {
        merged.set(result.fileId, result);
      }
    }

    return [...merged.values()]
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private toFileMatch(
    file: FileRow,
    matchReason: MatchReason,
    matchDetail: string,
    score: number,
  ): FileMatchResult {
    return {
      fileId: file.id,
      repoId: file.repoId,
      filePath: file.filePath,
      fileName: file.fileName,
      extension: file.extension ?? undefined,
      language: file.language ?? undefined,
      sizeBytes: file.sizeBytes,
      lineCount: file.lineCount,
      matchReason,
      matchDetail,
      score,
    };
  }

  /** Lower-case, strip punctuation, remove stop words, deduplicate. */
  private tokenise(query: string): string[] {
    const STOP_WORDS = new Set([
      'a', 'an', 'the', 'is', 'it', 'in', 'on', 'at', 'to', 'for', 'of',
      'and', 'or', 'but', 'not', 'be', 'as', 'by', 'with', 'this', 'that',
      'are', 'was', 'were', 'has', 'have', 'had', 'do', 'does', 'did',
      'where', 'which', 'who', 'how', 'what', 'when', 'find', 'get', 'show',
    ]);
    return [
      ...new Set(
        query
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, ' ')
          .split(/\s+/)
          .filter((w) => w.length >= 2 && !STOP_WORDS.has(w)),
      ),
    ];
  }

  private countOccurrences(text: string, term: string): number {
    let count = 0;
    let pos = 0;
    while ((pos = text.indexOf(term, pos)) !== -1) {
      count++;
      pos += term.length;
    }
    return count;
  }

  private formatReasons(reasons: Set<string>): string {
    const filenames = [...reasons].filter((r) => r.startsWith('filename:'));
    const paths = [...reasons].filter((r) => r.startsWith('path:'));
    const content = [...reasons].filter((r) => r.startsWith('content:'));

    const parts: string[] = [];
    if (filenames.length) parts.push(`filename matches ${filenames.map((r) => `"${r.slice(9)}"`).join(', ')}`);
    if (paths.length) parts.push(`path matches ${paths.map((r) => `"${r.slice(5)}"`).join(', ')}`);
    if (content.length) parts.push(`content matches ${content.map((r) => `"${r.slice(8)}"`).join(', ')}`);

    return parts.join('; ') || 'relevance score';
  }
}

// Extracted so it can be reused in includes without duplication.
function fileSelectFields(): {
  id: true; repoId: true; filePath: true; fileName: true;
  extension: true; language: true; sizeBytes: true; lineCount: true;
} {
  return {
    id: true, repoId: true, filePath: true, fileName: true,
    extension: true, language: true, sizeBytes: true, lineCount: true,
  };
}
