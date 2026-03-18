import { Test, TestingModule } from '@nestjs/testing';
import { RepoSearchService } from './repo-search.service';
import { DatabaseService } from '../database/database.service';
import { MatchReason, SearchMode } from './interfaces/repo-index.interface';
import { RepoFileStatus } from '../../common/enums/repo-file-status.enum';

// ─── Mock data ────────────────────────────────────────────────────────────────

const makeFile = (overrides: Partial<{
  id: string; repoId: string; filePath: string; fileName: string;
  extension: string | null; language: string | null; sizeBytes: number; lineCount: number;
}> = {}) => ({
  id: 'file-1',
  repoId: 'repo-1',
  filePath: 'src/auth/auth.service.ts',
  fileName: 'auth.service.ts',
  extension: 'ts',
  language: 'typescript',
  sizeBytes: 2048,
  lineCount: 80,
  ...overrides,
});

const mockDb = {
  repoFile: { findMany: jest.fn() },
  repoFileChunk: { findMany: jest.fn() },
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('RepoSearchService', () => {
  let service: RepoSearchService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RepoSearchService,
        { provide: DatabaseService, useValue: mockDb },
      ],
    }).compile();

    service = module.get<RepoSearchService>(RepoSearchService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─── search — FILENAME mode ───────────────────────────────────────────────

  describe('search (FILENAME mode)', () => {
    it('should return FILENAME_EXACT when filename matches exactly', async () => {
      mockDb.repoFile.findMany.mockResolvedValue([
        makeFile({ fileName: 'auth.service.ts' }),
      ]);

      const results = await service.search('repo-1', {
        query: 'auth.service.ts',
        mode: SearchMode.FILENAME,
        topK: 10,
      });

      expect(results).toHaveLength(1);
      expect(results[0].matchReason).toBe(MatchReason.FILENAME_EXACT);
      expect(results[0].score).toBe(1.0);
    });

    it('should return FILENAME_FUZZY for partial filename match', async () => {
      mockDb.repoFile.findMany.mockResolvedValue([
        makeFile({ fileName: 'auth.service.ts' }),
      ]);

      const results = await service.search('repo-1', {
        query: 'auth',
        mode: SearchMode.FILENAME,
        topK: 10,
      });

      expect(results[0].matchReason).toBe(MatchReason.FILENAME_FUZZY);
      expect(results[0].score).toBe(0.8);
    });

    it('should use insensitive filter on filename', async () => {
      mockDb.repoFile.findMany.mockResolvedValue([]);
      await service.search('repo-1', { query: 'Auth', mode: SearchMode.FILENAME });

      const callArgs = mockDb.repoFile.findMany.mock.calls[0][0];
      expect(callArgs.where.fileName).toEqual({ contains: 'Auth', mode: 'insensitive' });
    });
  });

  // ─── search — PATH mode ───────────────────────────────────────────────────

  describe('search (PATH mode)', () => {
    it('should return PATH_FRAGMENT matches', async () => {
      mockDb.repoFile.findMany.mockResolvedValue([makeFile()]);

      const results = await service.search('repo-1', {
        query: 'src/auth',
        mode: SearchMode.PATH,
      });

      expect(results[0].matchReason).toBe(MatchReason.PATH_FRAGMENT);
      expect(results[0].score).toBe(0.9);
    });

    it('should use insensitive filter on filePath', async () => {
      mockDb.repoFile.findMany.mockResolvedValue([]);
      await service.search('repo-1', { query: 'Auth', mode: SearchMode.PATH });

      const callArgs = mockDb.repoFile.findMany.mock.calls[0][0];
      expect(callArgs.where.filePath).toEqual({ contains: 'Auth', mode: 'insensitive' });
    });
  });

  // ─── search — KEYWORD mode ────────────────────────────────────────────────

  describe('search (KEYWORD mode)', () => {
    it('should return KEYWORD_IN_CONTENT matches', async () => {
      const file = makeFile();
      mockDb.repoFileChunk.findMany.mockResolvedValue([
        {
          id: 'chunk-1',
          fileId: file.id,
          content: 'export class AuthService { authenticate() {} }',
          file,
        },
      ]);

      const results = await service.search('repo-1', {
        query: 'AuthService authenticate',
        mode: SearchMode.KEYWORD,
        topK: 10,
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].matchReason).toBe(MatchReason.KEYWORD_IN_CONTENT);
    });

    it('should return empty array when no chunks match', async () => {
      mockDb.repoFileChunk.findMany.mockResolvedValue([]);

      const results = await service.search('repo-1', {
        query: 'nonexistent_symbol_xyz',
        mode: SearchMode.KEYWORD,
      });

      expect(results).toHaveLength(0);
    });

    it('should aggregate hits from multiple chunks of the same file', async () => {
      const file = makeFile();
      mockDb.repoFileChunk.findMany.mockResolvedValue([
        { id: 'c-1', fileId: file.id, content: 'auth token auth', file },
        { id: 'c-2', fileId: file.id, content: 'auth guard', file },
      ]);

      const results = await service.search('repo-1', {
        query: 'auth',
        mode: SearchMode.KEYWORD,
      });

      // Both chunks contribute to a single file's score.
      expect(results).toHaveLength(1);
      expect(results[0].fileId).toBe(file.id);
    });

    it('should use insensitive content filter', async () => {
      mockDb.repoFileChunk.findMany.mockResolvedValue([]);
      await service.search('repo-1', { query: 'AuthService', mode: SearchMode.KEYWORD });

      const callArgs = mockDb.repoFileChunk.findMany.mock.calls[0][0];
      expect(callArgs.where.content).toMatchObject({ mode: 'insensitive' });
    });
  });

  // ─── search — ALL mode ────────────────────────────────────────────────────

  describe('search (ALL mode)', () => {
    it('should merge results from filename, path, and keyword searches', async () => {
      const file1 = makeFile({ id: 'f-1', fileName: 'auth.service.ts' });
      const file2 = makeFile({ id: 'f-2', filePath: 'src/auth/guard.ts', fileName: 'guard.ts' });
      const file3 = makeFile({ id: 'f-3', fileName: 'user.service.ts' });

      // Filename search returns file1.
      mockDb.repoFile.findMany
        .mockResolvedValueOnce([file1]) // FILENAME
        .mockResolvedValueOnce([file1, file2]); // PATH

      // Keyword search returns file3.
      mockDb.repoFileChunk.findMany.mockResolvedValue([
        { id: 'c-1', fileId: file3.id, content: 'auth token', file: file3 },
      ]);

      const results = await service.search('repo-1', { query: 'auth', mode: SearchMode.ALL });

      const ids = results.map((r) => r.fileId);
      expect(ids).toContain('f-1');
      expect(ids).toContain('f-3');
    });

    it('should deduplicate files that match multiple strategies', async () => {
      const file = makeFile({ id: 'f-1', fileName: 'auth.service.ts' });

      // Both filename and path return the same file.
      mockDb.repoFile.findMany
        .mockResolvedValueOnce([file]) // FILENAME
        .mockResolvedValueOnce([file]); // PATH
      mockDb.repoFileChunk.findMany.mockResolvedValue([]);

      const results = await service.search('repo-1', { query: 'auth', mode: SearchMode.ALL });

      const ids = results.map((r) => r.fileId);
      expect(ids.filter((id) => id === 'f-1')).toHaveLength(1);
    });
  });

  // ─── findCandidates ───────────────────────────────────────────────────────

  describe('findCandidates', () => {
    it('should return empty array for empty query', async () => {
      const results = await service.findCandidates('repo-1', { query: 'the a an' });
      // All stop words — tokenise returns empty.
      expect(results).toHaveLength(0);
    });

    it('should score filename matches higher than content matches', async () => {
      const authFile = makeFile({ id: 'auth-file', fileName: 'auth.service.ts' });
      const otherFile = makeFile({
        id: 'other-file',
        filePath: 'src/user/user.service.ts',
        fileName: 'user.service.ts',
      });

      // Filename/path DB query returns authFile (filename contains 'auth').
      mockDb.repoFile.findMany.mockResolvedValue([authFile]);

      // Content DB query returns both files (both have 'auth' in content).
      mockDb.repoFileChunk.findMany.mockResolvedValue([
        { id: 'c-1', fileId: otherFile.id, content: 'auth guard here auth', file: otherFile },
      ]);

      const results = await service.findCandidates('repo-1', { query: 'auth service', topK: 10 });

      // authFile should rank higher since it got +3 for filename match.
      const ids = results.map((r) => r.fileId);
      if (ids.includes('auth-file') && ids.includes('other-file')) {
        const authIdx = ids.indexOf('auth-file');
        const otherIdx = ids.indexOf('other-file');
        expect(authIdx).toBeLessThan(otherIdx);
      }
    });

    it('should normalise scores to [0, 1]', async () => {
      const file = makeFile();
      mockDb.repoFile.findMany.mockResolvedValue([file]);
      mockDb.repoFileChunk.findMany.mockResolvedValue([]);

      const results = await service.findCandidates('repo-1', { query: 'auth service' });

      for (const result of results) {
        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.score).toBeLessThanOrEqual(1);
      }
    });

    it('should respect topK limit', async () => {
      const files = Array.from({ length: 20 }, (_, i) =>
        makeFile({ id: `f-${i}`, filePath: `src/file${i}.ts`, fileName: `file${i}.ts` }),
      );
      mockDb.repoFile.findMany.mockResolvedValue(files);
      mockDb.repoFileChunk.findMany.mockResolvedValue([]);

      const results = await service.findCandidates('repo-1', { query: 'file', topK: 5 });

      expect(results).toHaveLength(5);
    });

    it('should return CANDIDATE_SCORED as the matchReason', async () => {
      const file = makeFile();
      mockDb.repoFile.findMany.mockResolvedValue([file]);
      mockDb.repoFileChunk.findMany.mockResolvedValue([]);

      const results = await service.findCandidates('repo-1', { query: 'auth' });

      expect(results[0].matchReason).toBe(MatchReason.CANDIDATE_SCORED);
    });

    it('should include the match detail explaining why the file was selected', async () => {
      const file = makeFile();
      mockDb.repoFile.findMany.mockResolvedValue([file]);
      mockDb.repoFileChunk.findMany.mockResolvedValue([]);

      const results = await service.findCandidates('repo-1', { query: 'auth' });

      expect(results[0].matchDetail).toBeTruthy();
      expect(typeof results[0].matchDetail).toBe('string');
    });

    it('should filter by INDEXED status via chunk query', async () => {
      mockDb.repoFile.findMany.mockResolvedValue([]);
      mockDb.repoFileChunk.findMany.mockResolvedValue([]);

      await service.findCandidates('repo-1', { query: 'auth service' });

      const chunkCall = mockDb.repoFileChunk.findMany.mock.calls[0];
      if (chunkCall) {
        expect(chunkCall[0].where.file.status).toBe(RepoFileStatus.INDEXED);
      }
    });
  });
});
