import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ToolsService } from './tools.service';
import { ExecuteToolDto } from './dto/execute-tool.dto';
import { ToolResultDto } from './dto/tool-result.dto';
import { AgentToolDefinition } from './interfaces/agent-tool.interface';

@Controller('api/v1/tools')
export class ToolsController {
  constructor(private readonly toolsService: ToolsService) {}

  /**
   * GET /api/v1/tools
   * List all registered tools with their JSON-schema definitions.
   * Used by the orchestrator and LLM clients to discover available tools.
   */
  @Get()
  listTools(): AgentToolDefinition[] {
    return this.toolsService.listDefinitions();
  }

  /**
   * POST /api/v1/tools/execute
   * Execute a tool by name with the provided input.
   * Returns the tool result including success flag, output, error, and duration.
   */
  @Post('execute')
  @HttpCode(HttpStatus.OK)
  async executeTool(@Body() dto: ExecuteToolDto): Promise<ToolResultDto> {
    return this.toolsService.execute(dto);
  }
}
