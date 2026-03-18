/**
 * A single file change to be committed to GitHub.
 * `content` must be the full new UTF-8 file content (not a diff).
 */
export interface GitHubFileChange {
  /** Relative path within the repository, e.g. "src/auth/auth.service.ts" */
  filePath: string;
  /** Full new file content in UTF-8 */
  content: string;
}

/** Input for creating a new branch off a base branch. */
export interface CreateBranchInput {
  owner: string;
  repo: string;
  branchName: string;
  /** The branch to branch off — usually "main" or "develop". */
  baseBranch: string;
}

/** Input for creating a single commit containing one or more file changes. */
export interface CreateCommitInput {
  owner: string;
  repo: string;
  /** The branch that will be updated to point at the new commit. */
  branchName: string;
  /** Commit message (first line = subject; optional body after a blank line). */
  message: string;
  /** Files to create or update in this commit. */
  files: GitHubFileChange[];
}

/** Input for creating a pull request. */
export interface CreatePullRequestInput {
  owner: string;
  repo: string;
  title: string;
  body: string;
  headBranch: string;
  baseBranch: string;
  /** GitHub label names to apply immediately after PR creation. */
  labels?: string[];
  /** GitHub usernames to request a review from. */
  reviewers?: string[];
  /** Whether to open the PR as a draft (default: true). */
  isDraft?: boolean;
}

/** Result returned after successfully creating a pull request. */
export interface GitHubPrResult {
  prNumber: number;
  prUrl: string;
  isDraft: boolean;
  headBranch: string;
  baseBranch: string;
  nodeId: string;
}

/** Split "owner/repo" into its two components. */
export function splitRepoFullName(fullName: string): { owner: string; repo: string } {
  const slashIndex = fullName.indexOf('/');
  if (slashIndex <= 0 || slashIndex === fullName.length - 1) {
    throw new Error(`Invalid repository full name: "${fullName}" — expected "owner/repo" format`);
  }
  return {
    owner: fullName.slice(0, slashIndex),
    repo: fullName.slice(slashIndex + 1),
  };
}
