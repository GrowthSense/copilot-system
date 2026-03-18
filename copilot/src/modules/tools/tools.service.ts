import { Injectable } from '@nestjs/common';
import { ToolsRegistry } from './tools.registry';
import { ToolsExecutor } from './tools.executor';
import { ExecuteToolDto } from './dto/execute-tool.dto';
import { ToolResultDto } from './dto/tool-result.dto';
import { AgentToolDefinition } from './interfaces/agent-tool.interface';

@Injectable()
export class ToolsService {
  constructor(
    private readonly registry: ToolsRegistry,
    private readonly executor: ToolsExecutor,
  ) {}

  /** Return definitions for all registered tools (used by the list endpoint and LLM clients). */
  listDefinitions(): AgentToolDefinition[] {
    return this.registry.getAllDefinitions();
  }

  /** Execute a tool by name, forwarding input and the optional run context for audit logging. */
  async execute(dto: ExecuteToolDto): Promise<ToolResultDto> {
    const result = await this.executor.execute(dto.toolName, dto.input, {
      runId: dto.runId,
      stepId: dto.stepId,
    });

    return {
      toolName: result.toolName,
      success: result.success,
      output: result.output,
      error: result.error,
      durationMs: result.durationMs,
      requiresApproval: result.requiresApproval,
    };
  }
}
