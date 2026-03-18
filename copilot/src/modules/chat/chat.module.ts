import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ChatOrchestrator } from './chat.orchestrator';
import { ChatMemoryService } from './chat.memory.service';
import { ChatIntentService } from './chat-intent.service';
import { LlmModule } from '../llm/llm.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { RepoModule } from '../repo/repo.module';
import { RunsModule } from '../runs/runs.module';
import { AuthModule } from '../auth/auth.module';
import { AgentModule } from '../agent/agent.module';
import { ToolsModule } from '../tools/tools.module';
import { WebResearchModule } from '../web-research/web-research.module';

@Module({
  imports: [
    LlmModule,
    KnowledgeModule,
    RepoModule,
    RunsModule,
    AuthModule,
    AgentModule,       // provides ReactEngine
    ToolsModule,       // provides ToolsRegistry + all tools
    WebResearchModule, // provides WebResearchTool
  ],
  controllers: [ChatController],
  providers: [ChatService, ChatOrchestrator, ChatMemoryService, ChatIntentService],
  exports: [ChatService, ChatMemoryService],
})
export class ChatModule {}
