import { Injectable, Logger } from '@nestjs/common';
import { runShellCommand } from '../utils/shell-executor';
import {
  AgentToolDefinition,
  IAgentTool,
  ToolExecutionContext,
} from '../interfaces/agent-tool.interface';

export interface RunCommandInput {
  /** Absolute working directory. */
  cwd: string;
  /**
   * npm lifecycle script to run.
   * "install" is handled specially: runs `npm install` (not `npm run install`).
   */
  script: string;
  /** Extra arguments appended after the script (e.g. ["--production"]). */
  args?: string[];
  /** Timeout in milliseconds. Default: 180 000. Hard max: 300 000. */
  timeoutMs?: number;
}

export interface RunCommandOutput {
  exitCode: number;
  success: boolean;
  stdout: string;
  stderr: string;
  durationMs: number;
  timedOut: boolean;
  command: string;
}

const ALLOWED_SCRIPTS = new Set<string>([
  'install',
  'build',
  'build:prod',
  'start',
  'start:dev',
  'start:debug',
  'dev',
  'preview',
  'clean',
  'format',
  'typecheck',
  'type-check',
  'compile',
  'generate',
  'prepare',
  'db:generate',
  'prisma:generate',
]);

@Injectable()
export class RunCommandTool implements IAgentTool<RunCommandInput, RunCommandOutput> {
  readonly name = 'run_command';
  readonly description =
    'Run an npm lifecycle script (install, build, start, dev, etc.) in a given directory. ' +
    'Requires human approval before execution.';
  readonly requiresApproval = true;

  private readonly logger = new Logger(RunCommandTool.name);

  getDefinition(): AgentToolDefinition {
    return {
      name: this.name,
      description: this.description,
      requiresApproval: this.requiresApproval,
      inputSchema: {
        type: 'object',
        properties: {
          cwd: { type: 'string', description: 'Absolute working directory path' },
          script: {
            type: 'string',
            description: `npm script to execute. Allowed: ${[...ALLOWED_SCRIPTS].join(', ')}`,
          },
          args: {
            type: 'array',
            description: 'Extra CLI arguments (e.g. ["--production"])',
            items: { type: 'string' },
          },
          timeoutMs: {
            type: 'number',
            description: 'Timeout in milliseconds (default: 180 000, max: 300 000)',
          },
        },
        required: ['cwd', 'script'],
      },
    };
  }

  async execute(input: RunCommandInput, _context: ToolExecutionContext): Promise<RunCommandOutput> {
    if (!ALLOWED_SCRIPTS.has(input.script)) {
      throw new Error(
        `Script "${input.script}" is not allowed. Permitted scripts: ${[...ALLOWED_SCRIPTS].join(', ')}`,
      );
    }

    const npmArgs =
      input.script === 'install'
        ? ['install', ...(input.args ?? [])]
        : ['run', input.script, ...(input.args ?? [])];

    this.logger.log(`[run_command] cwd=${input.cwd} npm ${npmArgs.join(' ')}`);

    const result = await runShellCommand({
      executable: 'npm',
      args: npmArgs,
      cwd: input.cwd,
      timeoutMs: input.timeoutMs ?? 180_000,
    });

    return {
      exitCode: result.exitCode,
      success: result.exitCode === 0 && !result.timedOut,
      stdout: result.stdout,
      stderr: result.stderr,
      durationMs: result.durationMs,
      timedOut: result.timedOut,
      command: result.command,
    };
  }
}
