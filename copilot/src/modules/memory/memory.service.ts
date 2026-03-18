import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreateMemoryDto } from './dto/create-memory.dto';
import { MemoryResponseDto } from './dto/memory-response.dto';
import { AgentMemoryType } from '../../common/enums/agent-memory-type.enum';

@Injectable()
export class MemoryService {
  private readonly logger = new Logger(MemoryService.name);

  constructor(private readonly db: DatabaseService) {}

  async create(dto: CreateMemoryDto): Promise<MemoryResponseDto> {
    const memory = await this.db.agentMemory.create({
      data: {
        repoId: dto.repoId ?? null,
        taskId: dto.taskId ?? null,
        type: dto.type,
        subject: dto.subject,
        content: dto.content,
        confidence: dto.confidence ?? 1.0,
        sourceUrl: dto.sourceUrl ?? null,
        tags: dto.tags ?? [],
        expiresAt: dto.expiresAt ?? null,
        isActive: true,
      },
    });
    this.logger.log(`Memory created [${dto.type}] "${dto.subject}" repo=${dto.repoId ?? 'global'}`);
    return memory as MemoryResponseDto;
  }

  async findByRepo(
    repoId: string,
    type?: AgentMemoryType,
    tags?: string[],
    limit = 50,
  ): Promise<MemoryResponseDto[]> {
    const where: Record<string, unknown> = {
      repoId,
      isActive: true,
      ...(type ? { type } : {}),
    };

    // filter by tags if provided
    if (tags && tags.length > 0) {
      where['tags'] = { hasSome: tags };
    }

    const memories = await this.db.agentMemory.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return memories as MemoryResponseDto[];
  }

  async findByTask(taskId: string): Promise<MemoryResponseDto[]> {
    const memories = await this.db.agentMemory.findMany({
      where: { taskId, isActive: true },
      orderBy: { createdAt: 'asc' },
    });
    return memories as MemoryResponseDto[];
  }

  async findGlobal(type?: AgentMemoryType, limit = 20): Promise<MemoryResponseDto[]> {
    const memories = await this.db.agentMemory.findMany({
      where: { repoId: null, isActive: true, ...(type ? { type } : {}) },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return memories as MemoryResponseDto[];
  }

  async softDelete(id: string): Promise<void> {
    await this.db.agentMemory.update({ where: { id }, data: { isActive: false } });
  }

  /**
   * Load all active memories for a repo (and global ones), combined.
   * Returns up to `limit` sorted by confidence desc, then createdAt desc.
   */
  async loadForContext(repoId?: string, limit = 40): Promise<MemoryResponseDto[]> {
    const where = repoId
      ? { isActive: true, OR: [{ repoId }, { repoId: null }] }
      : { isActive: true, repoId: null };

    const memories = await this.db.agentMemory.findMany({
      where,
      orderBy: [{ confidence: 'desc' }, { createdAt: 'desc' }],
      take: limit,
    });
    return memories as MemoryResponseDto[];
  }

  /**
   * Format memories as a compact text block for injection into LLM prompts.
   */
  formatForPrompt(memories: MemoryResponseDto[]): string {
    if (memories.length === 0) return '(no memories yet)';
    return memories
      .map((m) => {
        const tags = m.tags.length > 0 ? ` [${m.tags.join(', ')}]` : '';
        const conf = m.confidence < 1 ? ` (confidence: ${m.confidence.toFixed(1)})` : '';
        return `[${m.type}]${tags} ${m.subject}: "${m.content}"${conf}`;
      })
      .join('\n');
  }
}
