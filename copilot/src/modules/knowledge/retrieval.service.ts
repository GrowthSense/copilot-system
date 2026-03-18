import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { ChunkResult, RetrievalQuery } from './interfaces/knowledge-source.interface';
import { KnowledgeSourceType } from '../../common/enums/knowledge-source-type.enum';
import { Prisma } from '@prisma/client';

@Injectable()
export class RetrievalService {
  private readonly logger = new Logger(RetrievalService.name);

  constructor(private readonly db: DatabaseService) {}

  /**
   * Retrieve the most relevant knowledge chunks for a query.
   *
   * Current strategy: keyword-frequency scoring (TF-like).
   * Phase 5 upgrade path: replace `scoreChunk` with pgvector cosine similarity.
   * The filter logic (sourceType, tags, sourceIds) remains unchanged.
   */
  async retrieve(query: RetrievalQuery): Promise<ChunkResult[]> {
    const { query: queryText, topK = 10, sourceType, tags, sourceIds, minScore = 0 } = query;

    this.logger.debug(
      `retrieve: query="${queryText}", topK=${topK}, sourceType=${sourceType ?? 'any'}`,
    );

    const where = this.buildWhereClause({ sourceType, tags, sourceIds });

    const chunks = await this.db.knowledgeChunk.findMany({
      where,
      include: {
        source: {
          select: {
            id: true,
            title: true,
            sourceType: true,
            sourceRef: true,
            tags: true,
          },
        },
      },
      // Fetch a broader pool then re-rank by score in memory.
      take: topK * 10,
    });

    const terms = this.tokenise(queryText);

    const scored = chunks
      .map((chunk) => ({
        chunk,
        score: this.scoreChunk(chunk.content, terms),
      }))
      .filter(({ score }) => score >= minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

    return scored.map(({ chunk, score }) => ({
      chunkId: chunk.id,
      sourceId: chunk.source.id,
      sourceTitle: chunk.source.title,
      sourceType: chunk.source.sourceType as KnowledgeSourceType,
      sourceRef: chunk.source.sourceRef,
      chunkIndex: chunk.chunkIndex,
      content: chunk.content,
      score,
      tags: chunk.source.tags,
    }));
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private buildWhereClause(filters: {
    sourceType?: KnowledgeSourceType;
    tags?: string[];
    sourceIds?: string[];
  }): Prisma.KnowledgeChunkWhereInput {
    const sourceWhere: Prisma.KnowledgeSourceWhereInput = { isActive: true };

    if (filters.sourceType) {
      sourceWhere.sourceType = filters.sourceType;
    }

    if (filters.tags && filters.tags.length > 0) {
      sourceWhere.tags = { hasSome: filters.tags };
    }

    if (filters.sourceIds && filters.sourceIds.length > 0) {
      sourceWhere.id = { in: filters.sourceIds };
    }

    return { source: sourceWhere };
  }

  /**
   * Keyword frequency score: sum of (term occurrences / chunk word count).
   * Normalised to [0, 1] range via tanh so longer chunks aren't penalised.
   *
   * Replace this method with a pgvector call in Phase 5:
   * ```
   * await this.db.$queryRaw`
   *   SELECT id, 1 - (embedding <=> ${queryEmbedding}::vector) AS score
   *   FROM knowledge_chunks ORDER BY score DESC LIMIT ${topK}
   * `
   * ```
   */
  private scoreChunk(content: string, terms: string[]): number {
    if (terms.length === 0) return 0;
    const lower = content.toLowerCase();
    const words = lower.split(/\s+/).length || 1;
    let hits = 0;
    for (const term of terms) {
      let pos = 0;
      while ((pos = lower.indexOf(term, pos)) !== -1) {
        hits++;
        pos += term.length;
      }
    }
    const rawScore = hits / words;
    // tanh normalises so diminishing returns kick in beyond a few hits.
    return Math.tanh(rawScore * 10);
  }

  /** Lower-case, remove punctuation, deduplicate stop words, min length 2. */
  private tokenise(query: string): string[] {
    const STOP_WORDS = new Set([
      'a', 'an', 'the', 'is', 'it', 'in', 'on', 'at', 'to', 'for', 'of',
      'and', 'or', 'but', 'not', 'be', 'as', 'by', 'with', 'this', 'that',
      'are', 'was', 'were', 'has', 'have', 'had', 'do', 'does', 'did',
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
}
