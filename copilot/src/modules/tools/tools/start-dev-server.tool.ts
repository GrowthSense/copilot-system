import { Injectable, Logger } from '@nestjs/common';
import { spawn } from 'child_process';
import {
  AgentToolDefinition,
  IAgentTool,
  ToolExecutionContext,
} from '../interfaces/agent-tool.interface';

export interface StartDevServerInput {
  /** Absolute path to the project directory. */
  cwd: string;
  /** npm script to run. Default: "dev". Allowed: dev, start, preview. */
  script?: 'dev' | 'start' | 'preview';
  /** How long to wait for a URL to appear in stdout before giving up (ms). Default: 20000. */
  waitForUrlMs?: number;
}

export interface StartDevServerOutput {
  url: string;
  pid: number;
  success: boolean;
  message: string;
}

const ALLOWED_SCRIPTS = new Set(['dev', 'start', 'preview']);

// Patterns that indicate the dev server is ready and listening
const URL_PATTERNS = [
  /https?:\/\/localhost:\d+/i,
  /Local:\s+https?:\/\//i,
  /➜\s+Local:/i,
  /ready in/i,
  /listening on/i,
  /started server on/i,
];

@Injectable()
export class StartDevServerTool
  implements IAgentTool<StartDevServerInput, StartDevServerOutput>
{
  readonly name = 'start_dev_server';
  readonly description =
    'Start a dev server (npm run dev/start/preview) as a background process. ' +
    'Waits up to 20s for the server URL to appear in output, then returns the URL and PID immediately. ' +
    'The server keeps running after this tool completes. Use stop_dev_server to kill it. ' +
    'IMPORTANT: Always use this tool instead of run_command dev — run_command blocks forever.';
  readonly requiresApproval = true;

  private readonly logger = new Logger(StartDevServerTool.name);

  getDefinition(): AgentToolDefinition {
    return {
      name: this.name,
      description: this.description,
      requiresApproval: this.requiresApproval,
      inputSchema: {
        type: 'object',
        properties: {
          cwd: {
            type: 'string',
            description: 'Absolute path to the project directory',
          },
          script: {
            type: 'string',
            enum: ['dev', 'start', 'preview'],
            description: 'npm script to run (default: "dev")',
          },
          waitForUrlMs: {
            type: 'number',
            description: 'Max milliseconds to wait for URL in output (default: 20000)',
          },
        },
        required: ['cwd'],
      },
    };
  }

  async execute(
    input: StartDevServerInput,
    _context: ToolExecutionContext,
  ): Promise<StartDevServerOutput> {
    const script = input.script ?? 'dev';
    const waitMs = Math.min(input.waitForUrlMs ?? 20_000, 60_000);

    if (!ALLOWED_SCRIPTS.has(script)) {
      throw new Error(`Script "${script}" not allowed. Use: dev, start, preview`);
    }

    this.logger.log(`[start_dev_server] npm run ${script} in "${input.cwd}" (wait ${waitMs}ms)`);

    return new Promise((resolve) => {
      let capturedUrl = '';
      let settled = false;
      let outputBuffer = '';

      const child = spawn('npm', ['run', script], {
        cwd: input.cwd,
        detached: true,
        shell: false,
        env: {
          ...process.env,
          FORCE_COLOR: '0',
          // Do NOT set CI=true — it suppresses the dev server URL output in some frameworks
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      const checkOutput = (chunk: string) => {
        outputBuffer += chunk;
        if (settled) return;

        // Try to extract a URL
        const urlMatch = outputBuffer.match(/https?:\/\/localhost:\d+[^\s]*/i)
          ?? outputBuffer.match(/http:\/\/\d+\.\d+\.\d+\.\d+:\d+[^\s]*/i);

        if (urlMatch) {
          capturedUrl = urlMatch[0].trim().replace(/[,\s]+$/, '');
        }

        // Settle as soon as we have a URL or see a "ready" signal
        const isReady = URL_PATTERNS.some((p) => p.test(outputBuffer));
        if (isReady || capturedUrl) {
          settled = true;
          clearTimeout(timer);
          child.unref();
          resolve({
            url: capturedUrl || `http://localhost:5173`,
            pid: child.pid ?? 0,
            success: true,
            message: `Server started (PID ${child.pid}). Use stop_dev_server to stop it.`,
          });
        }
      };

      child.stdout?.on('data', (chunk: Buffer) => checkOutput(chunk.toString('utf-8')));
      child.stderr?.on('data', (chunk: Buffer) => checkOutput(chunk.toString('utf-8')));

      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          child.unref();
          // Even if we didn't capture the URL pattern, the server may be running
          // — return a best-guess URL so the user can try it
          resolve({
            url: capturedUrl || 'http://localhost:5173',
            pid: child.pid ?? 0,
            success: !!capturedUrl || child.pid != null,
            message: capturedUrl
              ? `Server started (PID ${child.pid}) — URL captured from output.`
              : `Server may be starting (PID ${child.pid}) — try http://localhost:5173 in your browser.`,
          });
        }
      }, waitMs);

      child.on('error', (err) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve({
            url: '',
            pid: 0,
            success: false,
            message: `Failed to start server: ${err.message}`,
          });
        }
      });

      // If the process exits immediately it likely failed (e.g. port in use)
      child.on('close', (code) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve({
            url: '',
            pid: child.pid ?? 0,
            success: false,
            message: `Server process exited immediately with code ${code}. Check that the project has a "${script}" script and no port conflicts.`,
          });
        }
      });
    });
  }
}
