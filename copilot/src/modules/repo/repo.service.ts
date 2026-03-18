import { Injectable, Logger } from '@nestjs/common';
import * as path from 'path';
import { plainToInstance } from 'class-transformer';
import { DatabaseService } from '../database/database.service';
import { FileReaderService } from './file-reader.service';
import { RegisterRepoDto } from './dto/register-repo.dto';
import { UpdateRepoDto } from './dto/update-repo.dto';
import { RepoResponseDto } from './dto/repo-response.dto';
import { RepoFileResponseDto } from './dto/repo-file-response.dto';
import { ReadFileResponseDto } from './dto/read-file-response.dto';
import { RepoFileStatus } from '../../common/enums/repo-file-status.enum';
import {
  ResourceNotFoundException,
  ConflictException,
  ValidationException,
} from '../../common/exceptions/app.exception';

@Injectable()
export class RepoService {
  private readonly logger = new Logger(RepoService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly fileReader: FileReaderService,
  ) {}

  // ─── Repo CRUD ────────────────────────────────────────────────────────────

  async register(dto: RegisterRepoDto): Promise<RepoResponseDto> {
    const existing = await this.db.repo.findUnique({ where: { fullName: dto.fullName } });
    if (existing) {
      throw new ConflictException(`Repo "${dto.fullName}" is already registered`);
    }

    const repo = await this.db.repo.create({
      data: {
        name: dto.name,
        fullName: dto.fullName,
        cloneUrl: dto.cloneUrl,
        defaultBranch: dto.defaultBranch ?? 'main',
        description: dto.description ?? null,
      },
    });

    this.logger.log(`Registered repo: ${repo.fullName}`);
    return plainToInstance(RepoResponseDto, repo, { excludeExtraneousValues: true });
  }

  async findAll(): Promise<RepoResponseDto[]> {
    const repos = await this.db.repo.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });
    return plainToInstance(RepoResponseDto, repos, { excludeExtraneousValues: true });
  }

  async findOne(id: string): Promise<RepoResponseDto> {
    const repo = await this.db.repo.findUnique({ where: { id } });
    if (!repo) throw new ResourceNotFoundException('Repo', id);
    return plainToInstance(RepoResponseDto, repo, { excludeExtraneousValues: true });
  }

  async update(id: string, dto: UpdateRepoDto): Promise<RepoResponseDto> {
    const repo = await this.db.repo.findUnique({ where: { id } });
    if (!repo) throw new ResourceNotFoundException('Repo', id);

    const updated = await this.db.repo.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.cloneUrl !== undefined ? { cloneUrl: dto.cloneUrl } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.defaultBranch !== undefined ? { defaultBranch: dto.defaultBranch } : {}),
      },
    });

    this.logger.log(`Updated repo: ${updated.name}`);
    return plainToInstance(RepoResponseDto, updated, { excludeExtraneousValues: true });
  }

  async deactivate(id: string): Promise<RepoResponseDto> {
    const repo = await this.db.repo.findUnique({ where: { id } });
    if (!repo) throw new ResourceNotFoundException('Repo', id);

    const updated = await this.db.repo.update({ where: { id }, data: { isActive: false } });
    return plainToInstance(RepoResponseDto, updated, { excludeExtraneousValues: true });
  }

  // ─── File access ──────────────────────────────────────────────────────────

  async getFileMetadata(repoId: string, fileId: string): Promise<RepoFileResponseDto> {
    const file = await this.db.repoFile.findFirst({ where: { id: fileId, repoId } });
    if (!file) throw new ResourceNotFoundException('RepoFile', fileId);
    return this.toFileResponse(file);
  }

  async listFiles(
    repoId: string,
    filters?: { language?: string; extension?: string },
  ): Promise<RepoFileResponseDto[]> {
    const files = await this.db.repoFile.findMany({
      where: {
        repoId,
        status: RepoFileStatus.INDEXED,
        ...(filters?.language ? { language: filters.language } : {}),
        ...(filters?.extension ? { extension: filters.extension } : {}),
      },
      orderBy: { filePath: 'asc' },
    });
    return files.map((f) => this.toFileResponse(f));
  }

  /**
   * Reads the full content of a file from disk using the localPath recorded in
   * its most recent RepoIndex. Returns live on-disk content — not a snapshot —
   * so edits since the last index are reflected.
   *
   * Throws `ValidationException` for skipped (binary/large) or errored files.
   */
  async readFileContent(repoId: string, fileId: string): Promise<ReadFileResponseDto> {
    const file = await this.db.repoFile.findFirst({
      where: { id: fileId, repoId },
      include: { index: { select: { localPath: true } } },
    });

    if (!file) throw new ResourceNotFoundException('RepoFile', fileId);

    if (file.status === RepoFileStatus.SKIPPED) {
      throw new ValidationException(
        `File "${file.filePath}" was skipped during indexing ` +
          `(${file.errorMessage ?? 'binary or too large'}). Cannot read content.`,
      );
    }

    if (file.status === RepoFileStatus.ERROR) {
      throw new ValidationException(
        `File "${file.filePath}" failed to index: ${file.errorMessage ?? 'unknown error'}`,
      );
    }

    const absolutePath = path.join(file.index.localPath, file.filePath);
    const readResult = await this.fileReader.readFile(absolutePath, file.index.localPath);

    if (readResult.isBinary) {
      throw new ValidationException(
        `File "${file.filePath}" is not a readable text file (${readResult.reason}).`,
      );
    }

    return {
      fileId: file.id,
      repoId: file.repoId,
      filePath: file.filePath,
      fileName: file.fileName,
      language: file.language,
      sizeBytes: readResult.sizeBytes,
      lineCount: readResult.lineCount,
      content: readResult.content,
    };
  }

  /**
   * Read a file by its relative path within the repo (e.g. "src/app.ts").
   *
   * Looks up the file record using the composite unique index `(repoId, filePath)`,
   * then reads live on-disk content via `FileReaderService`. Used by agent tools that
   * receive a path from the LLM rather than an internal file ID.
   */
  async readFileByPath(repoId: string, filePath: string): Promise<ReadFileResponseDto> {
    const file = await this.db.repoFile.findFirst({
      where: { repoId, filePath, status: RepoFileStatus.INDEXED },
      include: { index: { select: { localPath: true } } },
    });

    if (!file) {
      throw new ResourceNotFoundException(
        'RepoFile',
        `${repoId}/${filePath}`,
      );
    }

    const absolutePath = path.join(file.index.localPath, file.filePath);
    const readResult = await this.fileReader.readFile(absolutePath, file.index.localPath);

    if (readResult.isBinary) {
      throw new ValidationException(
        `File "${filePath}" is not a readable text file (${readResult.reason}).`,
      );
    }

    return {
      fileId: file.id,
      repoId: file.repoId,
      filePath: file.filePath,
      fileName: file.fileName,
      language: file.language,
      sizeBytes: readResult.sizeBytes,
      lineCount: readResult.lineCount,
      content: readResult.content,
    };
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private toFileResponse(file: {
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
    status: string;
    errorMessage: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): RepoFileResponseDto {
    return {
      id: file.id,
      repoId: file.repoId,
      indexId: file.indexId,
      filePath: file.filePath,
      fileName: file.fileName,
      extension: file.extension,
      language: file.language,
      sizeBytes: file.sizeBytes,
      lineCount: file.lineCount,
      contentHash: file.contentHash,
      status: file.status as RepoFileStatus,
      errorMessage: file.errorMessage,
      createdAt: file.createdAt,
      updatedAt: file.updatedAt,
    };
  }
}
