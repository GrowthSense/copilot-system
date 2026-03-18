import { Test, TestingModule } from '@nestjs/testing';
import { GithubBranchService } from '../github-branch.service';
import { RequestError } from '@octokit/request-error';
import { ExternalServiceException, ValidationException } from '../../../common/exceptions/app.exception';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeOctokit(overrides: Partial<ReturnType<typeof makeOctokit>> = {}) {
  return {
    rest: {
      git: {
        getRef: jest.fn(),
        createRef: jest.fn(),
      },
    },
    ...overrides,
  } as unknown as import('@octokit/rest').Octokit;
}

function makeRequestError(status: number, message: string): RequestError {
  return new RequestError(message, status, {
    request: { method: 'GET', url: 'https://api.github.com', headers: {} },
    response: {
      status,
      url: 'https://api.github.com',
      headers: {},
      data: {},
    },
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GithubBranchService', () => {
  let service: GithubBranchService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GithubBranchService],
    }).compile();
    service = module.get(GithubBranchService);
  });

  afterEach(() => jest.clearAllMocks());

  // ─── resolveRefSha() ──────────────────────────────────────────────────────

  describe('resolveRefSha()', () => {
    it('returns the commit SHA for an existing branch', async () => {
      const octokit = makeOctokit();
      (octokit.rest.git.getRef as jest.Mock).mockResolvedValue({
        data: { object: { sha: 'abc123' } },
      });

      const sha = await service.resolveRefSha(octokit, 'buntu', 'copilot', 'main');

      expect(sha).toBe('abc123');
      expect(octokit.rest.git.getRef).toHaveBeenCalledWith({
        owner: 'buntu',
        repo: 'copilot',
        ref: 'heads/main',
      });
    });

    it('throws ValidationException when branch does not exist (404)', async () => {
      const octokit = makeOctokit();
      (octokit.rest.git.getRef as jest.Mock).mockRejectedValue(makeRequestError(404, 'Not Found'));

      await expect(
        service.resolveRefSha(octokit, 'buntu', 'copilot', 'main'),
      ).rejects.toThrow(ValidationException);
    });

    it('throws ExternalServiceException on other HTTP errors', async () => {
      const octokit = makeOctokit();
      (octokit.rest.git.getRef as jest.Mock).mockRejectedValue(makeRequestError(503, 'Service Unavailable'));

      await expect(
        service.resolveRefSha(octokit, 'buntu', 'copilot', 'main'),
      ).rejects.toThrow(ExternalServiceException);
    });
  });

  // ─── createBranch() ───────────────────────────────────────────────────────

  describe('createBranch()', () => {
    it('creates a branch pointing at the base branch tip', async () => {
      const octokit = makeOctokit();
      (octokit.rest.git.getRef as jest.Mock).mockResolvedValue({
        data: { object: { sha: 'base-sha-001' } },
      });
      (octokit.rest.git.createRef as jest.Mock).mockResolvedValue({ data: {} });

      await service.createBranch(octokit, {
        owner: 'buntu',
        repo: 'copilot',
        branchName: 'fix/email-case',
        baseBranch: 'main',
      });

      expect(octokit.rest.git.createRef).toHaveBeenCalledWith({
        owner: 'buntu',
        repo: 'copilot',
        ref: 'refs/heads/fix/email-case',
        sha: 'base-sha-001',
      });
    });

    it('throws ValidationException when branch already exists (422)', async () => {
      const octokit = makeOctokit();
      (octokit.rest.git.getRef as jest.Mock).mockResolvedValue({
        data: { object: { sha: 'sha' } },
      });
      (octokit.rest.git.createRef as jest.Mock).mockRejectedValue(
        makeRequestError(422, 'Reference already exists'),
      );

      await expect(
        service.createBranch(octokit, {
          owner: 'buntu',
          repo: 'copilot',
          branchName: 'fix/email-case',
          baseBranch: 'main',
        }),
      ).rejects.toThrow(ValidationException);
    });

    it('throws ExternalServiceException on unexpected GitHub errors', async () => {
      const octokit = makeOctokit();
      (octokit.rest.git.getRef as jest.Mock).mockResolvedValue({
        data: { object: { sha: 'sha' } },
      });
      (octokit.rest.git.createRef as jest.Mock).mockRejectedValue(
        makeRequestError(500, 'Internal Server Error'),
      );

      await expect(
        service.createBranch(octokit, {
          owner: 'buntu',
          repo: 'copilot',
          branchName: 'fix/email-case',
          baseBranch: 'main',
        }),
      ).rejects.toThrow(ExternalServiceException);
    });

    it('propagates non-RequestError exceptions unchanged', async () => {
      const octokit = makeOctokit();
      (octokit.rest.git.getRef as jest.Mock).mockRejectedValue(new Error('network failure'));

      await expect(
        service.createBranch(octokit, {
          owner: 'buntu',
          repo: 'copilot',
          branchName: 'fix/email-case',
          baseBranch: 'main',
        }),
      ).rejects.toThrow('network failure');
    });
  });
});
