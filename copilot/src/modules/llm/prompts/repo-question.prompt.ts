import { LlmMessage } from '../interfaces/llm-completion.interface';
import { RepoQuestionInput, REPO_QUESTION_OUTPUT_SCHEMA_DOC } from '../schemas/repo-question.schema';
import {
  BUNTU_ENGINEER_ROLE,
  JSON_OUTPUT_CONTRACT,
  CONTEXT_SEPARATOR,
  formatCodeContext,
} from './prompt.constants';

const SYSTEM_MESSAGE = `${BUNTU_ENGINEER_ROLE}

Your task: Answer engineering questions about a specific repository using only the code context provided.

Constraints:
- Use ONLY information present in the provided file contexts
- If the context is insufficient, set confidence < 0.5 and explain the gap in caveats
- Never invent file paths, function names, or implementation details not present in the context
- Be precise, technical, and concise

${JSON_OUTPUT_CONTRACT}

Required JSON schema:
${REPO_QUESTION_OUTPUT_SCHEMA_DOC}`;

export function buildRepoQuestionMessages(input: RepoQuestionInput): LlmMessage[] {
  const contextBlock = formatCodeContext(input.codeContext);

  const userContent = `Repository: ${input.repoName}

Question:
${input.question}

${CONTEXT_SEPARATOR}
Code Context:

${contextBlock}`;

  return [
    { role: 'system', content: SYSTEM_MESSAGE },
    { role: 'user', content: userContent },
  ];
}
