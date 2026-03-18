export class GenerateTestsAgentResponseDto {
  /** The AgentRun ID — retrieve via GET /api/v1/runs/:runId for full step audit trail. */
  runId: string;

  /** The persisted GeneratedTest ID — retrieve via GET /api/v1/testgen/:testgenId. */
  testgenId: string;

  /** Relative path of the source file that was tested. */
  targetFile: string;

  /** Suggested output path for the generated test file. */
  testFile: string;

  /** Full, runnable test file content. */
  content: string;

  /** Test framework used (jest | vitest | mocha). */
  framework: string;

  /** Number of test cases in the generated file. */
  testCount: number;

  /** Human-readable description of each scenario tested. */
  coveredScenarios: string[];

  /** Setup or prerequisite notes (mocking strategy, environment variables, etc.). */
  setupNotes: string;

  /** Identifiers mocked in the generated tests. */
  mockedDependencies: string[];

  /**
   * Non-fatal validation warnings flagged by PatchValidatorService.
   * Empty when the test output passed cleanly.
   */
  validationWarnings: string[];

  durationMs: number;
}
