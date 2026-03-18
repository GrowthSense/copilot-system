import { Test, TestingModule } from '@nestjs/testing';
import { RepoService } from './repo.service';
import { DatabaseService } from '../database/database.service';
import {
  ConflictException,
  ResourceNotFoundException,
} from '../../common/exceptions/app.exception';

const mockDb = {
  repo: {
    findUnique: jest.fn(),
    create: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
};

describe('RepoService', () => {
  let service: RepoService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RepoService,
        { provide: DatabaseService, useValue: mockDb },
      ],
    }).compile();

    service = module.get<RepoService>(RepoService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    const dto = {
      name: 'api',
      fullName: 'buntu/api',
      cloneUrl: 'https://github.com/buntu/api.git',
    };

    it('should register a new repo', async () => {
      mockDb.repo.findUnique.mockResolvedValue(null);
      const mockRepo = {
        id: 'repo-1',
        name: 'api',
        fullName: 'buntu/api',
        cloneUrl: 'https://github.com/buntu/api.git',
        defaultBranch: 'main',
        description: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockDb.repo.create.mockResolvedValue(mockRepo);

      const result = await service.register(dto);
      expect(result.id).toBe('repo-1');
      expect(result.fullName).toBe('buntu/api');
    });

    it('should throw ConflictException if repo already exists', async () => {
      mockDb.repo.findUnique.mockResolvedValue({ id: 'existing', fullName: 'buntu/api' });
      await expect(service.register(dto)).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('should return only active repos', async () => {
      const mockRepos = [
        {
          id: 'repo-1',
          name: 'api',
          fullName: 'buntu/api',
          cloneUrl: 'https://github.com/buntu/api.git',
          defaultBranch: 'main',
          description: null,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      mockDb.repo.findMany.mockResolvedValue(mockRepos);

      const result = await service.findAll();
      expect(result).toHaveLength(1);
      expect(mockDb.repo.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isActive: true } }),
      );
    });
  });

  describe('findOne', () => {
    it('should return repo when found', async () => {
      const mockRepo = {
        id: 'repo-1',
        name: 'api',
        fullName: 'buntu/api',
        cloneUrl: 'https://github.com/buntu/api.git',
        defaultBranch: 'main',
        description: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockDb.repo.findUnique.mockResolvedValue(mockRepo);

      const result = await service.findOne('repo-1');
      expect(result.id).toBe('repo-1');
    });

    it('should throw ResourceNotFoundException when repo not found', async () => {
      mockDb.repo.findUnique.mockResolvedValue(null);
      await expect(service.findOne('bad-id')).rejects.toThrow(ResourceNotFoundException);
    });
  });

  describe('deactivate', () => {
    it('should set isActive to false', async () => {
      const mockRepo = {
        id: 'repo-1',
        name: 'api',
        fullName: 'buntu/api',
        cloneUrl: 'https://github.com/buntu/api.git',
        defaultBranch: 'main',
        description: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const deactivated = { ...mockRepo, isActive: false };
      mockDb.repo.findUnique.mockResolvedValue(mockRepo);
      mockDb.repo.update.mockResolvedValue(deactivated);

      const result = await service.deactivate('repo-1');
      expect(result.isActive).toBe(false);
    });

    it('should throw ResourceNotFoundException when repo not found', async () => {
      mockDb.repo.findUnique.mockResolvedValue(null);
      await expect(service.deactivate('bad-id')).rejects.toThrow(ResourceNotFoundException);
    });
  });
});
