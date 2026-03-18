import { RunStatus } from '../../../common/enums/run-status.enum';
import { RunType } from '../../../common/enums/run-type.enum';

export interface AgentRunInput {
  prompt: string;
  repoId?: string;
  context?: Record<string, unknown>;
}

export interface AgentRunOutput {
  answer?: string;
  files?: string[];
  explanation?: string;
  patchId?: string;
  testFileIds?: string[];
  prUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface AgentRunRecord {
  id: string;
  repoId: string | null;
  type: RunType;
  status: RunStatus;
  input: AgentRunInput;
  output: AgentRunOutput | null;
  error: string | null;
  durationMs: number | null;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
}
