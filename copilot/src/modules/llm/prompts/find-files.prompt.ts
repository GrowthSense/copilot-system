import { LlmMessage } from '../interfaces/llm-completion.interface';
import { FindFilesInput, FIND_FILES_OUTPUT_SCHEMA_DOC } from '../schemas/find-files.schema';
import {
  BUNTU_ENGINEER_ROLE,
  JSON_OUTPUT_CONTRACT,
  CONTEXT_SEPARATOR,
  formatFileList,
} from './prompt.constants';

const SYSTEM_MESSAGE = `${BUNTU_ENGINEER_ROLE}

Your task: Given a natural language query and a list of repository file paths, identify the files most relevant to the query.

Constraints:
- Only return file paths that appear in the provided list — do not invent paths
- Sort results by relevance score descending
- A relevanceScore of 1.0 means highly relevant, 0.0 means not relevant
- Only return files with relevanceScore > 0.2 unless fewer than 3 exist above that threshold

${JSON_OUTPUT_CONTRACT}

Required JSON schema:
${FIND_FILES_OUTPUT_SCHEMA_DOC}`;

export function buildFindFilesMessages(input: FindFilesInput): LlmMessage[] {
  const limit = input.limit ?? 10;
  const fileListBlock = formatFileList(input.fileList);

  const userContent = `Repository: ${input.repoName}
Return at most ${limit} files.

Query:
${input.query}

${CONTEXT_SEPARATOR}
Repository file paths:

${fileListBlock}`;

  return [
    { role: 'system', content: SYSTEM_MESSAGE },
    { role: 'user', content: userContent },
  ];
}
