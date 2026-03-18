import { Injectable, Logger } from '@nestjs/common';
import * as path from 'path';
import { DatabaseService } from '../../database/database.service';
import { runShellCommand, assertWithinRepoRoot } from '../utils/shell-executor';
import {
  AgentToolDefinition,
  IAgentTool,
  ToolExecutionContext,
} from '../interfaces/agent-tool.interface';

export interface RunLintInput {
  repoId: string;
  /**
   * npm script to run. Must be one of the allowed scripts.
   * Default: "lint"
   */
  script?: 'lint' | 'lint:fix';
  /** Optional sub-directory within the repo to run from (e.g. "packages/api"). */
  subDirectory?: string;
  /** Timeout in milliseconds. Default: 120 000. Hard max: 300 000. */
  timeoutMs?: number;
}

export interface RunLintOutput {
  exitCode: number;
  passed: boolean;
  stdout: string;
  stderr: string;
  durationMs: number;
  timedOut: boolean;
  command: string;
}

const ALLOWED_SCRIPTS = new Set<string>(['lint', 'lint:fix']);

@Injectable()
export class RunLintTool implements IAgentTool<RunLintInput, RunLintOutput> {
  readonly name = 'run_lint';
  readonly description =
    'Run the project linter using npm (lint | lint:fix). ' +
    'Returns stdout, stderr, exit code, and whether linting passed. ' +
    'Requires human approval before execution.';
  readonly requiresApproval = true;

  private readonly logger = new Logger(RunLintTool.name);

  constructor(private readonly db: DatabaseService) {}

  getDefinition(): AgentToolDefinition {
    return {
      name: this.name,
      description: this.description,
      requiresApproval: this.requiresApproval,
      inputSchema: {
        type: 'object',
        properties: {
          repoId: { type: 'string', description: 'Repository ID' },
          script: {
            type: 'string',
            description: 'npm script to run (default: "lint")',
            enum: ['lint', 'lint:fix'],
          },
          subDirectory: {
            type: 'string',
            description:
              'Sub-directory within the repo root to run the command from (e.g. "packages/api")',
          },
          timeoutMs: {
            type: 'number',
            description: 'Timeout in milliseconds (default: 120 000, max: 300 000)',
          },
        },
        required: ['repoId'],
      },
    };
  }

  async execute(input: RunLintInput, _context: ToolExecutionContext): Promise<RunLintOutput> {
    const script = input.script ?? 'lint';

    if (!ALLOWED_SCRIPTS.has(script)) {
      throw new Error(
        `Script "${script}" is not allowed. Permitted values: ${[...ALLOWED_SCRIPTS].join(', ')}`,
      );
    }

    const repoRoot = await this.resolveRepoRoot(input.repoId);
    const cwd = input.subDirectory
      ? path.join(repoRoot, input.subDirectory)
      : repoRoot;

    assertWithinRepoRoot(cwd, repoRoot);

    this.logger.log(`[run_lint] repo=${input.repoId} cwd=${cwd} script=${script}`);

    const result = await runShellCommand({
      executable: 'npm',
      args: ['run', script],
      cwd,
      timeoutMs: input.timeoutMs,
    });

    return {
      exitCode: result.exitCode,
      passed: result.exitCode === 0 && !result.timedOut,
      stdout: result.stdout,
      stderr: result.stderr,
      durationMs: result.durationMs,
      timedOut: result.timedOut,
      command: result.command,
    };
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private async resolveRepoRoot(repoId: string): Promise<string> {
    const index = await this.db.repoIndex.findFirst({
      where: { repoId, status: 'COMPLETED' },
      orderBy: { createdAt: 'desc' },
      select: { localPath: true },
    });

    if (!index?.localPath) {
      throw new Error(
        `No completed index found for repo "${repoId}". ` +
          `Run POST /api/v1/repos/${repoId}/indexes first.`,
      );
    }

    return index.localPath;
  }
}
