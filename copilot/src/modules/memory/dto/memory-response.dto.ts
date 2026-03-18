import { AgentMemoryType } from '../../../common/enums/agent-memory-type.enum';

export class MemoryResponseDto {
  id: string;
  repoId: string | null;
  taskId: string | null;
  type: AgentMemoryType;
  subject: string;
  content: string;
  confidence: number;
  sourceUrl: string | null;
  tags: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
