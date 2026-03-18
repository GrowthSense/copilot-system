import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { ReviewCodeOutput } from '../llm/schemas/review-code.schema';
import { ReviewResponseDto } from './dto/review-response.dto';
import { ResourceNotFoundException } from '../../common/exceptions/app.exception';
import { plainToInstance } from 'class-transformer';

@Injectable()
export class ReviewService {
  private readonly logger = new Logger(ReviewService.name);

  constructor(private readonly db: DatabaseService) {}

  async persistOrchestrated(opts: {
    repoId: string | undefined;
    runId: string | undefined;
    filePath: string;
    llmOutput: ReviewCodeOutput;
  }): Promise<ReviewResponseDto> {
    const record = await this.db.codeReview.create({
      data: {
        filePath: opts.filePath,
        summary: opts.llmOutput.summary,
        overallRisk: opts.llmOutput.overallRisk,
        findings: opts.llmOutput.findings as object[],
        positives: opts.llmOutput.positives,
        testingRecs: opts.llmOutput.testingRecommendations,
        runId: opts.runId ?? null,
        repoId: opts.repoId ?? null,
      },
    });

    this.logger.log(`Persisted code review: ${record.id} for ${record.filePath}`);
    return this.toDto(record);
  }

  async findByRepo(repoId: string): Promise<ReviewResponseDto[]> {
    const records = await this.db.codeReview.findMany({
      where: { repoId },
      orderBy: { createdAt: 'desc' },
    });
    return records.map((r) => this.toDto(r));
  }

  async findOne(id: string): Promise<ReviewResponseDto> {
    const record = await this.db.codeReview.findUnique({ where: { id } });
    if (!record) throw new ResourceNotFoundException('CodeReview', id);
    return this.toDto(record);
  }

  private toDto(record: {
    id: string;
    runId: string | null;
    repoId: string | null;
    filePath: string;
    summary: string;
    overallRisk: string;
    findings: unknown;
    positives: unknown;
    testingRecs: unknown;
    createdAt: Date;
    updatedAt: Date;
  }): ReviewResponseDto {
    return plainToInstance(ReviewResponseDto, {
      ...record,
      findings: Array.isArray(record.findings) ? record.findings : [],
      positives: Array.isArray(record.positives) ? record.positives : [],
      testingRecs: Array.isArray(record.testingRecs) ? record.testingRecs : [],
    }, { excludeExtraneousValues: true });
  }
}
