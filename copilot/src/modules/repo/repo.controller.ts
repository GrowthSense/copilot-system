import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { RepoService } from './repo.service';
import { RepoIndexService } from './repo-index.service';
import { RepoSearchService } from './repo-search.service';
import { RepoMapService } from './repo-map.service';
import { RegisterRepoDto } from './dto/register-repo.dto';
import { UpdateRepoDto } from './dto/update-repo.dto';
import { IndexRepoDto } from './dto/index-repo.dto';
import { SearchFilesDto } from './dto/search-files.dto';
import { FindCandidatesDto } from './dto/find-candidates.dto';
import { created, ok } from '../../common/utils/response.util';

@Controller({ path: 'repos', version: '1' })
export class RepoController {
  constructor(
    private readonly repoService: RepoService,
    private readonly repoIndexService: RepoIndexService,
    private readonly repoSearchService: RepoSearchService,
    private readonly repoMapService: RepoMapService,
  ) {}

  // ─── Repo CRUD ────────────────────────────────────────────────────────────

  @Post()
  async register(@Body() dto: RegisterRepoDto) {
    const repo = await this.repoService.register(dto);
    return created(repo, 'Repo registered');
  }

  @Get()
  async findAll() {
    const repos = await this.repoService.findAll();
    return ok(repos, 'Repos retrieved');
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const repo = await this.repoService.findOne(id);
    return ok(repo, 'Repo retrieved');
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateRepoDto) {
    const repo = await this.repoService.update(id, dto);
    return ok(repo, 'Repo updated');
  }

  @Delete(':id')
  async deactivate(@Param('id') id: string) {
    const repo = await this.repoService.deactivate(id);
    return ok(repo, 'Repo deactivated');
  }

  // ─── Indexing ──────────────────────────────────────────────────────────────

  /**
   * Starts a background indexing run for the repo.
   * Returns immediately with a PENDING index record.
   * Poll GET :id/indexes/latest or GET :id/indexes/:indexId for status.
   */
  @Post(':id/indexes')
  async startIndex(@Param('id') id: string, @Body() dto: IndexRepoDto) {
    const index = await this.repoIndexService.startIndex(id, dto);
    return created(index, 'Indexing started');
  }

  @Get(':id/indexes/latest')
  async getLatestIndex(@Param('id') id: string) {
    const index = await this.repoIndexService.getLatestIndex(id);
    return ok(index, 'Latest index retrieved');
  }

  @Get(':id/indexes/:indexId')
  async getIndex(@Param('id') id: string, @Param('indexId') indexId: string) {
    const index = await this.repoIndexService.getIndex(id, indexId);
    return ok(index, 'Index retrieved');
  }

  // ─── File listing and reading ─────────────────────────────────────────────

  @Get(':id/files')
  async listFiles(
    @Param('id') id: string,
    @Query('language') language?: string,
    @Query('extension') extension?: string,
  ) {
    const files = await this.repoService.listFiles(id, { language, extension });
    return ok(files, 'Files retrieved');
  }

  @Get(':id/files/:fileId')
  async getFileMetadata(@Param('id') id: string, @Param('fileId') fileId: string) {
    const file = await this.repoService.getFileMetadata(id, fileId);
    return ok(file, 'File metadata retrieved');
  }

  /** Returns the full, live on-disk content of a text file. */
  @Get(':id/files/:fileId/content')
  async readFileContent(@Param('id') id: string, @Param('fileId') fileId: string) {
    const file = await this.repoService.readFileContent(id, fileId);
    return ok(file, 'File content retrieved');
  }

  /** Returns the live content of a file by its relative path. ?path=src/foo.ts */
  @Get(':id/file-content')
  async readFileByPath(@Param('id') id: string, @Query('path') filePath: string) {
    const file = await this.repoService.readFileByPath(id, filePath);
    return ok(file, 'File content retrieved');
  }

  // ─── Search ───────────────────────────────────────────────────────────────

  /**
   * Search indexed files by filename, path fragment, keyword, or all at once.
   * ?query=auth&mode=filename|path|keyword|all&topK=20
   */
  @Get(':id/search')
  async searchFiles(@Param('id') id: string, @Query() dto: SearchFilesDto) {
    const results = await this.repoSearchService.search(id, dto);
    return ok(results, 'Search results retrieved');
  }

  /**
   * Returns top candidate files for a natural language query.
   * Uses keyword heuristics now; pgvector upgrade path is in RepoSearchService.
   * ?query=where+is+JWT+validation&topK=10
   */
  @Get(':id/candidates')
  async findCandidates(@Param('id') id: string, @Query() dto: FindCandidatesDto) {
    const results = await this.repoMapService.getCandidatesForQuery(id, dto);
    return ok(results, 'Candidate files retrieved');
  }

  // ─── Repo map ─────────────────────────────────────────────────────────────

  @Get(':id/tree')
  async getDirectoryTree(@Param('id') id: string) {
    const tree = await this.repoMapService.getDirectoryTree(id);
    return ok(tree, 'Directory tree retrieved');
  }

  @Get(':id/languages')
  async getFilesByLanguage(@Param('id') id: string) {
    const languages = await this.repoMapService.getFilesByLanguage(id);
    return ok(languages, 'Files by language retrieved');
  }

  @Get(':id/summary')
  async getIndexSummary(@Param('id') id: string) {
    const summary = await this.repoMapService.getIndexSummary(id);
    return ok(summary, 'Index summary retrieved');
  }
}
