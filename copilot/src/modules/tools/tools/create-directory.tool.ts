import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import {
  AgentToolDefinition,
  IAgentTool,
  ToolExecutionContext,
} from '../interfaces/agent-tool.interface';

export interface CreateDirectoryInput {
  /** Absolute path of the directory to create. */
  absolutePath: string;
  /** Create parent directories as needed. Default: true. */
  recursive?: boolean;
}

export interface CreateDirectoryOutput {
  absolutePath: string;
  created: boolean;
}

@Injectable()
export class CreateDirectoryTool implements IAgentTool<CreateDirectoryInput, CreateDirectoryOutput> {
  readonly name = 'create_directory';
  readonly description =
    'Create a directory (and optionally its parents) on disk. Requires human approval.';
  readonly requiresApproval = true;

  private readonly logger = new Logger(CreateDirectoryTool.name);

  getDefinition(): AgentToolDefinition {
    return {
      name: this.name,
      description: this.description,
      requiresApproval: this.requiresApproval,
      inputSchema: {
        type: 'object',
        properties: {
          absolutePath: {
            type: 'string',
            description: 'Absolute path of the directory to create',
          },
          recursive: {
            type: 'boolean',
            description: 'Create parent directories as needed (default: true)',
          },
        },
        required: ['absolutePath'],
      },
    };
  }

  async execute(
    input: CreateDirectoryInput,
    _context: ToolExecutionContext,
  ): Promise<CreateDirectoryOutput> {
    const recursive = input.recursive !== false;

    let alreadyExists = false;
    try {
      await fs.access(input.absolutePath);
      alreadyExists = true;
    } catch {
      alreadyExists = false;
    }

    await fs.mkdir(input.absolutePath, { recursive });
    this.logger.log(`[create_directory] ensured: ${input.absolutePath} (created=${!alreadyExists})`);

    return { absolutePath: input.absolutePath, created: !alreadyExists };
  }
}
