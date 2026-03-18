import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { KnowledgeService } from './knowledge.service';
import { DatabaseService } from '../database/database.service';
import { IngestionService } from './ingestion.service';
import { RetrievalService } from './retrieval.service';
import { KnowledgeSourceType } from '../../common/enums/knowledge-source-type.enum';

const mockDb = {
  knowledgeDocument: {
    upsert: jest.fn(),
    findMany: jest.fn(),
    deleteMany: jest.fn(),
  },
  knowledgeSource: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
};

const mockIngestion = {
  ingestText: jest.fn(),
  ingestMarkdown: jest.fn(),
  ingestHtml: jest.fn(),
};

const mockRetrieval = {
  retrieve: jest.fn(),
};

describe('KnowledgeService', () => {
  let service: KnowledgeService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KnowledgeService,
        { provide: DatabaseService, useValue: mockDb },
        { provide: IngestionService, useValue: mockIngestion },
        { provide: RetrievalService, useValue: mockRetrieval },
      ],
    }).compile();

    service = module.get<KnowledgeService>(KnowledgeService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─── New pipeline methods ────────────────────────────────────────────────

  describe('ingestText', () => {
    it('should delegate to IngestionService.ingestText', async () => {
      const expected = {
        sourceId: 'src-1',
        title: 'Test',
        sourceType: KnowledgeSourceType.PLAIN_TEXT,
        chunksCreated: 3,
        isDuplicate: false,
        checksum: 'abc',
      };
      mockIngestion.ingestText.mockResolvedValue(expected);

      const result = await service.ingestText({
        content: 'hello',
        sourceRef: 'docs/test.txt',
        tags: ['test'],
      });

      expect(result).toEqual(expected);
      expect(mockIngestion.ingestText).toHaveBeenCalledWith('hello', {
        sourceRef: 'docs/test.txt',
        sourceType: KnowledgeSourceType.PLAIN_TEXT,
        title: undefined,
        tags: ['test'],
        metadata: undefined,
      });
    });
  });

  describe('ingestMarkdown', () => {
    it('should delegate to IngestionService.ingestMarkdown', async () => {
      const expected = {
        sourceId: 'src-2',
        title: 'Readme',
        sourceType: KnowledgeSourceType.MARKDOWN,
        chunksCreated: 5,
        isDuplicate: false,
        checksum: 'def',
      };
      mockIngestion.ingestMarkdown.mockResolvedValue(expected);

      const result = await service.ingestMarkdown({
        content: '# Hello',
        sourceRef: 'README.md',
      });

      expect(result).toEqual(expected);
      expect(mockIngestion.ingestMarkdown).toHaveBeenCalledWith('# Hello', {
        sourceRef: 'README.md',
        sourceType: KnowledgeSourceType.MARKDOWN,
        title: undefined,
        tags: undefined,
        metadata: undefined,
      });
    });
  });

  describe('ingestWebpage', () => {
    it('should delegate to IngestionService.ingestHtml with WEBPAGE type', async () => {
      const expected = {
        sourceId: 'src-3',
        title: 'Example',
        sourceType: KnowledgeSourceType.WEBPAGE,
        chunksCreated: 2,
        isDuplicate: false,
        checksum: 'ghi',
      };
      mockIngestion.ingestHtml.mockResolvedValue(expected);

      const result = await service.ingestWebpage({
        html: '<html><body>Hello</body></html>',
        url: 'https://example.com',
      });

      expect(result).toEqual(expected);
      expect(mockIngestion.ingestHtml).toHaveBeenCalledWith(
        '<html><body>Hello</body></html>',
        expect.objectContaining({
          sourceRef: 'https://example.com',
          sourceType: KnowledgeSourceType.WEBPAGE,
        }),
      );
    });
  });

  describe('retrieveChunks', () => {
    it('should delegate to RetrievalService.retrieve', async () => {
      const mockChunks = [
        {
          chunkId: 'c-1',
          sourceId: 'src-1',
          sourceTitle: 'Docs',
          sourceType: KnowledgeSourceType.MARKDOWN,
          sourceRef: 'docs/auth.md',
          chunkIndex: 0,
          content: 'auth content',
          score: 0.8,
          tags: ['auth'],
        },
      ];
      mockRetrieval.retrieve.mockResolvedValue(mockChunks);

      const result = await service.retrieveChunks({
        query: 'authentication',
        topK: 5,
        tags: ['auth'],
      });

      expect(result).toEqual(mockChunks);
      expect(mockRetrieval.retrieve).toHaveBeenCalledWith({
        query: 'authentication',
        topK: 5,
        sourceType: undefined,
        tags: ['auth'],
        sourceIds: undefined,
        minScore: undefined,
      });
    });
  });

  describe('listSources', () => {
    it('should return mapped sources with chunk count', async () => {
      const mockSources = [
        {
          id: 'src-1',
          title: 'Auth Docs',
          sourceType: KnowledgeSourceType.MARKDOWN,
          sourceRef: 'docs/auth.md',
          tags: ['auth'],
          wordCount: 500,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          _count: { chunks: 4 },
        },
      ];
      mockDb.knowledgeSource.findMany.mockResolvedValue(mockSources);

      const result = await service.listSources();

      expect(result).toHaveLength(1);
      expect(result[0].chunkCount).toBe(4);
      expect(result[0].id).toBe('src-1');
    });

    it('should filter by sourceType when provided', async () => {
      mockDb.knowledgeSource.findMany.mockResolvedValue([]);

      await service.listSources(KnowledgeSourceType.ENGINEERING_STANDARD);

      expect(mockDb.knowledgeSource.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ sourceType: KnowledgeSourceType.ENGINEERING_STANDARD }),
        }),
      );
    });
  });

  describe('getSource', () => {
    it('should return source when found', async () => {
      const mockSource = {
        id: 'src-1',
        title: 'Auth Docs',
        sourceType: KnowledgeSourceType.MARKDOWN,
        sourceRef: 'docs/auth.md',
        tags: ['auth'],
        wordCount: 500,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        _count: { chunks: 2 },
      };
      mockDb.knowledgeSource.findUnique.mockResolvedValue(mockSource);

      const result = await service.getSource('src-1');

      expect(result.id).toBe('src-1');
      expect(result.chunkCount).toBe(2);
    });

    it('should throw NotFoundException when source not found', async () => {
      mockDb.knowledgeSource.findUnique.mockResolvedValue(null);

      await expect(service.getSource('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteSource', () => {
    it('should soft-delete by setting isActive=false', async () => {
      const mockSource = {
        id: 'src-1',
        title: 'Auth Docs',
        sourceType: KnowledgeSourceType.MARKDOWN,
        sourceRef: 'docs/auth.md',
        tags: [],
        wordCount: 0,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        _count: { chunks: 1 },
      };
      mockDb.knowledgeSource.findUnique.mockResolvedValue(mockSource);
      mockDb.knowledgeSource.update.mockResolvedValue({ id: 'src-1' });

      const result = await service.deleteSource('src-1');

      expect(result.id).toBe('src-1');
      expect(mockDb.knowledgeSource.update).toHaveBeenCalledWith({
        where: { id: 'src-1' },
        data: { isActive: false },
      });
    });
  });

  // ─── Legacy repo-file methods ────────────────────────────────────────────

  describe('ingest (legacy)', () => {
    it('should upsert a document and return id and filePath', async () => {
      const dto = {
        repoId: 'repo-1',
        filePath: 'src/auth.ts',
        content: 'export class AuthService {}',
      };
      const mockDoc = { id: 'doc-1', filePath: 'src/auth.ts' };
      mockDb.knowledgeDocument.upsert.mockResolvedValue(mockDoc);

      const result = await service.ingest(dto);
      expect(result.id).toBe('doc-1');
      expect(result.filePath).toBe('src/auth.ts');
    });

    it('should compute a sha256 content hash', async () => {
      const dto = { repoId: 'repo-1', filePath: 'src/main.ts', content: 'bootstrap()' };
      mockDb.knowledgeDocument.upsert.mockResolvedValue({ id: 'doc-2', filePath: 'src/main.ts' });

      await service.ingest(dto);

      const callArgs = mockDb.knowledgeDocument.upsert.mock.calls[0][0];
      expect(callArgs.create.contentHash).toHaveLength(64);
    });
  });

  describe('query (legacy)', () => {
    it('should fall back to knowledgeDocument for plain repo queries', async () => {
      const mockDocs = [
        {
          id: 'doc-1',
          filePath: 'src/auth.ts',
          content: 'export class AuthService {}',
          createdAt: new Date(),
        },
      ];
      mockDb.knowledgeDocument.findMany.mockResolvedValue(mockDocs);

      const result = await service.query({ query: 'auth service', topK: 5 });

      expect(result).toHaveLength(1);
      expect(result[0].score).toBe(1.0);
    });

    it('should delegate to retrieval when sourceType is provided', async () => {
      mockRetrieval.retrieve.mockResolvedValue([]);

      await service.query({
        query: 'auth',
        sourceType: KnowledgeSourceType.MARKDOWN,
        topK: 5,
      });

      expect(mockRetrieval.retrieve).toHaveBeenCalled();
      expect(mockDb.knowledgeDocument.findMany).not.toHaveBeenCalled();
    });
  });

  describe('deleteByRepo (legacy)', () => {
    it('should return count of deleted documents', async () => {
      mockDb.knowledgeDocument.deleteMany.mockResolvedValue({ count: 3 });
      const result = await service.deleteByRepo('repo-1');
      expect(result.count).toBe(3);
    });
  });
});
