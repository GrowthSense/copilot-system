import { AgentTaskStatus } from '../../../common/enums/agent-task-status.enum';
import { AgentTaskStepStatus } from '../../../common/enums/agent-task-step-status.enum';

export class AgentTaskStepResponseDto {
  id: string;
  taskId: string;
  stepIndex: number;
  title: string;
  description: string;
  toolName: string | null;
  toolInput: unknown;
  toolOutput: unknown;
  requiresApproval: boolean;
  approvalId: string | null;
  status: AgentTaskStepStatus;
  reflectionJson: unknown;
  error: string | null;
  durationMs: number | null;
  createdAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
}

export class AgentTaskResponseDto {
  id: string;
  repoId: string | null;
  title: string;
  userPrompt: string;
  goal: string;           // alias for title — used by the frontend
  status: AgentTaskStatus;
  planJson: unknown;
  planApprovalId: string | null;
  currentStepIndex: number;
  totalSteps: number;
  error: string | null;
  errorMessage: string | null;  // alias for error — used by the frontend
  output: unknown;
  durationMs: number | null;
  createdAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  steps?: AgentTaskStepResponseDto[];
}
