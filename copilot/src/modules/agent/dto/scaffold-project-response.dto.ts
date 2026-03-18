export class ScaffoldProjectResponseDto {
  runId: string;
  projectName: string;
  projectPath: string;
  template: string;
  extraArgs: string[];
  scaffoldSuccess: boolean;
  buildSuccess: boolean;
  scaffoldOutput: string;
  buildOutput: string;
  durationMs: number;
}
