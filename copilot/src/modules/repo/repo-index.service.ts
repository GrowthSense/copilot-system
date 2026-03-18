import { Injectable, Logger } from '@nestjs/common';
import * as path from 'path';
import { createHash } from 'crypto';
import { DatabaseService } from '../database/database.service';
import { FileReaderService } from './file-reader.service';
import { IndexRepoDto } from './dto/index-repo.dto';
import { RepoIndexResponseDto } from './dto/repo-index-response.dto';
import { IndexStatus } from '../../common/enums/index-status.enum';
import { RepoFileStatus } from '../../common/enums/repo-file-status.enum';
import { ResourceNotFoundException, ValidationException } from '../../common/exceptions/app.exception';

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_IGNORE_PATTERNS: string[] = [
  'node_modules', '.git', 'dist', '.next', 'build', 'coverage',
  '.nyc_output', '.cache', '__pycache__', '.venv', 'venv',
  '.idea', '.vscode',
  '*.log', '*.lock',
  '.DS_Store', 'Thumbs.db',
];

/** Safety limit: refuse to index repos larger than this. */
const MAX_FILES_PER_INDEX = 50_000;

/** Lines per chunk. */
const CHUNK_LINE_SIZE = 100;

/** Lines carried over from the end of the previous chunk. */
const CHUNK_LINE_OVERLAP = 10;

/** Chunk insert batch size. */
const CHUNK_BATCH_SIZE = 100;

const LANGUAGE_MAP: Readonly<Record<string, string>> = {
  ts: 'typescript', tsx: 'typescript',
  js: 'javascript', jsx: 'javascript', mjs: 'javascript', cjs: 'javascript',
  py: 'python',
  go: 'go',
  rs: 'rust',
  java: 'java',
  kt: 'kotlin', kts: 'kotlin',
  swift: 'swift',
  c: 'c', h: 'c',
  cpp: 'cpp', cxx: 'cpp', cc: 'cpp', hpp: 'cpp',
  cs: 'csharp',
  rb: 'ruby',
  php: 'php',
  sh: 'shell', bash: 'shell', zsh: 'shell', fish: 'shell',
  sql: 'sql',
  md: 'markdown', mdx: 'markdown',
  json: 'json', jsonc: 'json',
  yaml: 'yaml', yml: 'yaml',
  toml: 'toml',
  xml: 'xml',
  html: 'html', htm: 'html',
  css: 'css', scss: 'scss', sass: 'sass', less: 'less',
  graphql: 'graphql', gql: 'graphql',
  prisma: 'prisma',
  proto: 'protobuf',
  env: 'dotenv',
  dockerfile: 'dockerfile',
  makefile: 'makefile',
  tf: 'terraform', hcl: 'hcl',
  vue: 'vue',
  svelte: 'svelte',
};

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class RepoIndexService {
  private readonly logger = new Logger(RepoIndexService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly fileReader: FileReaderService,
  ) {}

  /**
   * Creates a PENDING index record and fires indexing in the background.
   * Returns immediately — callers should poll `getLatestIndex` or `getIndex`
   * to check progress.
   *
   * Future improvement: replace `setImmediate` with a Bull/BullMQ queue job
   * so indexing survives process restarts and can be distributed.
   */
  async startIndex(repoId: string, dto: IndexRepoDto): Promise<RepoIndexResponseDto> {
    const repo = await this.db.repo.findUnique({ where: { id: repoId } });
    if (!repo) throw new ResourceNotFoundException('Repo', repoId);

    const isDir = await this.fileReader.isDirectory(dto.localPath);
    if (!isDir) {
      throw new ValidationException(`localPath "${dto.localPath}" is not a valid directory`);
    }

    const ignorePatterns = [
      ...DEFAULT_IGNORE_PATTERNS,
      ...(dto.additionalIgnorePatterns ?? []),
    ];

    const index = await this.db.repoIndex.create({
      data: {
        repoId,
        status: IndexStatus.PENDING,
        localPath: dto.localPath,
        branch: dto.branch ?? repo.defaultBranch,
        ignorePatterns,
      },
    });

    setImmediate(() => {
      this.runIndexing(index.id, repoId, dto.localPath, ignorePatterns, dto.maxFileSizeBytes).catch(
        (err: Error) =>
          this.logger.error(`Unhandled indexing error for ${index.id}: ${err.message}`, err.stack),
      );
    });

    return this.toResponse(index);
  }

  async getLatestIndex(repoId: string): Promise<RepoIndexResponseDto | null> {
    const index = await this.db.repoIndex.findFirst({
      where: { repoId },
      orderBy: { createdAt: 'desc' },
    });
    return index ? this.toResponse(index) : null;
  }

  async getIndex(repoId: string, indexId: string): Promise<RepoIndexResponseDto> {
    const index = await this.db.repoIndex.findFirst({ where: { id: indexId, repoId } });
    if (!index) throw new ResourceNotFoundException('RepoIndex', indexId);
    return this.toResponse(index);
  }

  // ─── Ignore pattern matching ───────────────────────────────────────────────

  /**
   * Returns `true` when `relativePath` should be excluded from indexing.
   *
   * Pattern semantics:
   * - No slash, no wildcard  → exact match against any path segment (e.g. `node_modules`)
   * - Leading `*`            → suffix match against the filename (e.g. `*.log`)
   * - Contains `/`           → prefix match against the full relative path (e.g. `vendor/`)
   */
  shouldIgnore(relativePath: string, ignorePatterns: string[]): boolean {
    // Normalise to forward slashes for consistent matching on all platforms.
    const normPath = relativePath.split(path.sep).join('/');
    const segments = normPath.split('/');
    const fileName = segments[segments.length - 1];

    for (const pattern of ignorePatterns) {
      if (pattern.startsWith('*')) {
        const suffix = pattern.slice(1); // e.g. ".log" from "*.log"
        if (fileName.endsWith(suffix)) return true;
      } else if (pattern.includes('/')) {
        if (normPath.startsWith(pattern)) return true;
      } else {
        if (segments.includes(pattern)) return true;
        // Also match exact filename for dotfiles like ".DS_Store"
        if (fileName === pattern) return true;
      }
    }

    return false;
  }

  // ─── Background indexing ───────────────────────────────────────────────────

  private async runIndexing(
    indexId: string,
    repoId: string,
    localPath: string,
    ignorePatterns: string[],
    maxFileSizeBytes?: number,
  ): Promise<void> {
    await this.db.repoIndex.update({
      where: { id: indexId },
      data: { status: IndexStatus.RUNNING, startedAt: new Date() },
    });

    let totalFiles = 0;
    let indexedFiles = 0;
    let skippedFiles = 0;
    let errorFiles = 0;
    const errorLog: string[] = [];

    try {
      const allRelativePaths = await this.fileReader.listFilesRecursively(localPath);
      const filtered = allRelativePaths.filter((rp) => !this.shouldIgnore(rp, ignorePatterns));
      totalFiles = filtered.length;

      if (totalFiles > MAX_FILES_PER_INDEX) {
        throw new Error(
          `Repo has ${totalFiles} files which exceeds the per-index limit of ${MAX_FILES_PER_INDEX}. ` +
            `Add more ignore patterns.`,
        );
      }

      for (const relativePath of filtered) {
        const absolutePath = path.join(localPath, relativePath);
        // Derive metadata from path — no filesystem read yet.
        const fileName = relativePath.split('/').pop() ?? relativePath;
        const rawExt = fileName.includes('.')
          ? fileName.split('.').pop()!.toLowerCase()
          : '';
        // Handle extensionless filenames like "Dockerfile", "Makefile".
        const ext = rawExt || this.detectExtensionlessLanguage(fileName);
        const language = ext ? (LANGUAGE_MAP[ext] ?? null) : null;

        try {
          const readResult = await this.fileReader.readFile(
            absolutePath,
            localPath,
            maxFileSizeBytes,
          );

          if (readResult.isBinary) {
            await this.upsertFile(repoId, indexId, relativePath, fileName, ext, language, {
              sizeBytes: readResult.sizeBytes,
              contentHash: '',
              lineCount: 0,
              status: RepoFileStatus.SKIPPED,
              errorMessage: `Skipped: ${readResult.reason}`,
            });
            skippedFiles++;
            continue;
          }

          const contentHash = createHash('sha256').update(readResult.content).digest('hex');

          // Check whether content changed since the last index pass.
          const existing = await this.db.repoFile.findUnique({
            where: { repoId_filePath: { repoId, filePath: relativePath } },
            select: { id: true, contentHash: true },
          });

          const fileRecord = await this.upsertFile(repoId, indexId, relativePath, fileName, ext, language, {
            sizeBytes: readResult.sizeBytes,
            contentHash,
            lineCount: readResult.lineCount,
            status: RepoFileStatus.INDEXED,
            errorMessage: null,
          });

          // Re-chunk only when content has changed.
          const contentChanged = !existing || existing.contentHash !== contentHash;
          if (contentChanged) {
            await this.indexFileChunks(fileRecord.id, repoId, readResult.content);
          }

          indexedFiles++;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (errorLog.length < 50) errorLog.push(`${relativePath}: ${msg}`);
          errorFiles++;
          await this.upsertFile(repoId, indexId, relativePath, fileName, ext, language, {
            sizeBytes: 0,
            contentHash: '',
            lineCount: 0,
            status: RepoFileStatus.ERROR,
            errorMessage: msg,
          });
        }
      }

      await this.db.repoIndex.update({
        where: { id: indexId },
        data: {
          status: IndexStatus.COMPLETED,
          totalFiles,
          indexedFiles,
          skippedFiles,
          errorFiles,
          errorLog: errorLog.length > 0 ? errorLog.join('\n') : null,
          completedAt: new Date(),
        },
      });

      this.logger.log(
        `Index ${indexId} completed: ${indexedFiles} indexed, ${skippedFiles} skipped, ${errorFiles} errors`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Index ${indexId} failed: ${msg}`);

      await this.db.repoIndex.update({
        where: { id: indexId },
        data: {
          status: IndexStatus.FAILED,
          errorLog: msg,
          totalFiles,
          indexedFiles,
          skippedFiles,
          errorFiles,
          completedAt: new Date(),
        },
      });
    }
  }

  private async upsertFile(
    repoId: string,
    indexId: string,
    relativePath: string,
    fileName: string,
    ext: string,
    language: string | null,
    fields: {
      sizeBytes: number;
      contentHash: string;
      lineCount: number;
      status: RepoFileStatus;
      errorMessage: string | null;
    },
  ) {
    return this.db.repoFile.upsert({
      where: { repoId_filePath: { repoId, filePath: relativePath } },
      update: { indexId, fileName, extension: ext || null, language, ...fields },
      create: {
        repoId,
        indexId,
        filePath: relativePath,
        fileName,
        extension: ext || null,
        language,
        ...fields,
      },
    });
  }

  /**
   * Splits file content into overlapping line-based chunks and persists them.
   * Deletes previous chunks for the file before inserting new ones.
   *
   * Note: delete + createMany is not atomic. Wrapping in a $transaction would
   * add safety at the cost of longer lock duration — acceptable trade-off for
   * background work where retries are cheap.
   */
  private async indexFileChunks(fileId: string, repoId: string, content: string): Promise<void> {
    const lines = content.split('\n');
    const chunks: Array<{
      fileId: string;
      repoId: string;
      chunkIndex: number;
      content: string;
      startLine: number;
      endLine: number;
      tokenEstimate: number;
    }> = [];

    let chunkIndex = 0;
    let start = 0;

    while (start < lines.length) {
      const end = Math.min(start + CHUNK_LINE_SIZE, lines.length);
      const chunkContent = lines.slice(start, end).join('\n');

      chunks.push({
        fileId,
        repoId,
        chunkIndex,
        content: chunkContent,
        startLine: start + 1, // 1-indexed for human readability
        endLine: end,
        tokenEstimate: Math.ceil((chunkContent.length / 4) * 1.1),
      });

      chunkIndex++;
      const nextStart = end - CHUNK_LINE_OVERLAP;
      if (nextStart <= start) break; // Guard against infinite loop on very short files.
      start = nextStart;
    }

    if (chunks.length === 0) return;

    await this.db.repoFileChunk.deleteMany({ where: { fileId } });

    for (let i = 0; i < chunks.length; i += CHUNK_BATCH_SIZE) {
      await this.db.repoFileChunk.createMany({
        data: chunks.slice(i, i + CHUNK_BATCH_SIZE),
        skipDuplicates: true,
      });
    }
  }

  private detectExtensionlessLanguage(fileName: string): string {
    const lower = fileName.toLowerCase();
    if (lower === 'dockerfile') return 'dockerfile';
    if (lower === 'makefile') return 'makefile';
    if (lower === 'gemfile') return 'ruby';
    if (lower === 'procfile') return 'shell';
    return '';
  }

  private toResponse(index: {
    id: string;
    repoId: string;
    status: string;
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
  }): RepoIndexResponseDto {
    return {
      id: index.id,
      repoId: index.repoId,
      status: index.status as IndexStatus,
      localPath: index.localPath,
      branch: index.branch,
      ignorePatterns: index.ignorePatterns,
      totalFiles: index.totalFiles,
      indexedFiles: index.indexedFiles,
      skippedFiles: index.skippedFiles,
      errorFiles: index.errorFiles,
      errorLog: index.errorLog,
      startedAt: index.startedAt,
      completedAt: index.completedAt,
      createdAt: index.createdAt,
      updatedAt: index.updatedAt,
    };
  }
}
