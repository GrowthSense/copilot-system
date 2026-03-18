import { Injectable, Logger } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { DatabaseService } from '../database/database.service';
import { RunsService } from '../runs/runs.service';
import { AgentOrchestrator } from './agent.orchestrator';
import { CreateAgentRunDto } from './dto/create-agent-run.dto';
import { AskRepoQuestionDto } from './dto/ask-repo-question.dto';
import { FindRelevantFilesDto } from './dto/find-relevant-files.dto';
import { ExplainCodeDto } from './dto/explain-code.dto';
import { ProposePatchDto } from './dto/propose-patch.dto';
import { GenerateTestsAgentDto } from './dto/generate-tests-agent.dto';
import { CreatePrDraftAgentDto } from './dto/create-pr-draft-agent.dto';
import { ReviewCodeDto } from './dto/review-code.dto';
import { ReviewCodeResponseDto } from './dto/review-code-response.dto';
import { RunTestsAgentDto } from './dto/run-tests-agent.dto';
import { RunTestsAgentResponseDto } from './dto/run-tests-agent-response.dto';
import { WriteAndRunTestDto } from './dto/write-and-run-test.dto';
import { ScaffoldProjectDto } from './dto/scaffold-project.dto';
import { ScaffoldProjectResponseDto } from './dto/scaffold-project-response.dto';
import { AgentRunResponseDto } from './dto/agent-run-response.dto';
import { AskRepoQuestionResponseDto } from './dto/ask-repo-question-response.dto';
import { FindRelevantFilesResponseDto } from './dto/find-relevant-files-response.dto';
import { ExplainCodeResponseDto } from './dto/explain-code-response.dto';
import { ProposePatchResponseDto } from './dto/propose-patch-response.dto';
import { GenerateTestsAgentResponseDto } from './dto/generate-tests-agent-response.dto';
import { CreatePrDraftAgentResponseDto } from './dto/create-pr-draft-agent-response.dto';
import { RunStatus } from '../../common/enums/run-status.enum';
import { ResourceNotFoundException } from '../../common/exceptions/app.exception';
import { Prisma } from '@prisma/client';

@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly runsService: RunsService,
    private readonly orchestrator: AgentOrchestrator,
  ) {}

  // ─── Orchestrated capabilities ────────────────────────────────────────────

  async ask(dto: AskRepoQuestionDto): Promise<AskRepoQuestionResponseDto> {
    this.logger.log(`ask: repoId=${dto.repoId}`);
    return this.orchestrator.ask(dto);
  }

  async findFiles(dto: FindRelevantFilesDto): Promise<FindRelevantFilesResponseDto> {
    this.logger.log(`findFiles: repoId=${dto.repoId} query="${dto.query}"`);
    return this.orchestrator.findFiles(dto);
  }

  async explain(dto: ExplainCodeDto): Promise<ExplainCodeResponseDto> {
    this.logger.log(`explain: repoId=${dto.repoId} filePath=${dto.filePath}`);
    return this.orchestrator.explain(dto);
  }

  async proposePatch(dto: ProposePatchDto): Promise<ProposePatchResponseDto> {
    this.logger.log(`proposePatch: repoId=${dto.repoId}`);
    return this.orchestrator.proposePatch(dto);
  }

  async generateTests(dto: GenerateTestsAgentDto): Promise<GenerateTestsAgentResponseDto> {
    this.logger.log(`generateTests: repoId=${dto.repoId} filePath=${dto.filePath}`);
    return this.orchestrator.generateTests(dto);
  }

  async createPrDraft(dto: CreatePrDraftAgentDto): Promise<CreatePrDraftAgentResponseDto> {
    this.logger.log(`createPrDraft: repoId=${dto.repoId} patchId=${dto.patchId}`);
    return this.orchestrator.createPrDraft(dto);
  }

  async review(dto: ReviewCodeDto): Promise<ReviewCodeResponseDto> {
    this.logger.log(`review: repoId=${dto.repoId} filePath=${dto.filePath}`);
    return this.orchestrator.review(dto);
  }

  async runTests(dto: RunTestsAgentDto): Promise<RunTestsAgentResponseDto> {
    this.logger.log(`runTests: repoId=${dto.repoId} testgenId=${dto.testgenId}`);
    return this.orchestrator.runTests(dto);
  }

  async writeAndRunTest(dto: WriteAndRunTestDto): Promise<RunTestsAgentResponseDto> {
    this.logger.log(`writeAndRunTest: repoId=${dto.repoId} testgenId=${dto.testgenId}`);
    return this.orchestrator.writeAndRunTest(dto);
  }

  async scaffoldProject(dto: ScaffoldProjectDto): Promise<ScaffoldProjectResponseDto> {
    this.logger.log(`scaffoldProject: project=${dto.projectName} outputDir=${dto.outputDir}`);
    return this.orchestrator.scaffoldProject(dto);
  }

  // ─── Run management (legacy + utilities) ─────────────────────────────────

  async createRun(dto: CreateAgentRunDto): Promise<AgentRunResponseDto> {
    this.logger.log(`Creating agent run of type: ${dto.type}`);

    const run = await this.db.agentRun.create({
      data: {
        type: dto.type,
        status: RunStatus.PENDING,
        repoId: dto.repoId ?? null,
        input: { prompt: dto.prompt, context: dto.context ?? {} } as Prisma.InputJsonValue,
      },
    });

    return plainToInstance(AgentRunResponseDto, run, { excludeExtraneousValues: true });
  }

  async getRun(id: string): Promise<AgentRunResponseDto> {
    const run = await this.db.agentRun.findUnique({ where: { id } });
    if (!run) throw new ResourceNotFoundException('AgentRun', id);
    return plainToInstance(AgentRunResponseDto, run, { excludeExtraneousValues: true });
  }

  async listRuns(): Promise<AgentRunResponseDto[]> {
    const runs = await this.db.agentRun.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return plainToInstance(AgentRunResponseDto, runs, { excludeExtraneousValues: true });
  }
}
