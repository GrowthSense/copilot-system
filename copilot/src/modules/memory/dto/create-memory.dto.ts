import { AgentMemoryType } from '../../../common/enums/agent-memory-type.enum';

export class CreateMemoryDto {
  repoId?: string;
  taskId?: string;
  type: AgentMemoryType;
  subject: string;
  content: string;
  confidence?: number;
  sourceUrl?: string;
  tags?: string[];
  expiresAt?: Date;
}
