import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreateRunDto } from './dto/create-run.dto';
import { AppendStepDto } from './dto/append-step.dto';
import { CompleteStepDto } from './dto/complete-step.dto';
import { FailStepDto } from './dto/fail-step.dto';
import { RecordToolExecutionDto } from './dto/record-tool-execution.dto';
import { RunResponseDto } from './dto/run-response.dto';
import { RunDetailResponseDto } from './dto/run-detail-response.dto';
import { StepResponseDto } from './dto/step-response.dto';
import { ToolExecutionResponseDto } from './dto/tool-execution-response.dto';
import { RunStatus } from '../../common/enums/run-status.enum';
import { StepStatus } from '../../common/enums/step-status.enum';
import {
  ResourceNotFoundException,
  ValidationException,
} from '../../common/exceptions/app.exception';
import { isTerminalRunStatus, isValidRunTransition } from './interfaces/status-transition.interface';
import { plainToInstance } from 'class-transformer';
import { Prisma } from '@prisma/client';

@Injectable()
export class RunsService {
  private readonly logger = new Logger(RunsService.name);

  constructor(private readonly db: DatabaseService) {}

  // ─── Run lifecycle ──────────────────────────────────────────────────────────

  async create(dto: CreateRunDto): Promise<RunResponseDto> {
    const run = await this.db.agentRun.create({
      data: {
        type: dto.type,
        status: RunStatus.PENDING,
        repoId: dto.repoId || null,
        input: dto.input as Prisma.InputJsonValue,
      },
    });
    this.logger.log(`Run created: ${run.id} [${run.type}]`);
    return plainToInstance(RunResponseDto, run, { excludeExtraneousValues: true });
  }

  async findAll(limit = 50): Promise<RunResponseDto[]> {
    const runs = await this.db.agentRun.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return plainToInstance(RunResponseDto, runs, { excludeExtraneousValues: true });
  }

  async findOne(id: string): Promise<RunResponseDto> {
    const run = await this.db.agentRun.findUnique({ where: { id } });
    if (!run) throw new ResourceNotFoundException('Run', id);
    return plainToInstance(RunResponseDto, run, { excludeExtraneousValues: true });
  }

  async findOneWithSteps(id: string): Promise<RunDetailResponseDto> {
    const run = await this.db.agentRun.findUnique({
      where: { id },
      include: {
        steps: { orderBy: { stepIndex: 'asc' } },
      },
    });
    if (!run) throw new ResourceNotFoundException('Run', id);
    return plainToInstance(RunDetailResponseDto, run, { excludeExtraneousValues: true });
  }

  async markRunning(id: string): Promise<RunResponseDto> {
    const run = await this.db.agentRun.findUnique({ where: { id } });
    if (!run) throw new ResourceNotFoundException('Run', id);
    this.assertValidTransition(String(run.status), RunStatus.RUNNING);

    const updated = await this.db.agentRun.update({
      where: { id },
      data: { status: RunStatus.RUNNING, startedAt: new Date() },
    });
    return plainToInstance(RunResponseDto, updated, { excludeExtraneousValues: true });
  }

  async complete(
    id: string,
    output: Record<string, unknown>,
    durationMs: number,
    tokenUsage?: { promptTokens?: number; completionTokens?: number },
  ): Promise<RunResponseDto> {
    const run = await this.db.agentRun.findUnique({ where: { id } });
    if (!run) throw new ResourceNotFoundException('Run', id);
    this.assertValidTransition(String(run.status), RunStatus.COMPLETED);

    const updated = await this.db.agentRun.update({
      where: { id },
      data: {
        status: RunStatus.COMPLETED,
        output: output as Prisma.InputJsonValue,
        durationMs,
        completedAt: new Date(),
        promptTokens: tokenUsage?.promptTokens ?? null,
        completionTokens: tokenUsage?.completionTokens ?? null,
      },
    });
    return plainToInstance(RunResponseDto, updated, { excludeExtraneousValues: true });
  }

  async storeAnswer(id: string, answer: string): Promise<RunResponseDto> {
    return this.complete(id, { answer }, 0);
  }

  async fail(id: string, error: string, durationMs?: number): Promise<RunResponseDto> {
    const run = await this.db.agentRun.findUnique({ where: { id } });
    if (!run) throw new ResourceNotFoundException('Run', id);
    this.assertValidTransition(String(run.status), RunStatus.FAILED);

    const updated = await this.db.agentRun.update({
      where: { id },
      data: {
        status: RunStatus.FAILED,
        error,
        durationMs: durationMs ?? null,
        completedAt: new Date(),
      },
    });
    return plainToInstance(RunResponseDto, updated, { excludeExtraneousValues: true });
  }

  async cancel(id: string): Promise<RunResponseDto> {
    const run = await this.db.agentRun.findUnique({ where: { id } });
    if (!run) throw new ResourceNotFoundException('Run', id);
    this.assertValidTransition(String(run.status), RunStatus.CANCELLED);

    const updated = await this.db.agentRun.update({
      where: { id },
      data: { status: RunStatus.CANCELLED, completedAt: new Date() },
    });
    return plainToInstance(RunResponseDto, updated, { excludeExtraneousValues: true });
  }

  // ─── Step management ────────────────────────────────────────────────────────

  async appendStep(runId: string, dto: AppendStepDto): Promise<StepResponseDto> {
    const run = await this.db.agentRun.findUnique({ where: { id: runId } });
    if (!run) throw new ResourceNotFoundException('Run', runId);
    if (isTerminalRunStatus(run.status)) {
      throw new ValidationException(
        `Cannot append a step to a run in terminal status "${run.status}"`,
      );
    }

    const step = await this.db.agentRunStep.create({
      data: {
        runId,
        stepIndex: dto.stepIndex,
        type: dto.type,
        status: StepStatus.PENDING,
        stageName: dto.stageName ?? null,
        toolName: dto.toolName ?? null,
        input: dto.input != null ? (dto.input as Prisma.InputJsonValue) : Prisma.JsonNull,
      },
    });
    return plainToInstance(StepResponseDto, step, { excludeExtraneousValues: true });
  }

  async startStep(stepId: string): Promise<StepResponseDto> {
    const step = await this.db.agentRunStep.findUnique({ where: { id: stepId } });
    if (!step) throw new ResourceNotFoundException('AgentRunStep', stepId);
    if (step.status !== StepStatus.PENDING) {
      throw new ValidationException(
        `Step "${stepId}" cannot be started from status "${step.status}"`,
      );
    }

    const updated = await this.db.agentRunStep.update({
      where: { id: stepId },
      data: { status: StepStatus.RUNNING, startedAt: new Date() },
    });
    return plainToInstance(StepResponseDto, updated, { excludeExtraneousValues: true });
  }

  async completeStep(stepId: string, dto: CompleteStepDto): Promise<StepResponseDto> {
    const step = await this.db.agentRunStep.findUnique({ where: { id: stepId } });
    if (!step) throw new ResourceNotFoundException('AgentRunStep', stepId);
    if (step.status !== StepStatus.RUNNING) {
      throw new ValidationException(
        `Step "${stepId}" cannot be completed from status "${step.status}"`,
      );
    }

    const updated = await this.db.agentRunStep.update({
      where: { id: stepId },
      data: {
        status: StepStatus.COMPLETED,
        output: dto.output != null ? (dto.output as Prisma.InputJsonValue) : Prisma.JsonNull,
        resultSummary: dto.resultSummary ?? null,
        durationMs: dto.durationMs,
        completedAt: new Date(),
      },
    });
    return plainToInstance(StepResponseDto, updated, { excludeExtraneousValues: true });
  }

  async failStep(stepId: string, dto: FailStepDto): Promise<StepResponseDto> {
    const step = await this.db.agentRunStep.findUnique({ where: { id: stepId } });
    if (!step) throw new ResourceNotFoundException('AgentRunStep', stepId);
    if (step.status === StepStatus.COMPLETED || step.status === StepStatus.FAILED) {
      throw new ValidationException(
        `Step "${stepId}" is already in terminal status "${step.status}"`,
      );
    }

    const updated = await this.db.agentRunStep.update({
      where: { id: stepId },
      data: {
        status: StepStatus.FAILED,
        error: dto.error,
        durationMs: dto.durationMs ?? null,
        completedAt: new Date(),
      },
    });
    return plainToInstance(StepResponseDto, updated, { excludeExtraneousValues: true });
  }

  async listSteps(runId: string): Promise<StepResponseDto[]> {
    const run = await this.db.agentRun.findUnique({ where: { id: runId } });
    if (!run) throw new ResourceNotFoundException('Run', runId);

    const steps = await this.db.agentRunStep.findMany({
      where: { runId },
      orderBy: { stepIndex: 'asc' },
    });
    return plainToInstance(StepResponseDto, steps, { excludeExtraneousValues: true });
  }

  // ─── Tool executions ────────────────────────────────────────────────────────

  async recordToolExecution(
    runId: string,
    dto: RecordToolExecutionDto,
  ): Promise<ToolExecutionResponseDto> {
    const run = await this.db.agentRun.findUnique({ where: { id: runId } });
    if (!run) throw new ResourceNotFoundException('Run', runId);

    const execution = await this.db.toolExecution.create({
      data: {
        runId,
        stepId: dto.stepId ?? null,
        toolName: dto.toolName,
        parameters: dto.parameters as Prisma.InputJsonValue,
        result: dto.result != null ? (dto.result as Prisma.InputJsonValue) : Prisma.JsonNull,
        error: dto.error ?? null,
        isSuccess: dto.isSuccess,
        durationMs: dto.durationMs ?? null,
        completedAt: new Date(),
      },
    });
    return plainToInstance(ToolExecutionResponseDto, execution, {
      excludeExtraneousValues: true,
    });
  }

  async listToolExecutions(runId: string): Promise<ToolExecutionResponseDto[]> {
    const run = await this.db.agentRun.findUnique({ where: { id: runId } });
    if (!run) throw new ResourceNotFoundException('Run', runId);

    const executions = await this.db.toolExecution.findMany({
      where: { runId },
      orderBy: { createdAt: 'asc' },
    });
    return plainToInstance(ToolExecutionResponseDto, executions, {
      excludeExtraneousValues: true,
    });
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private assertValidTransition(from: string, to: string): void {
    if (!isValidRunTransition(from, to)) {
      throw new ValidationException(
        `Invalid run status transition: "${from}" → "${to}"`,
      );
    }
  }
}
