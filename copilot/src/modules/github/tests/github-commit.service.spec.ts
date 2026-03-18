import { Test, TestingModule } from '@nestjs/testing';
import { GithubCommitService } from '../github-commit.service';
import { GithubBranchService } from '../github-branch.service';
import { RequestError } from '@octokit/request-error';
import { ExternalServiceException } from '../../../common/exceptions/app.exception';
import { GitHubFileChange } from '../interfaces/github.interface';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeOctokit() {
  return {
    rest: {
      git: {
        getCommit: jest.fn(),
        createTree: jest.fn(),
        createCommit: jest.fn(),
        updateRef: jest.fn(),
      },
    },
  } as unknown as import('@octokit/rest').Octokit;
}

function makeRequestError(status: number, message: string): RequestError {
  return new RequestError(message, status, {
    request: { method: 'POST', url: 'https://api.github.com', headers: {} },
    response: {
      status,
      url: 'https://api.github.com',
      headers: {},
      data: {},
    },
  });
}

const TEST_FILES: GitHubFileChange[] = [
  { filePath: 'src/auth/auth.service.ts', content: 'export class AuthService {}' },
  { filePath: 'src/auth/auth.service.spec.ts', content: "it('passes', () => {})" },
];

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GithubCommitService', () => {
  let service: GithubCommitService;
  let branchService: jest.Mocked<GithubBranchService>;

  beforeEach(async () => {
    branchService = {
      resolveRefSha: jest.fn().mockResolvedValue('branch-tip-sha'),
      createBranch: jest.fn(),
    } as unknown as jest.Mocked<GithubBranchService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GithubCommitService,
        { provide: GithubBranchService, useValue: branchService },
      ],
    }).compile();

    service = module.get(GithubCommitService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('createCommit()', () => {
    function wireHappyPath(octokit: ReturnType<typeof makeOctokit>) {
      (octokit.rest.git.getCommit as jest.Mock).mockResolvedValue({
        data: { tree: { sha: 'base-tree-sha' } },
      });
      (octokit.rest.git.createTree as jest.Mock).mockResolvedValue({
        data: { sha: 'new-tree-sha' },
      });
      (octokit.rest.git.createCommit as jest.Mock).mockResolvedValue({
        data: { sha: 'new-commit-sha' },
      });
      (octokit.rest.git.updateRef as jest.Mock).mockResolvedValue({ data: {} });
    }

    it('executes full tree-based commit flow and returns new commit SHA', async () => {
      const octokit = makeOctokit();
      wireHappyPath(octokit);

      const sha = await service.createCommit(octokit, {
        owner: 'buntu',
        repo: 'copilot',
        branchName: 'fix/email-case',
        message: 'fix: normalise email to lower-case on login',
        files: TEST_FILES,
      });

      expect(sha).toBe('new-commit-sha');
      expect(branchService.resolveRefSha).toHaveBeenCalledWith(
        octokit, 'buntu', 'copilot', 'fix/email-case',
      );
      expect(octokit.rest.git.getCommit).toHaveBeenCalledWith({
        owner: 'buntu',
        repo: 'copilot',
        commit_sha: 'branch-tip-sha',
      });
      expect(octokit.rest.git.createTree).toHaveBeenCalledWith(
        expect.objectContaining({
          owner: 'buntu',
          repo: 'copilot',
          base_tree: 'base-tree-sha',
          tree: expect.arrayContaining([
            expect.objectContaining({ path: 'src/auth/auth.service.ts', mode: '100644' }),
            expect.objectContaining({ path: 'src/auth/auth.service.spec.ts', mode: '100644' }),
          ]),
        }),
      );
      expect(octokit.rest.git.createCommit).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'fix: normalise email to lower-case on login',
          tree: 'new-tree-sha',
          parents: ['branch-tip-sha'],
        }),
      );
      expect(octokit.rest.git.updateRef).toHaveBeenCalledWith({
        owner: 'buntu',
        repo: 'copilot',
        ref: 'heads/fix/email-case',
        sha: 'new-commit-sha',
      });
    });

    it('throws ExternalServiceException when GitHub returns an error', async () => {
      const octokit = makeOctokit();
      (octokit.rest.git.getCommit as jest.Mock).mockRejectedValue(
        makeRequestError(422, 'Unprocessable Entity'),
      );

      await expect(
        service.createCommit(octokit, {
          owner: 'buntu',
          repo: 'copilot',
          branchName: 'fix/email-case',
          message: 'fix: email',
          files: TEST_FILES,
        }),
      ).rejects.toThrow(ExternalServiceException);
    });

    it('throws ExternalServiceException when files array is empty', async () => {
      const octokit = makeOctokit();

      await expect(
        service.createCommit(octokit, {
          owner: 'buntu',
          repo: 'copilot',
          branchName: 'fix/email-case',
          message: 'empty commit',
          files: [],
        }),
      ).rejects.toThrow(ExternalServiceException);
    });

    it('propagates non-RequestError exceptions unchanged', async () => {
      const octokit = makeOctokit();
      (octokit.rest.git.getCommit as jest.Mock).mockRejectedValue(new Error('disk full'));

      await expect(
        service.createCommit(octokit, {
          owner: 'buntu',
          repo: 'copilot',
          branchName: 'fix/email-case',
          message: 'fix',
          files: TEST_FILES,
        }),
      ).rejects.toThrow('disk full');
    });
  });
});
