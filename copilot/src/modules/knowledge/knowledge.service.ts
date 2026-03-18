import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { IngestionService } from './ingestion.service';
import { RetrievalService } from './retrieval.service';
import { IngestDocumentDto } from './dto/ingest-document.dto';
import { IngestTextDto } from './dto/ingest-text.dto';
import { IngestMarkdownDto } from './dto/ingest-markdown.dto';
import { IngestWebpageDto } from './dto/ingest-webpage.dto';
import { QueryKnowledgeDto } from './dto/query-knowledge.dto';
import { RetrieveChunksDto } from './dto/retrieve-chunks.dto';
import { createHash } from 'crypto';
import { IngestResult, ChunkResult } from './interfaces/knowledge-source.interface';
import { KnowledgeSourceType } from '../../common/enums/knowledge-source-type.enum';
import { Prisma } from '@prisma/client';

export interface LegacyDocumentResult {
  id: string;
  filePath: string;
  content: string;
  score: number;
}

export interface SourceListItem {
  id: string;
  title: string;
  sourceType: KnowledgeSourceType;
  sourceRef: string;
  tags: string[];
  wordCount: number;
  isActive: boolean;
  chunkCount: number;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class KnowledgeService {
  private readonly logger = new Logger(KnowledgeService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly ingestion: IngestionService,
    private readonly retrieval: RetrievalService,
  ) {}

  // ─── New pipeline methods ─────────────────────────────────────────────────

  async ingestText(dto: IngestTextDto): Promise<IngestResult> {
    return this.ingestion.ingestText(dto.content, {
      sourceRef: dto.sourceRef,
      sourceType: dto.sourceType ?? KnowledgeSourceType.PLAIN_TEXT,
      title: dto.title,
      tags: dto.tags,
      metadata: dto.metadata,
    });
  }

  async ingestMarkdown(dto: IngestMarkdownDto): Promise<IngestResult> {
    return this.ingestion.ingestMarkdown(dto.content, {
      sourceRef: dto.sourceRef,
      sourceType: KnowledgeSourceType.MARKDOWN,
      title: dto.title,
      tags: dto.tags,
      metadata: dto.metadata,
    });
  }

  async ingestWebpage(dto: IngestWebpageDto): Promise<IngestResult> {
    return this.ingestion.ingestHtml(dto.html, {
      sourceRef: dto.url,
      sourceType: KnowledgeSourceType.WEBPAGE,
      title: dto.title,
      tags: dto.tags,
      metadata: dto.metadata,
    });
  }

  async retrieveChunks(dto: RetrieveChunksDto): Promise<ChunkResult[]> {
    return this.retrieval.retrieve({
      query: dto.query,
      topK: dto.topK,
      sourceType: dto.sourceType,
      tags: dto.tags,
      sourceIds: dto.sourceIds,
      minScore: dto.minScore,
    });
  }

  async listSources(sourceType?: KnowledgeSourceType): Promise<SourceListItem[]> {
    const sources = await this.db.knowledgeSource.findMany({
      where: {
        isActive: true,
        ...(sourceType ? { sourceType } : {}),
      },
      include: { _count: { select: { chunks: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return sources.map((s) => ({
      id: s.id,
      title: s.title,
      sourceType: s.sourceType as KnowledgeSourceType,
      sourceRef: s.sourceRef,
      tags: s.tags,
      wordCount: s.wordCount,
      isActive: s.isActive,
      chunkCount: s._count.chunks,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    }));
  }

  async getSource(id: string): Promise<SourceListItem> {
    const source = await this.db.knowledgeSource.findUnique({
      where: { id },
      include: { _count: { select: { chunks: true } } },
    });
    if (!source) throw new NotFoundException(`Knowledge source ${id} not found`);

    return {
      id: source.id,
      title: source.title,
      sourceType: source.sourceType as KnowledgeSourceType,
      sourceRef: source.sourceRef,
      tags: source.tags,
      wordCount: source.wordCount,
      isActive: source.isActive,
      chunkCount: source._count.chunks,
      createdAt: source.createdAt,
      updatedAt: source.updatedAt,
    };
  }

  async deleteSource(id: string): Promise<{ id: string }> {
    await this.getSource(id); // throws 404 if not found
    await this.db.knowledgeSource.update({ where: { id }, data: { isActive: false } });
    return { id };
  }

  // ─── Legacy repo-file methods (Phase 1 / 2 compatibility) ─────────────────

  async ingest(dto: IngestDocumentDto): Promise<{ id: string; filePath: string }> {
    this.logger.log(`Ingesting document: ${dto.filePath} for repo: ${dto.repoId}`);
    const contentHash = createHash('sha256').update(dto.content).digest('hex');

    const doc = await this.db.knowledgeDocument.upsert({
      where: {
        repoId_filePath_chunkIndex: {
          repoId: dto.repoId,
          filePath: dto.filePath,
          chunkIndex: 0,
        },
      },
      update: {
        content: dto.content,
        contentHash,
        language: dto.language ?? null,
        metadata: (dto.metadata ?? {}) as Prisma.InputJsonValue,
      },
      create: {
        repoId: dto.repoId,
        filePath: dto.filePath,
        content: dto.content,
        contentHash,
        language: dto.language ?? null,
        metadata: (dto.metadata ?? {}) as Prisma.InputJsonValue,
        chunkIndex: 0,
      },
    });

    return { id: doc.id, filePath: doc.filePath };
  }

  async query(dto: QueryKnowledgeDto): Promise<LegacyDocumentResult[]> {
    this.logger.log(`Querying knowledge base: "${dto.query}"`);

    // If sourceType/tags/sourceIds are provided, delegate to the new pipeline.
    if (dto.sourceType ?? dto.tags?.length ?? dto.sourceIds?.length) {
      const chunks = await this.retrieval.retrieve({
        query: dto.query,
        topK: dto.topK,
        sourceType: dto.sourceType,
        tags: dto.tags,
        sourceIds: dto.sourceIds,
      });
      return chunks.map((c) => ({
        id: c.chunkId,
        filePath: c.sourceRef,
        content: c.content,
        score: c.score,
      }));
    }

    // Legacy full-text fallback for repo-file queries.
    const where = dto.repoId ? { repoId: dto.repoId } : {};
    const docs = await this.db.knowledgeDocument.findMany({
      where,
      take: dto.topK ?? 5,
      orderBy: { createdAt: 'desc' },
    });

    return docs.map((d) => ({
      id: d.id,
      filePath: d.filePath,
      content: d.content,
      score: 1.0,
    }));
  }

  async deleteByRepo(repoId: string): Promise<{ count: number }> {
    const result = await this.db.knowledgeDocument.deleteMany({ where: { repoId } });
    return { count: result.count };
  }
}
