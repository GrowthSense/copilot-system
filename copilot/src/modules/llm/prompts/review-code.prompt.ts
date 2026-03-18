import { LlmMessage } from '../interfaces/llm-completion.interface';
import { ReviewCodeInput, REVIEW_CODE_OUTPUT_SCHEMA_DOC } from '../schemas/review-code.schema';
import {
  BUNTU_ENGINEER_ROLE,
  JSON_OUTPUT_CONTRACT,
  CONTEXT_SEPARATOR,
} from './prompt.constants';

const SYSTEM_MESSAGE = `${BUNTU_ENGINEER_ROLE}

Your task: Perform a thorough code review of the provided source file.

Review guidelines:
- Flag CRITICAL issues: security vulnerabilities (injection, auth bypass, data exposure), data loss risks
- Flag HIGH issues: significant bugs, race conditions, performance bottlenecks that affect production
- Flag MEDIUM issues: error handling gaps, missing edge cases, maintainability problems
- Flag LOW issues: style improvements, minor naming issues, optional improvements
- Include exact line numbers when you can identify them in the source
- The "suggestion" field must be actionable — tell the developer exactly what to change
- Identify what the code does WELL in the "positives" array
- Recommend specific test scenarios that are missing or should be added

${JSON_OUTPUT_CONTRACT}

Required JSON schema:
${REVIEW_CODE_OUTPUT_SCHEMA_DOC}`;

export function buildReviewCodeMessages(input: ReviewCodeInput): LlmMessage[] {
  const languageNote = input.language ? ` (${input.language})` : '';
  const focusNote = input.focusAreas && input.focusAreas.length > 0
    ? `\nFocus areas: ${input.focusAreas.join(', ')}`
    : '';
  const contextNote = input.additionalContext
    ? `\n\nAdditional context: ${input.additionalContext}`
    : '';

  const userContent = `File to review: ${input.filePath}${languageNote}${focusNote}${contextNote}

${CONTEXT_SEPARATOR}
Source code:

${input.content.slice(0, 12000)}`;

  return [
    { role: 'system', content: SYSTEM_MESSAGE },
    { role: 'user', content: userContent },
  ];
}
