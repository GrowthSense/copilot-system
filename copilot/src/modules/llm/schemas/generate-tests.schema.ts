import { z } from 'zod';

export const GenerateTestsOutputSchema = z.object({
  testFile: z.string().min(1),
  content: z.string().min(1),
  framework: z.enum(['jest', 'vitest', 'mocha']),
  testCount: z.number().int().positive(),
  coveredScenarios: z.array(z.string()).min(1),
  setupNotes: z.string(),
  mockedDependencies: z.array(z.string()),
});

export type GenerateTestsOutput = z.infer<typeof GenerateTestsOutputSchema>;

export interface GenerateTestsInput {
  filePath: string;
  content: string;
  language?: string;
  framework?: string;
  existingTestContent?: string;
}

export const GENERATE_TESTS_OUTPUT_SCHEMA_DOC = `{
  "testFile": "string — suggested output test file path (e.g. src/foo/foo.service.spec.ts)",
  "content": "string — full test file source code",
  "framework": "jest | vitest | mocha",
  "testCount": "integer — number of test cases in the file",
  "coveredScenarios": ["string[] — human-readable description of each scenario tested"],
  "setupNotes": "string — any setup or prerequisite notes (mocking strategy, env vars, etc.)",
  "mockedDependencies": ["string[] — identifiers that are mocked in the tests"]
}`;
