import { LlmMessage } from '../interfaces/llm-completion.interface';
import { ProposePatchInput, PROPOSE_PATCH_OUTPUT_SCHEMA_DOC } from '../schemas/propose-patch.schema';
import {
  BUNTU_ENGINEER_ROLE,
  JSON_OUTPUT_CONTRACT,
  CONTEXT_SEPARATOR,
  formatCodeContext,
} from './prompt.constants';

const SYSTEM_MESSAGE = `${BUNTU_ENGINEER_ROLE}

Your task: Produce a minimal, correct code patch in unified diff format that satisfies the change request.

Constraints:
- Generate a valid unified diff (--- a/file \\n +++ b/file \\n @@ ... @@)
- Make the smallest possible change that satisfies the request
- Do not refactor code that is not directly related to the request
- Assign riskLevel honestly: CRITICAL if it touches auth/payments/security, HIGH if it changes public API contracts, MEDIUM for logic changes, LOW for cosmetic/docs
- breakingChanges must be true if any public interface, exported type, or API contract changes
- testingNotes must name specific test scenarios to verify the patch

${JSON_OUTPUT_CONTRACT}

Required JSON schema:
${PROPOSE_PATCH_OUTPUT_SCHEMA_DOC}`;

export function buildProposePatchMessages(input: ProposePatchInput): LlmMessage[] {
  const contextBlock = formatCodeContext(input.targetFiles);
  const constraintsBlock =
    input.constraints && input.constraints.length > 0
      ? `\nAdditional constraints:\n${input.constraints.map((c) => `- ${c}`).join('\n')}\n`
      : '';
  const extraContext = input.context ? `\nContext: ${input.context}\n` : '';

  const userContent = `Repository: ${input.repoName}
${extraContext}${constraintsBlock}
Change request:
${input.request}

${CONTEXT_SEPARATOR}
Target files:

${contextBlock}`;

  return [
    { role: 'system', content: SYSTEM_MESSAGE },
    { role: 'user', content: userContent },
  ];
}
