import { Injectable, Logger } from '@nestjs/common';
import {
  AgentToolDefinition,
  IAgentTool,
  ToolExecutionContext,
} from '../interfaces/agent-tool.interface';

export interface StopDevServerInput {
  /** PID returned by start_dev_server. */
  pid: number;
}

export interface StopDevServerOutput {
  stopped: boolean;
  message: string;
}

@Injectable()
export class StopDevServerTool
  implements IAgentTool<StopDevServerInput, StopDevServerOutput>
{
  readonly name = 'stop_dev_server';
  readonly description =
    'Stop a background dev server started by start_dev_server. Pass the PID returned by that tool.';
  readonly requiresApproval = true;

  private readonly logger = new Logger(StopDevServerTool.name);

  getDefinition(): AgentToolDefinition {
    return {
      name: this.name,
      description: this.description,
      requiresApproval: this.requiresApproval,
      inputSchema: {
        type: 'object',
        properties: {
          pid: {
            type: 'number',
            description: 'Process ID returned by start_dev_server',
          },
        },
        required: ['pid'],
      },
    };
  }

  async execute(
    input: StopDevServerInput,
    _context: ToolExecutionContext,
  ): Promise<StopDevServerOutput> {
    this.logger.log(`[stop_dev_server] Sending SIGTERM to PID ${input.pid}`);

    try {
      // Kill the process group (negative PID) so child processes (e.g. vite) are also killed
      process.kill(-input.pid, 'SIGTERM');
      return { stopped: true, message: `Process group ${input.pid} sent SIGTERM.` };
    } catch {
      // Fall back to killing just the PID
      try {
        process.kill(input.pid, 'SIGTERM');
        return { stopped: true, message: `Process ${input.pid} sent SIGTERM.` };
      } catch (err2) {
        const msg = err2 instanceof Error ? err2.message : String(err2);
        return {
          stopped: false,
          message: `Could not stop PID ${input.pid}: ${msg}`,
        };
      }
    }
  }
}
