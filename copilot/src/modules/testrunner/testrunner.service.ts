import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { TestRunResultDto } from './dto/test-run-result.dto';
import { ResourceNotFoundException } from '../../common/exceptions/app.exception';
import { plainToInstance } from 'class-transformer';

export interface TestRunResultInput {
  runId?: string;
  testgenId?: string;
  repoId?: string;
  script: string;
  exitCode: number;
  passed: boolean;
  stdout: string;
  stderr: string;
  durationMs: number;
  timedOut: boolean;
  command: string;
}

@Injectable()
export class TestrunnerService {
  private readonly logger = new Logger(TestrunnerService.name);

  constructor(private readonly db: DatabaseService) {}

  async persistResult(opts: TestRunResultInput): Promise<TestRunResultDto> {
    const record = await this.db.testRunResult.create({
      data: {
        runId: opts.runId ?? null,
        testgenId: opts.testgenId ?? null,
        repoId: opts.repoId ?? null,
        script: opts.script,
        exitCode: opts.exitCode,
        passed: opts.passed,
        stdout: opts.stdout,
        stderr: opts.stderr,
        durationMs: opts.durationMs,
        timedOut: opts.timedOut,
        command: opts.command,
      },
    });

    this.logger.log(`Persisted test run result: ${record.id} passed=${record.passed}`);
    return plainToInstance(TestRunResultDto, record, { excludeExtraneousValues: true });
  }

  async findByTestgen(testgenId: string): Promise<TestRunResultDto[]> {
    const records = await this.db.testRunResult.findMany({
      where: { testgenId },
      orderBy: { createdAt: 'desc' },
    });
    return plainToInstance(TestRunResultDto, records, { excludeExtraneousValues: true });
  }

  async findOne(id: string): Promise<TestRunResultDto> {
    const record = await this.db.testRunResult.findUnique({ where: { id } });
    if (!record) throw new ResourceNotFoundException('TestRunResult', id);
    return plainToInstance(TestRunResultDto, record, { excludeExtraneousValues: true });
  }
}
