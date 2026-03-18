import { LlmMessage } from '../interfaces/llm-completion.interface';
import { ExplainCodeInput, EXPLAIN_CODE_OUTPUT_SCHEMA_DOC } from '../schemas/explain-code.schema';
import {
  BUNTU_ENGINEER_ROLE,
  JSON_OUTPUT_CONTRACT,
  CONTEXT_SEPARATOR,
} from './prompt.constants';

const SYSTEM_MESSAGE = `${BUNTU_ENGINEER_ROLE}

Your task: Analyse a source code file and produce a structured explanation of its purpose, components, dependencies, and quality.

Constraints:
- Base your analysis entirely on the provided source code
- List every significant exported symbol in keyComponents
- Be honest about complexity — do not downgrade HIGH complexity to medium
- Suggestions must be actionable and specific to this file

${JSON_OUTPUT_CONTRACT}

Required JSON schema:
${EXPLAIN_CODE_OUTPUT_SCHEMA_DOC}`;

export function buildExplainCodeMessages(input: ExplainCodeInput): LlmMessage[] {
  const languageNote = input.language ? ` (${input.language})` : '';
  const contextNote = input.context
    ? `\nAdditional context: ${input.context}\n`
    : '';

  const userContent = `File: ${input.filePath}${languageNote}
${contextNote}
${CONTEXT_SEPARATOR}

${input.content.slice(0, 12000)}`;

  return [
    { role: 'system', content: SYSTEM_MESSAGE },
    { role: 'user', content: userContent },
  ];
}
