import { Test, TestingModule } from '@nestjs/testing';
import { GithubPrService } from '../github-pr.service';
import { RequestError } from '@octokit/request-error';
import { ExternalServiceException } from '../../../common/exceptions/app.exception';
import { CreatePullRequestInput } from '../interfaces/github.interface';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeOctokit() {
  return {
    rest: {
      pulls: {
        create: jest.fn(),
        requestReviewers: jest.fn(),
      },
      issues: {
        addLabels: jest.fn(),
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

const VALID_INPUT: CreatePullRequestInput = {
  owner: 'buntu',
  repo: 'copilot',
  title: 'Fix email case sensitivity in login',
  body: '## Summary\nNormalise email to lowercase.\n\n## Checklist\n- [x] Unit tests added',
  headBranch: 'fix/email-case-sensitivity-in-login',
  baseBranch: 'main',
  labels: ['bug'],
  reviewers: ['alice'],
  isDraft: true,
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GithubPrService', () => {
  let service: GithubPrService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GithubPrService],
    }).compile();
    service = module.get(GithubPrService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('createPullRequest()', () => {
    it('creates the PR and applies labels and reviewers', async () => {
      const octokit = makeOctokit();
      (octokit.rest.pulls.create as jest.Mock).mockResolvedValue({
        data: {
          number: 42,
          html_url: 'https://github.com/buntu/copilot/pull/42',
          draft: true,
          node_id: 'PR_node_001',
        },
      });
      (octokit.rest.issues.addLabels as jest.Mock).mockResolvedValue({ data: {} });
      (octokit.rest.pulls.requestReviewers as jest.Mock).mockResolvedValue({ data: {} });

      const result = await service.createPullRequest(octokit, VALID_INPUT);

      expect(result.prNumber).toBe(42);
      expect(result.prUrl).toBe('https://github.com/buntu/copilot/pull/42');
      expect(result.isDraft).toBe(true);
      expect(result.headBranch).toBe(VALID_INPUT.headBranch);
      expect(result.baseBranch).toBe(VALID_INPUT.baseBranch);

      expect(octokit.rest.pulls.create).toHaveBeenCalledWith(
        expect.objectContaining({
          owner: 'buntu',
          repo: 'copilot',
          title: VALID_INPUT.title,
          head: VALID_INPUT.headBranch,
          base: VALID_INPUT.baseBranch,
          draft: true,
        }),
      );
      expect(octokit.rest.issues.addLabels).toHaveBeenCalledWith(
        expect.objectContaining({ issue_number: 42, labels: ['bug'] }),
      );
      expect(octokit.rest.pulls.requestReviewers).toHaveBeenCalledWith(
        expect.objectContaining({ pull_number: 42, reviewers: ['alice'] }),
      );
    });

    it('skips label request when labels array is empty', async () => {
      const octokit = makeOctokit();
      (octokit.rest.pulls.create as jest.Mock).mockResolvedValue({
        data: {
          number: 1,
          html_url: 'https://github.com/buntu/copilot/pull/1',
          draft: true,
          node_id: 'node1',
        },
      });

      await service.createPullRequest(octokit, { ...VALID_INPUT, labels: [], reviewers: [] });

      expect(octokit.rest.issues.addLabels).not.toHaveBeenCalled();
      expect(octokit.rest.pulls.requestReviewers).not.toHaveBeenCalled();
    });

    it('does not fail the PR result when label application fails', async () => {
      const octokit = makeOctokit();
      (octokit.rest.pulls.create as jest.Mock).mockResolvedValue({
        data: {
          number: 5,
          html_url: 'https://github.com/buntu/copilot/pull/5',
          draft: false,
          node_id: 'node5',
        },
      });
      (octokit.rest.issues.addLabels as jest.Mock).mockRejectedValue(
        makeRequestError(422, 'Label does not exist'),
      );
      (octokit.rest.pulls.requestReviewers as jest.Mock).mockResolvedValue({ data: {} });

      // Should NOT throw — label failures are non-fatal.
      const result = await service.createPullRequest(octokit, VALID_INPUT);

      expect(result.prNumber).toBe(5);
    });

    it('does not fail the PR result when reviewer request fails', async () => {
      const octokit = makeOctokit();
      (octokit.rest.pulls.create as jest.Mock).mockResolvedValue({
        data: {
          number: 6,
          html_url: 'https://github.com/buntu/copilot/pull/6',
          draft: true,
          node_id: 'node6',
        },
      });
      (octokit.rest.issues.addLabels as jest.Mock).mockResolvedValue({ data: {} });
      (octokit.rest.pulls.requestReviewers as jest.Mock).mockRejectedValue(
        makeRequestError(422, 'Reviewer not found'),
      );

      const result = await service.createPullRequest(octokit, VALID_INPUT);

      expect(result.prNumber).toBe(6);
    });

    it('throws ExternalServiceException when PR creation fails', async () => {
      const octokit = makeOctokit();
      (octokit.rest.pulls.create as jest.Mock).mockRejectedValue(
        makeRequestError(422, 'Validation Failed'),
      );

      await expect(
        service.createPullRequest(octokit, VALID_INPUT),
      ).rejects.toThrow(ExternalServiceException);
    });

    it('propagates non-RequestError exceptions from PR creation', async () => {
      const octokit = makeOctokit();
      (octokit.rest.pulls.create as jest.Mock).mockRejectedValue(new Error('network timeout'));

      await expect(
        service.createPullRequest(octokit, VALID_INPUT),
      ).rejects.toThrow('network timeout');
    });

    it('defaults isDraft to true when not specified', async () => {
      const octokit = makeOctokit();
      (octokit.rest.pulls.create as jest.Mock).mockResolvedValue({
        data: {
          number: 7,
          html_url: 'https://github.com/buntu/copilot/pull/7',
          draft: true,
          node_id: 'node7',
        },
      });

      const input: CreatePullRequestInput = { ...VALID_INPUT };
      delete (input as Partial<CreatePullRequestInput>).isDraft;

      await service.createPullRequest(octokit, input);

      expect(octokit.rest.pulls.create).toHaveBeenCalledWith(
        expect.objectContaining({ draft: true }),
      );
    });
  });
});
