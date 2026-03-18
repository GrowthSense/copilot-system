export class ToolResultDto {
  toolName: string;
  success: boolean;
  output: unknown;
  error?: string;
  durationMs: number;
  requiresApproval: boolean;
}
