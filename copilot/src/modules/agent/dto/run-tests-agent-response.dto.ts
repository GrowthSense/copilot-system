export class RunTestsAgentResponseDto {
  runId: string;
  testRunResultId: string;
  testgenId: string;
  passed: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  timedOut: boolean;
  command: string;
}
