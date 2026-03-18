import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { runShellCommand } from '../utils/shell-executor';
import {
  AgentToolDefinition,
  IAgentTool,
  ToolExecutionContext,
} from '../interfaces/agent-tool.interface';

export interface ScaffoldProjectInput {
  /** Absolute path to the parent directory where the project will be created. */
  outputDir: string;
  /** Project directory name (e.g. "my-app"). */
  projectName: string;
  /**
   * npx create-* package to invoke.
   * Examples: "create-next-app", "create-react-app", "@nestjs/cli new"
   */
  template: string;
  /**
   * Optional version to pin the template package to (e.g. "5" for create-vite@5).
   * IMPORTANT: Always call check_environment first — Node 18 requires vite@5 (not @6),
   * Node 20+ can use vite@6. If omitted, the latest version is used which may be incompatible.
   */
  version?: string;
  /** Extra CLI flags for the scaffolding tool (e.g. ["--typescript", "--no-git"]). */
  extraArgs?: string[];
  /** Timeout in milliseconds. Default: 180 000. Hard max: 300 000. */
  timeoutMs?: number;
}

export interface ScaffoldProjectOutput {
  projectPath: string;
  template: string;
  exitCode: number;
  success: boolean;
  stdout: string;
  stderr: string;
  durationMs: number;
}

const ALLOWED_TEMPLATES = new Set<string>([
  'create-next-app',
  'create-react-app',
  'create-vue',
  'create-vite',
  'create-svelte',
  'create-t3-app',
  'create-remix',
  'create-astro',
  'create-nuxt-app',
  'create-expo-app',
  'create-react-native-app',
  'create-express-app',
  '@nestjs/cli',
  '@angular/cli',
]);

@Injectable()
export class ScaffoldProjectTool implements IAgentTool<ScaffoldProjectInput, ScaffoldProjectOutput> {
  readonly name = 'scaffold_project';
  readonly description =
    'Scaffold a new project using a framework CLI (e.g. create-vite, create-next-app, @nestjs/cli). ' +
    'Runs npx in the outputDir to create the project. Requires human approval. ' +
    'IMPORTANT: Call check_environment first to get the correct version for your Node.js runtime ' +
    '(e.g. Node 18 needs vite@5, not vite@6). Pass the version field to avoid incompatibility errors.';
  readonly requiresApproval = true;

  private readonly logger = new Logger(ScaffoldProjectTool.name);

  getDefinition(): AgentToolDefinition {
    return {
      name: this.name,
      description: this.description,
      requiresApproval: this.requiresApproval,
      inputSchema: {
        type: 'object',
        properties: {
          outputDir: {
            type: 'string',
            description: 'Absolute path to the parent directory for the new project',
          },
          projectName: {
            type: 'string',
            description: 'Project directory name (e.g. "my-app")',
          },
          template: {
            type: 'string',
            description: `npx create-* package. Allowed: ${[...ALLOWED_TEMPLATES].join(', ')}`,
          },
          version: {
            type: 'string',
            description:
              'Pin the template to a specific version (e.g. "5" → npx -y create-vite@5). ' +
              'Get the correct value from check_environment.viteRecommendedVersion before calling this tool.',
          },
          extraArgs: {
            type: 'array',
            description: 'Extra CLI flags (e.g. ["--typescript", "--no-git"])',
            items: { type: 'string' },
          },
          timeoutMs: {
            type: 'number',
            description: 'Timeout in milliseconds (default: 180 000, max: 300 000)',
          },
        },
        required: ['outputDir', 'projectName', 'template'],
      },
    };
  }

  async execute(
    input: ScaffoldProjectInput,
    _context: ToolExecutionContext,
  ): Promise<ScaffoldProjectOutput> {
    if (!ALLOWED_TEMPLATES.has(input.template)) {
      throw new Error(
        `Template "${input.template}" is not in the allowlist. ` +
          `Allowed templates: ${[...ALLOWED_TEMPLATES].join(', ')}`,
      );
    }

    await fs.mkdir(input.outputDir, { recursive: true });

    const projectPath = path.join(input.outputDir, input.projectName);

    // npx -y <template>[@version] <projectName> [...extraArgs]
    const templateWithVersion = input.version
      ? `${input.template}@${input.version}`
      : input.template;
    const args = ['-y', templateWithVersion, input.projectName, ...(input.extraArgs ?? [])];

    this.logger.log(`[scaffold_project] npx ${args.join(' ')} in "${input.outputDir}"`);

    const result = await runShellCommand({
      executable: 'npx',
      args,
      cwd: input.outputDir,
      timeoutMs: input.timeoutMs ?? 180_000,
    });

    return {
      projectPath,
      template: input.template,
      exitCode: result.exitCode,
      success: result.exitCode === 0 && !result.timedOut,
      stdout: result.stdout,
      stderr: result.stderr,
      durationMs: result.durationMs,
    };
  }
}
