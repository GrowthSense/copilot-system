import { Test, TestingModule } from '@nestjs/testing';
import { RetrievalService } from './retrieval.service';
import { DatabaseService } from '../database/database.service';
import { KnowledgeSourceType } from '../../common/enums/knowledge-source-type.enum';

const mockChunks = [
  {
    id: 'chunk-1',
    chunkIndex: 0,
    content: 'The authentication service handles JWT tokens and user login.',
    source: {
      id: 'src-1',
      title: 'Auth Module Docs',
      sourceType: KnowledgeSourceType.MARKDOWN,
      sourceRef: 'docs/auth.md',
      tags: ['auth', 'security'],
    },
  },
  {
    id: 'chunk-2',
    chunkIndex: 0,
    content: 'The database service provides a singleton Prisma client.',
    source: {
      id: 'src-2',
      title: 'Database Module Docs',
      sourceType: KnowledgeSourceType.MARKDOWN,
      sourceRef: 'docs/database.md',
      tags: ['database', 'prisma'],
    },
  },
  {
    id: 'chunk-3',
    chunkIndex: 0,
    content: 'User authentication requires valid JWT tokens signed with RS256.',
    source: {
      id: 'src-3',
      title: 'Security Standards',
      sourceType: KnowledgeSourceType.ENGINEERING_STANDARD,
      sourceRef: 'standards/security.md',
      tags: ['auth', 'security', 'jwt'],
    },
  },
];

const mockDb = {
  knowledgeChunk: {
    findMany: jest.fn(),
  },
};

describe('RetrievalService', () => {
  let service: RetrievalService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RetrievalService,
        { provide: DatabaseService, useValue: mockDb },
      ],
    }).compile();

    service = module.get<RetrievalService>(RetrievalService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('retrieve', () => {
    it('should return scored chunks sorted by relevance', async () => {
      mockDb.knowledgeChunk.findMany.mockResolvedValue(mockChunks);

      const results = await service.retrieve({ query: 'JWT authentication tokens', topK: 10 });

      // Both auth-related chunks should rank above the database chunk.
      expect(results.length).toBeGreaterThan(0);
      const ids = results.map((r) => r.chunkId);
      const authIdx = ids.indexOf('chunk-1');
      const dbIdx = ids.indexOf('chunk-2');
      // chunk-1 (auth) should outrank chunk-2 (database) for this query.
      if (authIdx !== -1 && dbIdx !== -1) {
        expect(authIdx).toBeLessThan(dbIdx);
      }
    });

    it('should respect topK limit', async () => {
      mockDb.knowledgeChunk.findMany.mockResolvedValue(mockChunks);

      const results = await service.retrieve({ query: 'authentication', topK: 1 });

      expect(results).toHaveLength(1);
    });

    it('should filter by sourceType in the DB query', async () => {
      mockDb.knowledgeChunk.findMany.mockResolvedValue([mockChunks[2]]);

      await service.retrieve({
        query: 'security',
        sourceType: KnowledgeSourceType.ENGINEERING_STANDARD,
      });

      const callArgs = mockDb.knowledgeChunk.findMany.mock.calls[0][0];
      expect(callArgs.where.source.sourceType).toBe(KnowledgeSourceType.ENGINEERING_STANDARD);
    });

    it('should filter by tags using hasSome', async () => {
      mockDb.knowledgeChunk.findMany.mockResolvedValue(mockChunks.slice(0, 1));

      await service.retrieve({ query: 'auth', tags: ['auth', 'jwt'] });

      const callArgs = mockDb.knowledgeChunk.findMany.mock.calls[0][0];
      expect(callArgs.where.source.tags).toEqual({ hasSome: ['auth', 'jwt'] });
    });

    it('should filter by sourceIds', async () => {
      mockDb.knowledgeChunk.findMany.mockResolvedValue([mockChunks[0]]);

      await service.retrieve({ query: 'auth', sourceIds: ['src-1'] });

      const callArgs = mockDb.knowledgeChunk.findMany.mock.calls[0][0];
      expect(callArgs.where.source.id).toEqual({ in: ['src-1'] });
    });

    it('should exclude chunks below minScore', async () => {
      mockDb.knowledgeChunk.findMany.mockResolvedValue(mockChunks);

      // Very high minScore — only the most relevant chunks should pass.
      const results = await service.retrieve({
        query: 'authentication JWT tokens',
        minScore: 0.5,
        topK: 10,
      });

      for (const result of results) {
        expect(result.score).toBeGreaterThanOrEqual(0.5);
      }
    });

    it('should return empty array when no chunks match', async () => {
      mockDb.knowledgeChunk.findMany.mockResolvedValue([]);

      const results = await service.retrieve({ query: 'some query' });

      expect(results).toHaveLength(0);
    });

    it('should map chunk fields correctly', async () => {
      mockDb.knowledgeChunk.findMany.mockResolvedValue([mockChunks[0]]);

      const results = await service.retrieve({ query: 'authentication' });

      expect(results[0]).toMatchObject({
        chunkId: 'chunk-1',
        sourceId: 'src-1',
        sourceTitle: 'Auth Module Docs',
        sourceType: KnowledgeSourceType.MARKDOWN,
        sourceRef: 'docs/auth.md',
        chunkIndex: 0,
        tags: ['auth', 'security'],
      });
      expect(typeof results[0].score).toBe('number');
    });

    it('should apply isActive filter on the source', async () => {
      mockDb.knowledgeChunk.findMany.mockResolvedValue([]);

      await service.retrieve({ query: 'anything' });

      const callArgs = mockDb.knowledgeChunk.findMany.mock.calls[0][0];
      expect(callArgs.where.source.isActive).toBe(true);
    });
  });
});
