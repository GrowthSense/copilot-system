import { Injectable } from '@nestjs/common';
import { RepoService } from '../../repo/repo.service';
import {
  AgentToolDefinition,
  IAgentTool,
  ToolExecutionContext,
} from '../interfaces/agent-tool.interface';

export interface ReadFileInput {
  repoId: string;
  /** Relative path from the repo root (forward slashes). */
  filePath: string;
}

export interface ReadFileOutput {
  filePath: string;
  fileName: string;
  language: string | null;
  lineCount: number;
  sizeBytes: number;
  content: string;
}

@Injectable()
export class ReadFileTool implements IAgentTool<ReadFileInput, ReadFileOutput> {
  readonly name = 'read_file';
  readonly description =
    'Read the full content of a single file from the repository by its relative path. ' +
    'Returns the live on-disk content — reflects any edits made since the last index.';
  readonly requiresApproval = false;

  constructor(private readonly repoService: RepoService) {}

  getDefinition(): AgentToolDefinition {
    return {
      name: this.name,
      description: this.description,
      requiresApproval: this.requiresApproval,
      inputSchema: {
        type: 'object',
        properties: {
          repoId: { type: 'string', description: 'Repository ID' },
          filePath: {
            type: 'string',
            description: 'Relative file path from the repo root (e.g. "src/app.module.ts")',
          },
        },
        required: ['repoId', 'filePath'],
      },
    };
  }

  async execute(input: ReadFileInput, _context: ToolExecutionContext): Promise<ReadFileOutput> {
    const result = await this.repoService.readFileByPath(input.repoId, input.filePath);
    return {
      filePath: result.filePath,
      fileName: result.fileName,
      language: result.language,
      lineCount: result.lineCount,
      sizeBytes: result.sizeBytes,
      content: result.content,
    };
  }
}
