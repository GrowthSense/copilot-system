import { Module } from '@nestjs/common';
import { RepoModule } from '../repo/repo.module';
import { RunsModule } from '../runs/runs.module';

// Tools
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
import { StartDevServerTool } from './tools/start-dev-server.tool';
import { StopDevServerTool } from './tools/stop-dev-server.tool';

// Framework
import { ToolsRegistry } from './tools.registry';
import { ToolsExecutor } from './tools.executor';
import { ToolsService } from './tools.service';
import { ToolsController } from './tools.controller';

@Module({
  imports: [
    RepoModule,   // provides RepoService, RepoSearchService, RepoMapService
    RunsModule,   // provides RunsService (for audit logging)
  ],
  controllers: [ToolsController],
  providers: [
    // Individual tools
    SearchFilesTool,
    ReadFileTool,
    ReadFilesTool,
    GetRepoTreeTool,
    GrepCodeTool,
    GenerateDiffTool,
    RunTestsTool,
    RunLintTool,
    WriteFileTool,
    CreateDirectoryTool,
    RunCommandTool,
    ScaffoldProjectTool,
    WebFetchTool,
    CheckEnvironmentTool,
    StartDevServerTool,
    StopDevServerTool,
    // Framework
    ToolsRegistry,
    ToolsExecutor,
    ToolsService,
  ],
  exports: [ToolsService, ToolsRegistry, ToolsExecutor, RunTestsTool, WriteFileTool, CreateDirectoryTool, RunCommandTool, ScaffoldProjectTool, WebFetchTool, CheckEnvironmentTool, StartDevServerTool, StopDevServerTool],
})
export class ToolsModule {}
