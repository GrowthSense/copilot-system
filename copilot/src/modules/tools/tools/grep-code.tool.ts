import { Injectable, Logger } from '@nestjs/common';
import { spawn } from 'child_process';
import * as path from 'path';
import { DatabaseService } from '../../database/database.service';
import {
  AgentToolDefinition,
  IAgentTool,
  ToolExecutionContext,
} from '../interfaces/agent-tool.interface';

export interface GrepCodeInput {
  repoId: string;
  /** Regex pattern or literal string to search for. */
  pattern: string;
  /** Optional glob to restrict which files are searched, e.g. "*.ts". */
  fileGlob?: string;
  /** Case-insensitive matching. Default: false. */
  ignoreCase?: boolean;
  /** Maximum number of matches to return. Default: 100, hard max: 500. */
  maxMatches?: number;
}

export interface GrepMatch {
  filePath: string;
  lineNumber: number;
  lineContent: string;
}

export interface GrepCodeOutput {
  matches: GrepMatch[];
  totalMatches: number;
  /** True when results were cut off at maxMatches. */
  truncated: boolean;
  pattern: string;
}

const DEFAULT_MAX_MATCHES = 100;
const HARD_MAX_MATCHES = 500;
const GREP_TIMEOUT_MS = 30_000;
const MAX_GREP_OUTPUT_BYTES = 512 * 1024;

@Injectable()
export class GrepCodeTool implements IAgentTool<GrepCodeInput, GrepCodeOutput> {
  readonly name = 'grep_code';
  readonly description =
    'Search for a regex pattern or literal string across all indexed source files in a repository. ' +
    'Returns matching lines with file path and line number.';
  readonly requiresApproval = false;

  private readonly logger = new Logger(GrepCodeTool.name);

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
          pattern: { type: 'string', description: 'Regex or literal search pattern' },
          fileGlob: {
            type: 'string',
            description: 'Restrict search to files matching this glob, e.g. "*.ts"',
          },
          ignoreCase: {
            type: 'boolean',
            description: 'Case-insensitive search (default: false)',
          },
          maxMatches: {
            type: 'number',
            description: `Maximum matches to return (default: ${DEFAULT_MAX_MATCHES}, max: ${HARD_MAX_MATCHES})`,
          },
        },
        required: ['repoId', 'pattern'],
      },
    };
  }

  async execute(input: GrepCodeInput, _context: ToolExecutionContext): Promise<GrepCodeOutput> {
    const localPath = await this.resolveLocalPath(input.repoId);

    if (!localPath) {
      throw new Error(
        `No completed index found for repo "${input.repoId}". ` +
          `Run POST /api/v1/repos/${input.repoId}/indexes first.`,
      );
    }

    const maxMatches = Math.min(input.maxMatches ?? DEFAULT_MAX_MATCHES, HARD_MAX_MATCHES);
    const rawMatches = await this.runGrep(localPath, input.pattern, {
      fileGlob: input.fileGlob,
      ignoreCase: input.ignoreCase ?? false,
      maxCount: maxMatches + 1, // +1 so we can detect truncation
    });

    const truncated = rawMatches.length > maxMatches;
    const matches = rawMatches.slice(0, maxMatches).map((m) => ({
      ...m,
      filePath: path.relative(localPath, m.filePath).split(path.sep).join('/'),
    }));

    return {
      matches,
      totalMatches: matches.length,
      truncated,
      pattern: input.pattern,
    };
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private async resolveLocalPath(repoId: string): Promise<string | null> {
    const index = await this.db.repoIndex.findFirst({
      where: { repoId, status: 'COMPLETED' },
      orderBy: { createdAt: 'desc' },
      select: { localPath: true },
    });
    return index?.localPath ?? null;
  }

  private runGrep(
    directory: string,
    pattern: string,
    opts: { fileGlob?: string; ignoreCase: boolean; maxCount: number },
  ): Promise<Array<{ filePath: string; lineNumber: number; lineContent: string }>> {
    return new Promise((resolve, reject) => {
      const args: string[] = [
        '-rn',                        // recursive, with line numbers
        '--with-filename',
        `-m`, String(opts.maxCount),  // stop after N matches per file... we aggregate
      ];

      if (opts.ignoreCase) args.push('-i');
      if (opts.fileGlob) args.push(`--include=${opts.fileGlob}`);

      // Exclude common build artefacts so we don't get false positives.
      args.push('--exclude-dir=node_modules', '--exclude-dir=.git', '--exclude-dir=dist');

      args.push('--', pattern, directory);

      let outputBuf = '';
      let totalBytes = 0;

      const child = spawn('grep', args, { shell: false });

      child.stdout.on('data', (chunk: Buffer) => {
        const remaining = MAX_GREP_OUTPUT_BYTES - totalBytes;
        if (remaining <= 0) return;
        const str = chunk.toString('utf-8').slice(0, remaining);
        outputBuf += str;
        totalBytes += str.length;
      });

      const timer = setTimeout(() => {
        child.kill('SIGTERM');
        reject(new Error(`grep timed out after ${GREP_TIMEOUT_MS / 1000}s`));
      }, GREP_TIMEOUT_MS);

      child.on('close', (code) => {
        clearTimeout(timer);
        // Exit code 1 means no matches — not an error.
        // Exit code 2 means grep error.
        if (code === 2) {
          reject(new Error(`grep exited with error code 2. Check pattern validity.`));
          return;
        }

        const matches: Array<{ filePath: string; lineNumber: number; lineContent: string }> = [];

        for (const line of outputBuf.split('\n')) {
          if (!line.trim()) continue;
          // Format: /absolute/path/to/file.ts:42:line content
          const colonIdx1 = line.indexOf(':');
          if (colonIdx1 === -1) continue;
          const colonIdx2 = line.indexOf(':', colonIdx1 + 1);
          if (colonIdx2 === -1) continue;

          const filePath = line.slice(0, colonIdx1);
          const lineNumber = parseInt(line.slice(colonIdx1 + 1, colonIdx2), 10);
          const lineContent = line.slice(colonIdx2 + 1);

          if (!isNaN(lineNumber)) {
            matches.push({ filePath, lineNumber, lineContent });
          }
        }

        resolve(matches);
      });

      child.on('error', (err) => {
        clearTimeout(timer);
        reject(new Error(`Failed to spawn grep: ${err.message}`));
      });
    });
  }
}
