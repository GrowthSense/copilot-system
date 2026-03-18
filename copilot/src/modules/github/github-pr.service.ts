import { Injectable, Logger } from '@nestjs/common';
import { Octokit } from '@octokit/rest';
import { RequestError } from '@octokit/request-error';
import { CreatePullRequestInput, GitHubPrResult } from './interfaces/github.interface';
import { ExternalServiceException } from '../../common/exceptions/app.exception';

@Injectable()
export class GithubPrService {
  private readonly logger = new Logger(GithubPrService.name);

  /**
   * Create a pull request and apply labels + review requests.
   *
   * Returns the PR number, URL, draft status, and node ID for persistence.
   *
   * @throws ExternalServiceException on GitHub API failures
   */
  async createPullRequest(
    octokit: Octokit,
    input: CreatePullRequestInput,
  ): Promise<GitHubPrResult> {
    const { owner, repo, title, body, headBranch, baseBranch, labels, reviewers, isDraft } = input;
    this.logger.log(`Creating PR "${title}" — ${owner}/${repo} ${headBranch} → ${baseBranch}`);

    let prNumber: number;
    let prUrl: string;
    let prIsDraft: boolean;
    let nodeId: string;

    try {
      const prResponse = await octokit.rest.pulls.create({
        owner,
        repo,
        title,
        body,
        head: headBranch,
        base: baseBranch,
        draft: isDraft ?? true,
      });

      prNumber = prResponse.data.number;
      prUrl = prResponse.data.html_url;
      prIsDraft = prResponse.data.draft ?? (isDraft ?? true);
      nodeId = prResponse.data.node_id;

      this.logger.log(`PR #${prNumber} created: ${prUrl}`);
    } catch (err) {
      if (err instanceof RequestError) {
        throw new ExternalServiceException(
          'GitHub',
          `Failed to create PR "${title}": ${err.status} ${err.message}`,
        );
      }
      throw err;
    }

    // Apply labels (non-fatal — log warning on failure).
    if (labels && labels.length > 0) {
      await this.applyLabels(octokit, owner, repo, prNumber, labels);
    }

    // Request reviewers (non-fatal).
    if (reviewers && reviewers.length > 0) {
      await this.requestReviewers(octokit, owner, repo, prNumber, reviewers);
    }

    return { prNumber, prUrl, isDraft: prIsDraft, headBranch, baseBranch, nodeId };
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private async applyLabels(
    octokit: Octokit,
    owner: string,
    repo: string,
    issueNumber: number,
    labels: string[],
  ): Promise<void> {
    try {
      await octokit.rest.issues.addLabels({ owner, repo, issue_number: issueNumber, labels });
      this.logger.log(`Labels applied to PR #${issueNumber}: ${labels.join(', ')}`);
    } catch (err) {
      const message = err instanceof RequestError ? `${err.status} ${err.message}` : String(err);
      this.logger.warn(`Failed to apply labels to PR #${issueNumber}: ${message}`);
    }
  }

  private async requestReviewers(
    octokit: Octokit,
    owner: string,
    repo: string,
    pullNumber: number,
    reviewers: string[],
  ): Promise<void> {
    try {
      await octokit.rest.pulls.requestReviewers({
        owner,
        repo,
        pull_number: pullNumber,
        reviewers,
      });
      this.logger.log(`Reviewers requested for PR #${pullNumber}: ${reviewers.join(', ')}`);
    } catch (err) {
      const message = err instanceof RequestError ? `${err.status} ${err.message}` : String(err);
      this.logger.warn(`Failed to request reviewers for PR #${pullNumber}: ${message}`);
    }
  }
}
