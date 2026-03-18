import { Injectable } from '@nestjs/common';
import { RepoService } from '../../repo/repo.service';
import { ReadFileOutput } from './read-file.tool';
import {
  AgentToolDefinition,
  IAgentTool,
  ToolExecutionContext,
} from '../interfaces/agent-tool.interface';

export interface ReadFilesInput {
  repoId: string;
  /** Relative file paths from the repo root. */
  filePaths: string[];
}

export type ReadFileEntry = ReadFileOutput | { filePath: string; error: string };

export interface ReadFilesOutput {
  files: ReadFileEntry[];
  successCount: number;
  errorCount: number;
}

@Injectable()
export class ReadFilesTool implements IAgentTool<ReadFilesInput, ReadFilesOutput> {
  readonly name = 'read_files';
  readonly description =
    'Read the full content of multiple repository files in a single call. ' +
    'Each file is read independently — failures are reported per-file without aborting the rest.';
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
          filePaths: {
            type: 'array',
            description: 'List of relative file paths to read (max 20)',
            items: { type: 'string' },
          },
        },
        required: ['repoId', 'filePaths'],
      },
    };
  }

  async execute(input: ReadFilesInput, _context: ToolExecutionContext): Promise<ReadFilesOutput> {
    const MAX_FILES = 20;
    const paths = input.filePaths.slice(0, MAX_FILES);

    const results = await Promise.allSettled(
      paths.map((filePath) => this.repoService.readFileByPath(input.repoId, filePath)),
    );

    const files: ReadFileEntry[] = results.map((result, i) => {
      if (result.status === 'fulfilled') {
        const r = result.value;
        return {
          filePath: r.filePath,
          fileName: r.fileName,
          language: r.language,
          lineCount: r.lineCount,
          sizeBytes: r.sizeBytes,
          content: r.content,
        } satisfies ReadFileOutput;
      }
      return {
        filePath: paths[i],
        error: result.reason instanceof Error ? result.reason.message : String(result.reason),
      };
    });

    const successCount = files.filter((f) => !('error' in f)).length;

    return {
      files,
      successCount,
      errorCount: files.length - successCount,
    };
  }
}
