import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { LlmModule } from '../llm/llm.module';
import { MemoryModule } from '../memory/memory.module';
import { WebResearchModule } from '../web-research/web-research.module';
import { ToolsModule } from '../tools/tools.module';
import { ApprovalModule } from '../approval/approval.module';
import { RepoModule } from '../repo/repo.module';
import { AgentModule } from '../agent/agent.module';
import { AgentLoopOrchestrator } from './agent-loop.orchestrator';
import { AgentTaskService } from './agent-task.service';
import { AgentTaskController } from './agent-task.controller';

@Module({
  imports: [
    DatabaseModule,
    LlmModule,
    MemoryModule,
    WebResearchModule,
    ToolsModule,
    ApprovalModule,
    RepoModule,
    AgentModule,
  ],
  controllers: [AgentTaskController],
  providers: [AgentLoopOrchestrator, AgentTaskService],
  exports: [AgentTaskService],
})
export class AgentTaskModule {}
