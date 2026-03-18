import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { DatabaseService } from '../database/database.service';
import { ChunkingService } from './chunking.service';
import { PlainTextParser } from './parsers/plain-text.parser';
import { MarkdownParser } from './parsers/markdown.parser';
import { HtmlParser } from './parsers/html.parser';
import {
  ChunkOptions,
  IngestOptions,
  IngestResult,
} from './interfaces/knowledge-source.interface';
import { KnowledgeSourceType } from '../../common/enums/knowledge-source-type.enum';

@Injectable()
export class IngestionService {
  private readonly logger = new Logger(IngestionService.name);

  private readonly plainTextParser = new PlainTextParser();
  private readonly markdownParser = new MarkdownParser();
  private readonly htmlParser = new HtmlParser();

  constructor(
    private readonly db: DatabaseService,
    private readonly chunking: ChunkingService,
  ) {}

  // ─── Public ingest methods ────────────────────────────────────────────────

  async ingestText(content: string, opts: IngestOptions): Promise<IngestResult> {
    const parsed = this.plainTextParser.parse(content, opts.sourceRef);
    return this.persistSource(content, parsed, {
      ...opts,
      sourceType: opts.sourceType ?? KnowledgeSourceType.PLAIN_TEXT,
    });
  }

  async ingestMarkdown(content: string, opts: IngestOptions): Promise<IngestResult> {
    const parsed = this.markdownParser.parse(content, opts.sourceRef);
    return this.persistSource(content, parsed, {
      ...opts,
      sourceType: opts.sourceType ?? KnowledgeSourceType.MARKDOWN,
    });
  }

  async ingestHtml(html: string, opts: IngestOptions): Promise<IngestResult> {
    const parsed = this.htmlParser.parse(html, opts.sourceRef);
    return this.persistSource(html, parsed, {
      ...opts,
      sourceType: opts.sourceType ?? KnowledgeSourceType.WEBPAGE,
    });
  }

  // ─── Persistence ──────────────────────────────────────────────────────────

  private async persistSource(
    rawContent: string,
    parsed: ReturnType<PlainTextParser['parse']>,
    opts: IngestOptions,
    chunkOptions?: Partial<ChunkOptions>,
  ): Promise<IngestResult> {
    const checksum = createHash('sha256').update(rawContent).digest('hex');
    const title = opts.title ?? parsed.title;

    // Deduplication check: same sourceRef + sourceType AND same checksum → skip.
    const existing = await this.db.knowledgeSource.findUnique({
      where: { sourceRef_sourceType: { sourceRef: opts.sourceRef, sourceType: opts.sourceType! } },
      select: { id: true, checksum: true, title: true },
    });

    if (existing && existing.checksum === checksum) {
      this.logger.log(`Skipping duplicate ingest: ${opts.sourceRef} (checksum unchanged)`);
      return {
        sourceId: existing.id,
        title: existing.title,
        sourceType: opts.sourceType!,
        chunksCreated: 0,
        isDuplicate: true,
        checksum,
      };
    }

    // Build chunks from sections.
    const chunks = this.chunking.chunkSections(parsed.sections, chunkOptions);

    // Upsert source record.
    const source = await this.db.knowledgeSource.upsert({
      where: { sourceRef_sourceType: { sourceRef: opts.sourceRef, sourceType: opts.sourceType! } },
      update: {
        title,
        checksum,
        tags: opts.tags ?? [],
        wordCount: parsed.wordCount,
        isActive: true,
        metadata: (opts.metadata ?? {}) as object,
        // Replace all existing chunks on re-ingest.
        chunks: { deleteMany: {} },
      },
      create: {
        title,
        sourceType: opts.sourceType!,
        sourceRef: opts.sourceRef,
        checksum,
        tags: opts.tags ?? [],
        wordCount: parsed.wordCount,
        isActive: true,
        metadata: (opts.metadata ?? {}) as object,
      },
    });

    // Upsert each chunk. Using createMany for performance; on conflict we
    // skip because we deleted all chunks above on update.
    if (chunks.length > 0) {
      await this.db.knowledgeChunk.createMany({
        data: chunks.map((c) => ({
          sourceId: source.id,
          chunkIndex: c.index,
          content: c.content,
          contentLength: c.content.length,
          tokenEstimate: c.tokenEstimate,
          startChar: c.startChar,
          endChar: c.endChar,
        })),
        skipDuplicates: true,
      });
    }

    this.logger.log(`Ingested "${title}" → ${chunks.length} chunks (sourceId=${source.id})`);

    return {
      sourceId: source.id,
      title,
      sourceType: opts.sourceType!,
      chunksCreated: chunks.length,
      isDuplicate: false,
      checksum,
    };
  }
}
