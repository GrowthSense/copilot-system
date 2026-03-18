import { Injectable, Logger } from '@nestjs/common';
import { ChatOrchestrator } from './chat.orchestrator';
import { ChatMemoryService } from './chat.memory.service';
import { RunsService } from '../runs/runs.service';
import { RepoService } from '../repo/repo.service';
import { RunType } from '../../common/enums/run-type.enum';
import { ChatRequestDto, ChatResponseDto } from './dto/chat.dto';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly orchestrator: ChatOrchestrator,
    private readonly memory: ChatMemoryService,
    private readonly runsService: RunsService,
    private readonly repoService: RepoService,
  ) {}

  async chat(dto: ChatRequestDto, userId?: string): Promise<ChatResponseDto> {
    const start = Date.now();

    const run = await this.runsService.create({
      type: RunType.CHAT,
      repoId: dto.repoId,
      input: { sessionId: dto.sessionId, messageLength: dto.message.length },
    });

    await this.runsService.markRunning(run.id);

    try {
      const repo = await this.repoService.findOne(dto.repoId);

      // Ensure the session row exists before writing messages.
      await this.memory.ensureSession(dto.sessionId, dto.repoId, userId);

      // Run the orchestrator FIRST so getContextWindow only sees previous turns.
      // Persisting the user message beforehand would duplicate it in the LLM prompt.
      const result = await this.orchestrator.chat(
        dto.sessionId,
        dto.repoId,
        dto.message,
        repo.fullName,
      );

      // Persist both turns after the reply so history is consistent.
      await this.memory.addMessage(dto.sessionId, 'user', dto.message);
      await this.memory.addMessage(dto.sessionId, 'assistant', result.reply);

      const durationMs = Date.now() - start;

      await this.runsService.complete(
        run.id,
        {
          sessionId: dto.sessionId,
          replyLength: result.reply.length,
          relevantFiles: result.relevantFiles,
          sources: result.sources,
        },
        durationMs,
      );

      this.logger.log(
        `[ChatService] sessionId="${dto.sessionId}" runId=${run.id} durationMs=${durationMs}`,
      );

      return {
        reply: result.reply,
        relevantFiles: result.relevantFiles,
        sources: result.sources,
        runId: run.id,
        sessionId: dto.sessionId,
        durationMs,
        agentAction: result.agentAction,
      };
    } catch (err: unknown) {
      const durationMs = Date.now() - start;
      const message = err instanceof Error ? err.message : String(err);
      await this.runsService.fail(run.id, message, durationMs);
      this.logger.error(`[ChatService] sessionId="${dto.sessionId}" runId=${run.id} FAILED: ${message}`);
      throw err;
    }
  }
}
