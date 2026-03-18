import { z } from 'zod';

export const CreatePrDraftOutputSchema = z.object({
  title: z.string().min(1),
  body: z.string().min(1),
  headBranch: z.string().min(1),
  baseBranch: z.string().min(1),
  labels: z.array(z.string()),
  reviewers: z.array(z.string()),
  isDraft: z.boolean(),
  checklist: z.array(z.string()),
});

export type CreatePrDraftOutput = z.infer<typeof CreatePrDraftOutputSchema>;

export interface CreatePrDraftInput {
  repoName: string;
  diff: string;
  patchTitle: string;
  patchDescription: string;
  suggestedBranch: string;
  baseBranch?: string;
  teamReviewers?: string[];
}

export const CREATE_PR_DRAFT_OUTPUT_SCHEMA_DOC = `{
  "title": "string — PR title (≤72 chars)",
  "body": "string — full PR body in GitHub-flavoured markdown",
  "headBranch": "string — feature branch name (kebab-case)",
  "baseBranch": "string — target branch (usually main or develop)",
  "labels": ["string[] — suggested GitHub labels"],
  "reviewers": ["string[] — suggested reviewer GitHub usernames"],
  "isDraft": "boolean — true if the PR should be opened as a draft",
  "checklist": ["string[] — pre-merge checklist items for the PR body"]
}`;
