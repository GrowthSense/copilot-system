import { Injectable, Logger } from '@nestjs/common';
import { Octokit } from '@octokit/rest';
import { AppConfigService } from '../../config/config.service';
import { GithubBranchService } from './github-branch.service';
import { GithubCommitService } from './github-commit.service';
import { GithubPrService } from './github-pr.service';
import {
  CreateBranchInput,
  CreateCommitInput,
  CreatePullRequestInput,
  GitHubPrResult,
} from './interfaces/github.interface';
import { ExternalServiceException } from '../../common/exceptions/app.exception';

/**
 * GithubService is the single entry point for all GitHub API interactions.
 *
 * Authentication precedence:
 *   1. GITHUB_TOKEN (Personal Access Token) — recommended for development
 *   2. GITHUB_APP_ID + GITHUB_APP_PRIVATE_KEY (GitHub App) — for production
 *      (App auth requires @octokit/auth-app and is stubbed with a clear error)
 *
 * The Octokit instance is created lazily and cached per process.
 */
@Injectable()
export class GithubService {
  private readonly logger = new Logger(GithubService.name);
  private octokitInstance: Octokit | null = null;

  constructor(
    private readonly config: AppConfigService,
    private readonly branchService: GithubBranchService,
    private readonly commitService: GithubCommitService,
    private readonly prService: GithubPrService,
  ) {}

  // ─── Public facade ────────────────────────────────────────────────────────

  /** Create a new branch on the repository. */
  async createBranch(input: CreateBranchInput): Promise<void> {
    const octokit = this.getOctokit();
    return this.branchService.createBranch(octokit, input);
  }

  /**
   * Commit one or more file changes to an existing branch atomically.
   * Uses the Git Data tree API so all files land in a single commit.
   *
   * @returns SHA of the new commit
   */
  async createCommit(input: CreateCommitInput): Promise<string> {
    const octokit = this.getOctokit();
    return this.commitService.createCommit(octokit, input);
  }

  /**
   * Create a draft pull request and optionally apply labels + review requests.
   *
   * @returns PR number, URL, draft status, and node ID
   */
  async createPullRequest(input: CreatePullRequestInput): Promise<GitHubPrResult> {
    const octokit = this.getOctokit();
    return this.prService.createPullRequest(octokit, input);
  }

  // ─── Auth helpers ─────────────────────────────────────────────────────────

  /**
   * Return the cached Octokit instance, creating it on first call.
   *
   * Auth strategy:
   *   - If GITHUB_TOKEN is set, use Personal Access Token auth.
   *   - If GITHUB_APP_ID + GITHUB_APP_PRIVATE_KEY are set, use GitHub App auth
   *     (requires @octokit/auth-app — currently stubbed with a clear error).
   *   - Otherwise, throw ExternalServiceException.
   */
  private getOctokit(): Octokit {
    if (this.octokitInstance) return this.octokitInstance;

    const token = this.config.githubToken;

    if (token) {
      this.octokitInstance = new Octokit({ auth: token });
      this.logger.log('Octokit initialised with Personal Access Token');
      return this.octokitInstance;
    }

    if (this.config.githubAppId && this.config.githubAppPrivateKey) {
      // Production path: GitHub App auth via @octokit/auth-app.
      //
      // To enable, install @octokit/auth-app and replace this block:
      //
      //   import { createAppAuth } from '@octokit/auth-app';
      //   this.octokitInstance = new Octokit({
      //     authStrategy: createAppAuth,
      //     auth: {
      //       appId: this.config.githubAppId,
      //       privateKey: this.config.githubAppPrivateKey,
      //       installationId: <resolved per repo>,
      //     },
      //   });
      //
      throw new ExternalServiceException(
        'GitHub',
        'GitHub App auth requires @octokit/auth-app — install the package and wire it in GithubService.getOctokit(). ' +
          'Alternatively, set GITHUB_TOKEN for PAT auth.',
      );
    }

    throw new ExternalServiceException(
      'GitHub',
      'No GitHub credentials configured. Set GITHUB_TOKEN (Personal Access Token) in your .env file, ' +
        'or configure GITHUB_APP_ID + GITHUB_APP_PRIVATE_KEY for GitHub App authentication.',
    );
  }
}
