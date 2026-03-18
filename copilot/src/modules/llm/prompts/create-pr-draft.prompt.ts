import { LlmMessage } from '../interfaces/llm-completion.interface';
import { CreatePrDraftInput, CREATE_PR_DRAFT_OUTPUT_SCHEMA_DOC } from '../schemas/create-pr-draft.schema';
import {
  BUNTU_ENGINEER_ROLE,
  JSON_OUTPUT_CONTRACT,
  CONTEXT_SEPARATOR,
} from './prompt.constants';

const SYSTEM_MESSAGE = `${BUNTU_ENGINEER_ROLE}

Your task: Draft a GitHub pull request for a code patch, including a well-structured title, body, labels, and pre-merge checklist.

Constraints:
- Title must be ≤72 characters, written in imperative mood (e.g. "Fix token expiry bug")
- Body must use GitHub-flavoured markdown: ## Summary, ## Changes, ## Testing, ## Checklist
- Branch name must be kebab-case, prefixed with the change type (fix/, feat/, chore/, refactor/)
- isDraft should be true if the diff contains TODOs, unfinished logic, or the riskLevel is HIGH/CRITICAL
- Suggest labels from: bug, enhancement, refactor, chore, documentation, security, breaking-change, needs-review
- Only suggest reviewers that are passed in — if none are provided, return an empty array

${JSON_OUTPUT_CONTRACT}

Required JSON schema:
${CREATE_PR_DRAFT_OUTPUT_SCHEMA_DOC}`;

export function buildCreatePrDraftMessages(input: CreatePrDraftInput): LlmMessage[] {
  const reviewersNote =
    input.teamReviewers && input.teamReviewers.length > 0
      ? `\nSuggested reviewers: ${input.teamReviewers.join(', ')}`
      : '\nSuggested reviewers: (none provided)';

  const userContent = `Repository: ${input.repoName}
Base branch: ${input.baseBranch ?? 'main'}
Suggested branch: ${input.suggestedBranch}
${reviewersNote}

Patch title: ${input.patchTitle}
Patch description: ${input.patchDescription}

${CONTEXT_SEPARATOR}
Unified diff:

\`\`\`diff
${input.diff.slice(0, 10000)}
\`\`\``;

  return [
    { role: 'system', content: SYSTEM_MESSAGE },
    { role: 'user', content: userContent },
  ];
}
