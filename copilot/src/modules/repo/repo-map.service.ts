import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { RepoSearchService } from './repo-search.service';
import { DirectoryNode, FileMatchResult, IndexSummary } from './interfaces/repo-index.interface';
import { RepoFileStatus } from '../../common/enums/repo-file-status.enum';
import { FindCandidatesDto } from './dto/find-candidates.dto';

@Injectable()
export class RepoMapService {
  private readonly logger = new Logger(RepoMapService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly search: RepoSearchService,
  ) {}

  /**
   * Returns the most relevant files for a natural language query.
   * Delegates to RepoSearchService which handles keyword heuristics.
   */
  async getCandidatesForQuery(repoId: string, dto: FindCandidatesDto): Promise<FileMatchResult[]> {
    return this.search.findCandidates(repoId, dto);
  }

  /**
   * Builds a hierarchical directory tree of all INDEXED files in the repo.
   * File paths use forward slashes; the tree mirrors the directory structure.
   */
  async getDirectoryTree(repoId: string): Promise<DirectoryNode> {
    const files = await this.db.repoFile.findMany({
      where: { repoId, status: RepoFileStatus.INDEXED },
      select: { filePath: true, fileName: true, language: true, sizeBytes: true },
      orderBy: { filePath: 'asc' },
    });

    return this.buildTree(files, repoId);
  }

  /**
   * Returns a flat mapping of language → sorted list of file paths.
   */
  async getFilesByLanguage(repoId: string): Promise<Record<string, string[]>> {
    const files = await this.db.repoFile.findMany({
      where: { repoId, status: RepoFileStatus.INDEXED },
      select: { filePath: true, language: true },
      orderBy: { filePath: 'asc' },
    });

    const result: Record<string, string[]> = {};
    for (const file of files) {
      const lang = file.language ?? 'unknown';
      (result[lang] ??= []).push(file.filePath);
    }
    return result;
  }

  /**
   * Returns aggregate statistics for the repo's indexed files.
   */
  async getIndexSummary(repoId: string): Promise<IndexSummary> {
    const files = await this.db.repoFile.findMany({
      where: { repoId, status: RepoFileStatus.INDEXED },
      select: { language: true, lineCount: true, sizeBytes: true },
    });

    const langMap = new Map<string, { fileCount: number; lineCount: number }>();
    let totalLines = 0;
    let totalSizeBytes = 0;

    for (const file of files) {
      const lang = file.language ?? 'unknown';
      const entry = langMap.get(lang) ?? { fileCount: 0, lineCount: 0 };
      entry.fileCount++;
      entry.lineCount += file.lineCount;
      langMap.set(lang, entry);
      totalLines += file.lineCount;
      totalSizeBytes += file.sizeBytes;
    }

    const languageBreakdown = [...langMap.entries()]
      .map(([language, stats]) => ({ language, ...stats }))
      .sort((a, b) => b.fileCount - a.fileCount);

    return {
      totalFiles: files.length,
      totalLines,
      totalSizeBytes,
      languageBreakdown,
    };
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private buildTree(
    files: Array<{ filePath: string; fileName: string; language: string | null; sizeBytes: number }>,
    rootName: string,
  ): DirectoryNode {
    const root: DirectoryNode = { name: rootName, path: '', type: 'directory', children: [] };

    for (const file of files) {
      // File paths are stored with forward slashes.
      const parts = file.filePath.split('/');
      let current = root;

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const isLast = i === parts.length - 1;
        const nodePath = parts.slice(0, i + 1).join('/');

        if (isLast) {
          current.children!.push({
            name: part,
            path: nodePath,
            type: 'file',
            language: file.language ?? undefined,
            sizeBytes: file.sizeBytes,
          });
        } else {
          let dir = current.children!.find((c) => c.name === part && c.type === 'directory');
          if (!dir) {
            dir = { name: part, path: nodePath, type: 'directory', children: [] };
            current.children!.push(dir);
          }
          current = dir;
        }
      }
    }

    return root;
  }
}
