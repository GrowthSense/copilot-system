import { Injectable } from '@nestjs/common';
import { generateUnifiedDiff, DiffResult } from '../utils/diff-generator';
import {
  AgentToolDefinition,
  IAgentTool,
  ToolExecutionContext,
} from '../interfaces/agent-tool.interface';

export interface GenerateDiffInput {
  originalContent: string;
  modifiedContent: string;
  /** Optional file path shown in the diff header (e.g. "src/app.ts"). */
  filePath?: string;
  /** Number of unchanged context lines around each change. Default: 3. */
  contextLines?: number;
}

export interface GenerateDiffOutput {
  diff: string;
  linesAdded: number;
  linesRemoved: number;
  isEmpty: boolean;
}

@Injectable()
export class GenerateDiffTool implements IAgentTool<GenerateDiffInput, GenerateDiffOutput> {
  readonly name = 'generate_diff';
  readonly description =
    'Generate a unified diff between original and modified file contents. ' +
    'Returns a standard `diff -u` style patch string with added/removed line counts.';
  readonly requiresApproval = false;

  getDefinition(): AgentToolDefinition {
    return {
      name: this.name,
      description: this.description,
      requiresApproval: this.requiresApproval,
      inputSchema: {
        type: 'object',
        properties: {
          originalContent: {
            type: 'string',
            description: 'The original file content (before the change)',
          },
          modifiedContent: {
            type: 'string',
            description: 'The modified file content (after the change)',
          },
          filePath: {
            type: 'string',
            description: 'File path shown in the diff header (e.g. "src/app.ts")',
          },
          contextLines: {
            type: 'number',
            description: 'Number of unchanged lines of context around each hunk (default: 3)',
          },
        },
        required: ['originalContent', 'modifiedContent'],
      },
    };
  }

  async execute(
    input: GenerateDiffInput,
    _context: ToolExecutionContext,
  ): Promise<GenerateDiffOutput> {
    const result: DiffResult = generateUnifiedDiff(
      input.originalContent,
      input.modifiedContent,
      input.filePath ?? 'file',
      input.contextLines ?? 3,
    );

    return {
      diff: result.diff,
      linesAdded: result.linesAdded,
      linesRemoved: result.linesRemoved,
      isEmpty: result.isEmpty,
    };
  }
}
