import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { LlmService } from '../llm/llm.service';
import { GenerateTestsDto } from './dto/generate-tests.dto';
import { TestgenResponseDto } from './dto/testgen-response.dto';
import { GenerateTestsOutput } from '../llm/schemas/generate-tests.schema';
import { ResourceNotFoundException } from '../../common/exceptions/app.exception';
import { plainToInstance } from 'class-transformer';

@Injectable()
export class TestgenService {
  private readonly logger = new Logger(TestgenService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly llm: LlmService,
  ) {}

  /**
   * Direct generation — reads source content from the DTO, calls the LLM,
   * and persists the result.  Used by the `POST /api/v1/testgen` endpoint.
   */
  async generate(dto: GenerateTestsDto): Promise<TestgenResponseDto> {
    this.logger.log(`generate: targetFile=${dto.targetFile}`);

    const llmOutput = await this.llm.generateTests({
      filePath: dto.targetFile,
      content: dto.sourceContent,
      framework: dto.framework,
    });

    return this.persistGenerated({
      repoId: dto.repoId,
      runId: dto.runId,
      targetFile: dto.targetFile,
      llmOutput,
    });
  }

  /**
   * Persist an already-generated test result (used by the agent orchestrator).
   * The orchestrator manages the LLM call and step logging itself; this method
   * only handles DB persistence and DTO mapping.
   */
  async persistOrchestrated(opts: {
    repoId: string | undefined;
    runId: string | undefined;
    targetFile: string;
    llmOutput: GenerateTestsOutput;
  }): Promise<TestgenResponseDto> {
    return this.persistGenerated(opts);
  }

  async findByRepo(repoId: string): Promise<TestgenResponseDto[]> {
    const records = await this.db.generatedTest.findMany({
      where: { repoId },
      orderBy: { createdAt: 'desc' },
    });
    return plainToInstance(TestgenResponseDto, records, { excludeExtraneousValues: true });
  }

  async findOne(id: string): Promise<TestgenResponseDto> {
    const record = await this.db.generatedTest.findUnique({ where: { id } });
    if (!record) throw new ResourceNotFoundException('GeneratedTest', id);
    return plainToInstance(TestgenResponseDto, record, { excludeExtraneousValues: true });
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private async persistGenerated(opts: {
    repoId?: string;
    runId?: string;
    targetFile: string;
    llmOutput: GenerateTestsOutput;
  }): Promise<TestgenResponseDto> {
    const record = await this.db.generatedTest.create({
      data: {
        targetFile: opts.targetFile,
        testFile: opts.llmOutput.testFile,
        content: opts.llmOutput.content,
        framework: opts.llmOutput.framework,
        runId: opts.runId ?? null,
        repoId: opts.repoId ?? null,
      },
    });

    this.logger.log(`Persisted generated test: ${record.id} → ${record.testFile}`);
    return plainToInstance(TestgenResponseDto, record, { excludeExtraneousValues: true });
  }
}
