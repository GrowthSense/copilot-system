import { Injectable, Logger } from '@nestjs/common';
import { Octokit } from '@octokit/rest';
import { RequestError } from '@octokit/request-error';
import { CreateBranchInput } from './interfaces/github.interface';
import { ExternalServiceException, ValidationException } from '../../common/exceptions/app.exception';

@Injectable()
export class GithubBranchService {
  private readonly logger = new Logger(GithubBranchService.name);

  /**
   * Create a new branch pointing at the tip of `baseBranch`.
   *
   * @throws ExternalServiceException when the GitHub API call fails
   * @throws ValidationException when `baseBranch` does not exist
   */
  async createBranch(octokit: Octokit, input: CreateBranchInput): Promise<void> {
    const { owner, repo, branchName, baseBranch } = input;
    this.logger.log(`Creating branch "${branchName}" from "${baseBranch}" on ${owner}/${repo}`);

    // 1. Resolve the SHA of the base branch tip.
    const baseSha = await this.resolveRefSha(octokit, owner, repo, baseBranch);

    // 2. Create the new branch ref.
    try {
      await octokit.rest.git.createRef({
        owner,
        repo,
        ref: `refs/heads/${branchName}`,
        sha: baseSha,
      });
      this.logger.log(`Branch "${branchName}" created at ${baseSha}`);
    } catch (err) {
      if (err instanceof RequestError) {
        if (err.status === 422) {
          throw new ValidationException(
            `Branch "${branchName}" already exists on ${owner}/${repo}`,
          );
        }
        throw new ExternalServiceException(
          'GitHub',
          `Failed to create branch "${branchName}": ${err.status} ${err.message}`,
        );
      }
      throw err;
    }
  }

  /** Resolve the commit SHA that a branch currently points at. */
  async resolveRefSha(
    octokit: Octokit,
    owner: string,
    repo: string,
    branchName: string,
  ): Promise<string> {
    try {
      const response = await octokit.rest.git.getRef({
        owner,
        repo,
        ref: `heads/${branchName}`,
      });
      return response.data.object.sha;
    } catch (err) {
      if (err instanceof RequestError) {
        if (err.status === 404) {
          throw new ValidationException(
            `Branch "${branchName}" does not exist on ${owner}/${repo}`,
          );
        }
        throw new ExternalServiceException(
          'GitHub',
          `Failed to resolve branch "${branchName}": ${err.status} ${err.message}`,
        );
      }
      throw err;
    }
  }
}
