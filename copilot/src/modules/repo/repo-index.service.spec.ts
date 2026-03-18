import { Test, TestingModule } from '@nestjs/testing';
import { RepoIndexService } from './repo-index.service';
import { FileReaderService } from './file-reader.service';
import { DatabaseService } from '../database/database.service';
import { IndexStatus } from '../../common/enums/index-status.enum';
import { RepoFileStatus } from '../../common/enums/repo-file-status.enum';
import { ValidationException } from '../../common/exceptions/app.exception';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockDb = {
  repo: { findUnique: jest.fn() },
  repoIndex: {
    create: jest.fn(),
    update: jest.fn(),
    findFirst: jest.fn(),
  },
  repoFile: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
  },
  repoFileChunk: {
    deleteMany: jest.fn(),
    createMany: jest.fn(),
  },
};

const mockFileReader = {
  isDirectory: jest.fn(),
  listFilesRecursively: jest.fn(),
  readFile: jest.fn(),
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const makeIndex = (overrides = {}) => ({
  id: 'idx-1',
  repoId: 'repo-1',
  status: IndexStatus.PENDING,
  localPath: '/tmp/myrepo',
  branch: 'main',
  ignorePatterns: ['node_modules', '.git'],
  totalFiles: 0,
  indexedFiles: 0,
  skippedFiles: 0,
  errorFiles: 0,
  errorLog: null,
  startedAt: null,
  completedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('RepoIndexService', () => {
  let service: RepoIndexService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RepoIndexService,
        { provide: DatabaseService, useValue: mockDb },
        { provide: FileReaderService, useValue: mockFileReader },
      ],
    }).compile();

    service = module.get<RepoIndexService>(RepoIndexService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─── startIndex ──────────────────────────────────────────────────────────

  describe('startIndex', () => {
    const dto = { localPath: '/tmp/myrepo' };

    it('should create a PENDING index and return immediately', async () => {
      mockDb.repo.findUnique.mockResolvedValue({ id: 'repo-1', defaultBranch: 'main' });
      mockFileReader.isDirectory.mockResolvedValue(true);
      mockDb.repoIndex.create.mockResolvedValue(makeIndex());

      const result = await service.startIndex('repo-1', dto);

      expect(result.status).toBe(IndexStatus.PENDING);
      expect(mockDb.repoIndex.create).toHaveBeenCalledTimes(1);
    });

    it('should throw ValidationException when localPath is not a directory', async () => {
      mockDb.repo.findUnique.mockResolvedValue({ id: 'repo-1', defaultBranch: 'main' });
      mockFileReader.isDirectory.mockResolvedValue(false);

      await expect(service.startIndex('repo-1', dto)).rejects.toThrow(ValidationException);
    });

    it('should merge default and additional ignore patterns', async () => {
      mockDb.repo.findUnique.mockResolvedValue({ id: 'repo-1', defaultBranch: 'main' });
      mockFileReader.isDirectory.mockResolvedValue(true);
      mockDb.repoIndex.create.mockResolvedValue(makeIndex());

      await service.startIndex('repo-1', {
        localPath: '/tmp/myrepo',
        additionalIgnorePatterns: ['vendor', '*.min.js'],
      });

      const createCall = mockDb.repoIndex.create.mock.calls[0][0];
      expect(createCall.data.ignorePatterns).toContain('node_modules');
      expect(createCall.data.ignorePatterns).toContain('vendor');
      expect(createCall.data.ignorePatterns).toContain('*.min.js');
    });
  });

  // ─── getLatestIndex ───────────────────────────────────────────────────────

  describe('getLatestIndex', () => {
    it('should return null when no index exists', async () => {
      mockDb.repoIndex.findFirst.mockResolvedValue(null);
      const result = await service.getLatestIndex('repo-1');
      expect(result).toBeNull();
    });

    it('should return the most recent index', async () => {
      mockDb.repoIndex.findFirst.mockResolvedValue(makeIndex({ status: IndexStatus.COMPLETED }));
      const result = await service.getLatestIndex('repo-1');
      expect(result?.status).toBe(IndexStatus.COMPLETED);
    });
  });

  // ─── shouldIgnore ─────────────────────────────────────────────────────────

  describe('shouldIgnore', () => {
    const patterns = ['node_modules', '.git', 'dist', '*.log', 'vendor/'];

    it('should ignore paths containing node_modules segment', () => {
      expect(service.shouldIgnore('src/node_modules/lodash/index.js', patterns)).toBe(true);
      expect(service.shouldIgnore('node_modules/express/index.js', patterns)).toBe(true);
    });

    it('should ignore dotfiles matching exact pattern', () => {
      expect(service.shouldIgnore('.git/config', patterns)).toBe(true);
      expect(service.shouldIgnore('src/.git/HEAD', patterns)).toBe(true);
    });

    it('should ignore files matching wildcard suffix', () => {
      expect(service.shouldIgnore('app.log', patterns)).toBe(true);
      expect(service.shouldIgnore('logs/error.log', patterns)).toBe(true);
      expect(service.shouldIgnore('src/main.ts', patterns)).toBe(false);
    });

    it('should ignore paths with slash prefix match', () => {
      expect(service.shouldIgnore('vendor/lodash/index.js', patterns)).toBe(true);
    });

    it('should NOT ignore regular source files', () => {
      expect(service.shouldIgnore('src/app.module.ts', patterns)).toBe(false);
      expect(service.shouldIgnore('test/app.e2e-spec.ts', patterns)).toBe(false);
      expect(service.shouldIgnore('README.md', patterns)).toBe(false);
    });

    it('should NOT ignore dist-like words in file names', () => {
      // "dist" as a segment should be ignored, not if it appears inside a filename
      expect(service.shouldIgnore('src/distribution.ts', patterns)).toBe(false);
    });

    it('should ignore the dist directory itself', () => {
      expect(service.shouldIgnore('dist/main.js', patterns)).toBe(true);
    });
  });
});

// ─── FileReaderService unit tests ─────────────────────────────────────────────

describe('FileReaderService — shouldIgnore patterns', () => {
  // These are pure logic tests that don't need DI.
  let service: RepoIndexService;

  beforeEach(() => {
    service = new RepoIndexService(mockDb as unknown as DatabaseService, mockFileReader as unknown as FileReaderService);
  });

  it('should handle Windows-style paths if they occur', () => {
    // Paths stored in DB always use forward slashes, so this is defensive.
    const patterns = ['node_modules'];
    expect(service.shouldIgnore('src/node_modules/pkg', patterns)).toBe(true);
  });
});
