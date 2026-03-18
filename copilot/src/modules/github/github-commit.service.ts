import { Injectable, Logger } from '@nestjs/common';
import { Octokit } from '@octokit/rest';
import { RequestError } from '@octokit/request-error';
import { CreateCommitInput } from './interfaces/github.interface';
import { GithubBranchService } from './github-branch.service';
import { ExternalServiceException } from '../../common/exceptions/app.exception';

@Injectable()
export class GithubCommitService {
  private readonly logger = new Logger(GithubCommitService.name);

  constructor(private readonly branchService: GithubBranchService) {}

  /**
   * Create a single commit on `branchName` containing all the provided file changes.
   *
   * Uses the tree-based Git Data API so multiple files can be committed atomically:
   *   getRef → getCommit → createTree → createCommit → updateRef
   *
   * @returns SHA of the new commit
   * @throws ExternalServiceException on GitHub API failures
   */
  async createCommit(octokit: Octokit, input: CreateCommitInput): Promise<string> {
    const { owner, repo, branchName, message, files } = input;
    this.logger.log(
      `Creating commit on "${branchName}" (${owner}/${repo}) — ${files.length} file(s)`,
    );

    if (files.length === 0) {
      throw new ExternalServiceException('GitHub', 'Cannot create a commit with no files');
    }

    try {
      // 1. Get the current commit SHA that the branch points at.
      const commitSha = await this.branchService.resolveRefSha(octokit, owner, repo, branchName);

      // 2. Get the tree SHA of the current commit.
      const commitData = await octokit.rest.git.getCommit({
        owner,
        repo,
        commit_sha: commitSha,
      });
      const baseTreeSha = commitData.data.tree.sha;

      // 3. Create a new tree with the changed files layered on top.
      const treeEntries = files.map((f) => ({
        path: f.filePath,
        mode: '100644' as const,
        type: 'blob' as const,
        content: f.content,
      }));

      const newTreeData = await octokit.rest.git.createTree({
        owner,
        repo,
        base_tree: baseTreeSha,
        tree: treeEntries,
      });

      // 4. Create the commit object referencing the new tree.
      const newCommitData = await octokit.rest.git.createCommit({
        owner,
        repo,
        message,
        tree: newTreeData.data.sha,
        parents: [commitSha],
      });

      const newCommitSha = newCommitData.data.sha;

      // 5. Advance the branch ref to the new commit.
      await octokit.rest.git.updateRef({
        owner,
        repo,
        ref: `heads/${branchName}`,
        sha: newCommitSha,
      });

      this.logger.log(`Commit ${newCommitSha} created on "${branchName}"`);
      return newCommitSha;
    } catch (err) {
      if (err instanceof RequestError) {
        throw new ExternalServiceException(
          'GitHub',
          `Failed to create commit on "${branchName}": ${err.status} ${err.message}`,
        );
      }
      throw err;
    }
  }
}
