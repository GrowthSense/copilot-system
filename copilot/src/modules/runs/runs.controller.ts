import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { RunsService } from './runs.service';
import { CreateRunDto } from './dto/create-run.dto';
import { AppendStepDto } from './dto/append-step.dto';
import { CompleteStepDto } from './dto/complete-step.dto';
import { FailStepDto } from './dto/fail-step.dto';
import { RecordToolExecutionDto } from './dto/record-tool-execution.dto';
import { ok, created } from '../../common/utils/response.util';

@Controller({ path: 'runs', version: '1' })
export class RunsController {
  constructor(private readonly runsService: RunsService) {}

  // ─── Runs ──────────────────────────────────────────────────────────────────

  @Post()
  async create(@Body() dto: CreateRunDto) {
    const run = await this.runsService.create(dto);
    return created(run, 'Run created');
  }

  @Get()
  async findAll() {
    const runs = await this.runsService.findAll();
    return ok(runs, 'Runs retrieved');
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const run = await this.runsService.findOneWithSteps(id);
    return ok(run, 'Run retrieved');
  }

  @Patch(':id/start')
  async markRunning(@Param('id') id: string) {
    const run = await this.runsService.markRunning(id);
    return ok(run, 'Run marked as running');
  }

  @Patch(':id/cancel')
  async cancel(@Param('id') id: string) {
    const run = await this.runsService.cancel(id);
    return ok(run, 'Run cancelled');
  }

  // ─── Steps ────────────────────────────────────────────────────────────────

  @Post(':id/steps')
  async appendStep(@Param('id') id: string, @Body() dto: AppendStepDto) {
    const step = await this.runsService.appendStep(id, dto);
    return created(step, 'Step appended');
  }

  @Get(':id/steps')
  async listSteps(@Param('id') id: string) {
    const steps = await this.runsService.listSteps(id);
    return ok(steps, 'Steps retrieved');
  }

  @Patch(':id/steps/:stepId/start')
  async startStep(@Param('stepId') stepId: string) {
    const step = await this.runsService.startStep(stepId);
    return ok(step, 'Step started');
  }

  @Patch(':id/steps/:stepId/complete')
  async completeStep(@Param('stepId') stepId: string, @Body() dto: CompleteStepDto) {
    const step = await this.runsService.completeStep(stepId, dto);
    return ok(step, 'Step completed');
  }

  @Patch(':id/steps/:stepId/fail')
  async failStep(@Param('stepId') stepId: string, @Body() dto: FailStepDto) {
    const step = await this.runsService.failStep(stepId, dto);
    return ok(step, 'Step failed');
  }

  // ─── Tool executions ──────────────────────────────────────────────────────

  @Post(':id/tool-executions')
  async recordToolExecution(
    @Param('id') id: string,
    @Body() dto: RecordToolExecutionDto,
  ) {
    const execution = await this.runsService.recordToolExecution(id, dto);
    return created(execution, 'Tool execution recorded');
  }

  @Get(':id/tool-executions')
  async listToolExecutions(@Param('id') id: string) {
    const executions = await this.runsService.listToolExecutions(id);
    return ok(executions, 'Tool executions retrieved');
  }
}
