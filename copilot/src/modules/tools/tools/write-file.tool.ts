import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  AgentToolDefinition,
  IAgentTool,
  ToolExecutionContext,
} from '../interfaces/agent-tool.interface';

export interface WriteFileInput {
  /** Absolute path to the base directory where the file will be written. */
  baseDir: string;
  /** Relative path from baseDir to the file (e.g. "src/index.ts"). */
  relativePath: string;
  /** File content to write. */
  content: string;
  /** If true, creates parent directories as needed. Default: true. */
  createParents?: boolean;
}

export interface WriteFileOutput {
  absolutePath: string;
  relativePath: string;
  bytesWritten: number;
  created: boolean;
}

@Injectable()
export class WriteFileTool implements IAgentTool<WriteFileInput, WriteFileOutput> {
  readonly name = 'write_file';
  readonly description =
    'Write content to a file on disk within a given base directory. ' +
    'Creates parent directories if needed. Requires human approval.';
  readonly requiresApproval = true;

  private readonly logger = new Logger(WriteFileTool.name);

  getDefinition(): AgentToolDefinition {
    return {
      name: this.name,
      description: this.description,
      requiresApproval: this.requiresApproval,
      inputSchema: {
        type: 'object',
        properties: {
          baseDir: { type: 'string', description: 'Absolute path to the base directory' },
          relativePath: {
            type: 'string',
            description: 'Relative path from baseDir to the file (e.g. "src/index.ts")',
          },
          content: { type: 'string', description: 'Full file content to write' },
          createParents: {
            type: 'boolean',
            description: 'Create parent directories if they do not exist (default: true)',
          },
        },
        required: ['baseDir', 'relativePath', 'content'],
      },
    };
  }

  async execute(input: WriteFileInput, _context: ToolExecutionContext): Promise<WriteFileOutput> {
    const resolvedBase = path.resolve(input.baseDir);
    const absolutePath = path.resolve(resolvedBase, input.relativePath);

    if (!absolutePath.startsWith(resolvedBase + path.sep) && absolutePath !== resolvedBase) {
      throw new Error(
        `Path "${input.relativePath}" resolves to "${absolutePath}" which is outside baseDir "${resolvedBase}" — rejected.`,
      );
    }

    let existed = false;
    try {
      await fs.access(absolutePath);
      existed = true;
    } catch {
      existed = false;
    }

    if (input.createParents !== false) {
      await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    }

    await fs.writeFile(absolutePath, input.content, 'utf-8');
    const bytesWritten = Buffer.byteLength(input.content, 'utf-8');

    this.logger.log(`[write_file] wrote ${bytesWritten}B → ${absolutePath} (created=${!existed})`);

    return { absolutePath, relativePath: input.relativePath, bytesWritten, created: !existed };
  }
}
