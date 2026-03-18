import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { IsArray, IsNotEmpty, IsOptional, IsString, IsUrl } from 'class-validator';
import { KnowledgeService } from './knowledge.service';
import { IngestDocumentDto } from './dto/ingest-document.dto';
import { IngestTextDto } from './dto/ingest-text.dto';
import { IngestMarkdownDto } from './dto/ingest-markdown.dto';
import { IngestWebpageDto } from './dto/ingest-webpage.dto';
import { QueryKnowledgeDto } from './dto/query-knowledge.dto';
import { RetrieveChunksDto } from './dto/retrieve-chunks.dto';
import { KnowledgeSourceType } from '../../common/enums/knowledge-source-type.enum';
import { created, ok } from '../../common/utils/response.util';

class IngestUrlDto {
  @IsString() @IsNotEmpty() @IsUrl() url: string;
  @IsString() @IsOptional() title?: string;
  @IsArray() @IsString({ each: true }) @IsOptional() tags?: string[];
}

@Controller({ path: 'knowledge', version: '1' })
export class KnowledgeController {
  constructor(private readonly knowledgeService: KnowledgeService) {}

  // ─── New pipeline endpoints ───────────────────────────────────────────────

  @Post('sources/text')
  async ingestText(@Body() dto: IngestTextDto) {
    const result = await this.knowledgeService.ingestText(dto);
    return created(result, result.isDuplicate ? 'Duplicate — skipped' : 'Text ingested');
  }

  @Post('sources/markdown')
  async ingestMarkdown(@Body() dto: IngestMarkdownDto) {
    const result = await this.knowledgeService.ingestMarkdown(dto);
    return created(result, result.isDuplicate ? 'Duplicate — skipped' : 'Markdown ingested');
  }

  @Post('sources/webpage')
  async ingestWebpage(@Body() dto: IngestWebpageDto) {
    const result = await this.knowledgeService.ingestWebpage(dto);
    return created(result, result.isDuplicate ? 'Duplicate — skipped' : 'Webpage ingested');
  }

  /** Fetch a URL server-side, strip HTML tags, and ingest as a knowledge source. */
  @Post('sources/url')
  async ingestUrl(@Body() dto: IngestUrlDto) {
    const res = await fetch(dto.url, {
      headers: { 'User-Agent': 'BuntuCopilot/1.0 (knowledge-bot)' },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`Failed to fetch URL (${res.status}): ${dto.url}`);
    const html = await res.text();
    // Strip HTML tags to plain text
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();
    const result = await this.knowledgeService.ingestText({
      content: text,
      sourceRef: dto.url,
      title: dto.title ?? dto.url,
      sourceType: KnowledgeSourceType.WEBPAGE,
      tags: dto.tags,
    });
    return created(result, result.isDuplicate ? 'Duplicate — skipped' : 'URL ingested');
  }

  @Get('sources')
  async listSources(@Query('sourceType') sourceType?: KnowledgeSourceType) {
    const sources = await this.knowledgeService.listSources(sourceType);
    return ok(sources, 'Knowledge sources retrieved');
  }

  @Get('sources/:id')
  async getSource(@Param('id') id: string) {
    const source = await this.knowledgeService.getSource(id);
    return ok(source, 'Knowledge source retrieved');
  }

  @Delete('sources/:id')
  async deleteSource(@Param('id') id: string) {
    const result = await this.knowledgeService.deleteSource(id);
    return ok(result, 'Knowledge source deactivated');
  }

  @Get('chunks')
  async retrieveChunks(@Query() dto: RetrieveChunksDto) {
    const chunks = await this.knowledgeService.retrieveChunks(dto);
    return ok(chunks, 'Chunks retrieved');
  }

  // ─── Legacy repo-file endpoints (Phase 1/2 compatibility) ─────────────────

  @Post('ingest')
  async ingest(@Body() dto: IngestDocumentDto) {
    const result = await this.knowledgeService.ingest(dto);
    return created(result, 'Document ingested');
  }

  @Get('query')
  async query(@Query() dto: QueryKnowledgeDto) {
    const results = await this.knowledgeService.query(dto);
    return ok(results, 'Knowledge query completed');
  }

  @Delete('repos/:repoId')
  async deleteByRepo(@Param('repoId') repoId: string) {
    const result = await this.knowledgeService.deleteByRepo(repoId);
    return ok(result, 'Knowledge deleted for repo');
  }
}
