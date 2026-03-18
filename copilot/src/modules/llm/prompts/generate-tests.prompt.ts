import { LlmMessage } from '../interfaces/llm-completion.interface';
import { GenerateTestsInput, GENERATE_TESTS_OUTPUT_SCHEMA_DOC } from '../schemas/generate-tests.schema';
import {
  BUNTU_ENGINEER_ROLE,
  JSON_OUTPUT_CONTRACT,
  CONTEXT_SEPARATOR,
} from './prompt.constants';

const SYSTEM_MESSAGE = `${BUNTU_ENGINEER_ROLE}

Your task: Generate a complete, runnable unit test file for the provided source code.

Constraints:
- Default framework is Jest unless another is specified
- Use describe/it blocks with descriptive names
- Test the happy path, edge cases, and error cases for every exported function or class method
- Mock all external dependencies (database, HTTP clients, third-party services) — never make real calls
- The content field must be a complete, self-contained test file that can be run immediately
- testCount must equal the exact number of it() / test() calls in the generated content

${JSON_OUTPUT_CONTRACT}

Required JSON schema:
${GENERATE_TESTS_OUTPUT_SCHEMA_DOC}`;

export function buildGenerateTestsMessages(input: GenerateTestsInput): LlmMessage[] {
  const languageNote = input.language ? ` (${input.language})` : '';
  const frameworkNote = input.framework
    ? `\nTest framework: ${input.framework}`
    : '\nTest framework: jest';
  const existingNote = input.existingTestContent
    ? `\n\nExisting test file (extend, do not duplicate):\n\`\`\`\n${input.existingTestContent.slice(0, 4000)}\n\`\`\``
    : '';

  const userContent = `File to test: ${input.filePath}${languageNote}${frameworkNote}${existingNote}

${CONTEXT_SEPARATOR}
Source code:

${input.content.slice(0, 10000)}`;

  return [
    { role: 'system', content: SYSTEM_MESSAGE },
    { role: 'user', content: userContent },
  ];
}
