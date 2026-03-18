import { Injectable } from '@nestjs/common';
import { AgentLoopOrchestrator } from './agent-loop.orchestrator';
import { CreateAgentTaskDto } from './dto/create-agent-task.dto';
import { AgentTaskResponseDto } from './dto/agent-task-response.dto';
import { AgentTaskStatus } from '../../common/enums/agent-task-status.enum';

@Injectable()
export class AgentTaskService {
  constructor(private readonly orchestrator: AgentLoopOrchestrator) {}

  create(dto: CreateAgentTaskDto): Promise<AgentTaskResponseDto> {
    return this.orchestrator.createTask(dto);
  }

  approvePlan(taskId: string): Promise<AgentTaskResponseDto> {
    return this.orchestrator.approvePlan(taskId);
  }

  resume(taskId: string): Promise<AgentTaskResponseDto> {
    return this.orchestrator.resume(taskId);
  }

  cancel(taskId: string): Promise<AgentTaskResponseDto> {
    return this.orchestrator.cancel(taskId);
  }

  getTask(taskId: string): Promise<AgentTaskResponseDto> {
    return this.orchestrator.getTask(taskId);
  }

  listTasks(repoId?: string, status?: AgentTaskStatus): Promise<AgentTaskResponseDto[]> {
    return this.orchestrator.listTasks(repoId, status);
  }
}
