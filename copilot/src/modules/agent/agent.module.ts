import { Module } from '@nestjs/common';
import { AgentController } from './agent.controller';
import { AgentService } from './agent.service';
import { AgentOrchestrator } from './agent.orchestrator';
import { ReactEngine } from './react-engine.service';
import { RunsModule } from '../runs/runs.module';
import { LlmModule } from '../llm/llm.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { RepoModule } from '../repo/repo.module';
import { PatchModule } from '../patch/patch.module';
import { TestgenModule } from '../testgen/testgen.module';
import { ApprovalModule } from '../approval/approval.module';
import { PrDraftModule } from '../prdraft/prdraft.module';
import { GithubModule } from '../github/github.module';
import { ReviewModule } from '../review/review.module';
import { TestrunnerModule } from '../testrunner/testrunner.module';
import { ToolsModule } from '../tools/tools.module';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [
    DatabaseModule,    // DatabaseService — direct DB access (repoIndex queries)
    RunsModule,        // RunsService — run/step lifecycle
    LlmModule,         // LlmService — structured LLM completions
    KnowledgeModule,   // RetrievalService — knowledge base lookups
    RepoModule,        // RepoService + RepoSearchService — file access and search
    PatchModule,       // PatchService + PatchValidatorService — patch persistence and validation
    TestgenModule,     // TestgenService — generated test persistence
    ApprovalModule,    // ApprovalService — approval gate enforcement
    PrDraftModule,     // PrDraftService — PR draft persistence
    GithubModule,      // GithubService — branch, commit, and PR creation
    ReviewModule,      // ReviewService — code review persistence
    TestrunnerModule,  // TestrunnerService — test run result persistence
    ToolsModule,       // RunTestsTool — shell test execution
  ],
  controllers: [AgentController],
  providers: [AgentService, AgentOrchestrator, ReactEngine],
  exports: [AgentService, ReactEngine],
})
export class AgentModule {}
