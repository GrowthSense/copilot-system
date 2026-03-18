import { Injectable } from '@nestjs/common';
import * as os from 'os';
import { execSync } from 'child_process';
import {
  AgentToolDefinition,
  IAgentTool,
  ToolExecutionContext,
} from '../interfaces/agent-tool.interface';

export interface CheckEnvironmentInput {
  // No required inputs — returns system environment info
  _?: never;
}

export interface CheckEnvironmentOutput {
  nodeVersion: string;
  nodeVersionMajor: number;
  npmVersion: string;
  platform: string;
  arch: string;
  homeDir: string;
  /** Compatibility notes the LLM should use when choosing framework versions */
  compatibilityNotes: string;
  /** Recommended vite version for this Node (e.g. "5") */
  viteRecommendedVersion: string;
  /** Recommended Next.js major version (e.g. "14") */
  nextRecommendedVersion: string;
}

@Injectable()
export class CheckEnvironmentTool implements IAgentTool<CheckEnvironmentInput, CheckEnvironmentOutput> {
  readonly name = 'check_environment';
  readonly description =
    'Returns the current runtime environment: Node.js version, npm version, OS platform, and compatibility recommendations for framework versions. ' +
    'ALWAYS call this tool first before scaffolding or installing packages, so you choose compatible versions.';
  readonly requiresApproval = false;

  getDefinition(): AgentToolDefinition {
    return {
      name: this.name,
      description: this.description,
      requiresApproval: this.requiresApproval,
      inputSchema: {
        type: 'object',
        properties: {},
        required: [],
      },
    };
  }

  async execute(_input: CheckEnvironmentInput, _context: ToolExecutionContext): Promise<CheckEnvironmentOutput> {
    const nodeVersion = process.versions.node; // e.g. "18.19.1"
    const nodeVersionMajor = parseInt(nodeVersion.split('.')[0], 10);
    const platform = `${process.platform} ${process.arch}`;
    const arch = process.arch;
    const homeDir = os.homedir();

    let npmVersion = 'unknown';
    try {
      npmVersion = execSync('npm --version', { encoding: 'utf8', timeout: 5000 }).trim();
    } catch {
      // ignore
    }

    // Compatibility matrix keyed on Node major version
    const viteRecommendedVersion = nodeVersionMajor >= 20 ? '6' : nodeVersionMajor >= 18 ? '5' : '4';
    const nextRecommendedVersion = nodeVersionMajor >= 18 ? '14' : '13';

    const notes: string[] = [
      `Node ${nodeVersionMajor} detected.`,
    ];

    if (nodeVersionMajor < 20) {
      notes.push(`Vite 6 requires Node 20+ — use vite@${viteRecommendedVersion} instead.`);
    }
    if (nodeVersionMajor < 18) {
      notes.push(`Next.js 14 requires Node 18+ — use next@${nextRecommendedVersion} instead.`);
    }
    notes.push(`When calling scaffold_project for Vite, set version="${viteRecommendedVersion}".`);

    return {
      nodeVersion,
      nodeVersionMajor,
      npmVersion,
      platform,
      arch,
      homeDir,
      compatibilityNotes: notes.join(' '),
      viteRecommendedVersion,
      nextRecommendedVersion,
    };
  }
}
