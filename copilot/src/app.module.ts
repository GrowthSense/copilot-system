import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { AppConfigModule } from './config/config.module';
import { DatabaseModule } from './modules/database/database.module';
import { AgentModule } from './modules/agent/agent.module';
import { KnowledgeModule } from './modules/knowledge/knowledge.module';
import { RepoModule } from './modules/repo/repo.module';
import { LlmModule } from './modules/llm/llm.module';
import { ToolsModule } from './modules/tools/tools.module';
import { PatchModule } from './modules/patch/patch.module';
import { TestgenModule } from './modules/testgen/testgen.module';
import { RunsModule } from './modules/runs/runs.module';
import { GithubModule } from './modules/github/github.module';
import { AuditModule } from './modules/audit/audit.module';
import { ApprovalModule } from './modules/approval/approval.module';
import { PrDraftModule } from './modules/prdraft/prdraft.module';
import { ChatModule } from './modules/chat/chat.module';
import { AuthModule } from './modules/auth/auth.module';
import { MemoryModule } from './modules/memory/memory.module';
import { WebResearchModule } from './modules/web-research/web-research.module';
import { AgentTaskModule } from './modules/agent-task/agent-task.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    AppConfigModule,
    DatabaseModule,
    TerminusModule,
    AgentModule,
    KnowledgeModule,
    RepoModule,
    LlmModule,
    ToolsModule,
    PatchModule,
    TestgenModule,
    RunsModule,
    GithubModule,
    AuditModule,
    ApprovalModule,
    PrDraftModule,
    ChatModule,
    AuthModule,
    MemoryModule,
    WebResearchModule,
    AgentTaskModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
