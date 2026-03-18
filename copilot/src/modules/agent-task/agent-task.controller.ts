import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { AgentTaskService } from './agent-task.service';
import { MemoryService } from '../memory/memory.service';
import { CreateAgentTaskDto } from './dto/create-agent-task.dto';
import { AgentTaskStatus } from '../../common/enums/agent-task-status.enum';
import { AgentMemoryType } from '../../common/enums/agent-memory-type.enum';
import { ok } from '../../common/utils/response.util';

@Controller({ path: 'agent-tasks', version: '1' })
export class AgentTaskController {
  constructor(
    private readonly taskService: AgentTaskService,
    private readonly memoryService: MemoryService,
  ) {}

  // ─── Tasks ─────────────────────────────────────────────────────────────────

  @Post()
  async createTask(@Body() dto: CreateAgentTaskDto) {
    return ok(await this.taskService.create(dto), 'Task created');
  }

  @Get()
  async listTasks(@Query('repoId') repoId?: string, @Query('status') status?: AgentTaskStatus) {
    return ok(await this.taskService.listTasks(repoId, status), 'Tasks retrieved');
  }

  @Get(':id')
  async getTask(@Param('id') id: string) {
    return ok(await this.taskService.getTask(id), 'Task retrieved');
  }

  @Post(':id/approve-plan')
  async approvePlan(@Param('id') id: string) {
    return ok(await this.taskService.approvePlan(id), 'Plan approved');
  }

  @Post(':id/resume')
  async resume(@Param('id') id: string) {
    return ok(await this.taskService.resume(id), 'Task resumed');
  }

  @Delete(':id/cancel')
  async cancel(@Param('id') id: string) {
    return ok(await this.taskService.cancel(id), 'Task cancelled');
  }

  // ─── Memories ──────────────────────────────────────────────────────────────

  @Get('memories/list')
  async listMemories(
    @Query('repoId') repoId?: string,
    @Query('type') type?: AgentMemoryType,
    @Query('tags') tags?: string,
  ) {
    const tagList = tags ? tags.split(',') : undefined;
    const data = repoId
      ? await this.memoryService.findByRepo(repoId, type, tagList)
      : await this.memoryService.findGlobal(type);
    return ok(data, 'Memories retrieved');
  }

  @Delete('memories/:id')
  async deleteMemory(@Param('id') id: string) {
    return ok(await this.memoryService.softDelete(id), 'Memory deleted');
  }
}
