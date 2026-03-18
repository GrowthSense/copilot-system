import { Injectable } from '@nestjs/common';
import { IAgentTool, AgentToolDefinition } from './interfaces/agent-tool.interface';
import { SearchFilesTool } from './tools/search-files.tool';
import { ReadFileTool } from './tools/read-file.tool';
import { ReadFilesTool } from './tools/read-files.tool';
import { GetRepoTreeTool } from './tools/get-repo-tree.tool';
import { GrepCodeTool } from './tools/grep-code.tool';
import { GenerateDiffTool } from './tools/generate-diff.tool';
import { RunTestsTool } from './tools/run-tests.tool';
import { RunLintTool } from './tools/run-lint.tool';
import { WriteFileTool } from './tools/write-file.tool';
import { CreateDirectoryTool } from './tools/create-directory.tool';
import { RunCommandTool } from './tools/run-command.tool';
import { ScaffoldProjectTool } from './tools/scaffold-project.tool';
import { WebFetchTool } from './tools/web-fetch.tool';
import { CheckEnvironmentTool } from './tools/check-environment.tool';

@Injectable()
export class ToolsRegistry {
  private readonly tools: Map<string, IAgentTool>;

  constructor(
    private readonly searchFiles: SearchFilesTool,
    private readonly readFile: ReadFileTool,
    private readonly readFiles: ReadFilesTool,
    private readonly getRepoTree: GetRepoTreeTool,
    private readonly grepCode: GrepCodeTool,
    private readonly generateDiff: GenerateDiffTool,
    private readonly runTests: RunTestsTool,
    private readonly runLint: RunLintTool,
    private readonly writeFile: WriteFileTool,
    private readonly createDirectory: CreateDirectoryTool,
    private readonly runCommand: RunCommandTool,
    private readonly scaffoldProject: ScaffoldProjectTool,
    private readonly webFetch: WebFetchTool,
    private readonly checkEnvironment: CheckEnvironmentTool,
  ) {
    this.tools = new Map<string, IAgentTool>([
      [checkEnvironment.name, checkEnvironment],
      [searchFiles.name, searchFiles],
      [readFile.name, readFile],
      [readFiles.name, readFiles],
      [getRepoTree.name, getRepoTree],
      [grepCode.name, grepCode],
      [generateDiff.name, generateDiff],
      [runTests.name, runTests],
      [runLint.name, runLint],
      [writeFile.name, writeFile],
      [createDirectory.name, createDirectory],
      [runCommand.name, runCommand],
      [scaffoldProject.name, scaffoldProject],
      [webFetch.name, webFetch],
    ]);
  }

  /** Retrieve a tool by its registered name. Returns `undefined` if not found. */
  get(name: string): IAgentTool | undefined {
    return this.tools.get(name);
  }

  /** Returns all registered tools. */
  getAll(): IAgentTool[] {
    return Array.from(this.tools.values());
  }

  /** Returns all tool definitions (used for LLM function calling schemas). */
  getAllDefinitions(): AgentToolDefinition[] {
    return this.getAll().map((t) => t.getDefinition());
  }

  /** Check whether a tool with the given name is registered. */
  has(name: string): boolean {
    return this.tools.has(name);
  }
}
