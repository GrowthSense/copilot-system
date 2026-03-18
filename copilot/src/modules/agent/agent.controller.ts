import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { AgentService } from './agent.service';
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
import { created, ok } from '../../common/utils/response.util';
import { ApiResponse } from '../../common/interfaces/api-response.interface';
import { AgentRunResponseDto } from './dto/agent-run-response.dto';
import { AskRepoQuestionResponseDto } from './dto/ask-repo-question-response.dto';
import { FindRelevantFilesResponseDto } from './dto/find-relevant-files-response.dto';
import { ExplainCodeResponseDto } from './dto/explain-code-response.dto';
import { ProposePatchResponseDto } from './dto/propose-patch-response.dto';
import { GenerateTestsAgentResponseDto } from './dto/generate-tests-agent-response.dto';
import { CreatePrDraftAgentResponseDto } from './dto/create-pr-draft-agent-response.dto';

@Controller({ path: 'agent', version: '1' })
export class AgentController {
  constructor(private readonly agentService: AgentService) {}

  // ─── Read-only capabilities ───────────────────────────────────────────────

  /**
   * POST /api/v1/agent/ask
   * Answer a natural language engineering question about a repository.
   */
  @Post('ask')
  @HttpCode(HttpStatus.OK)
  async ask(
    @Body() dto: AskRepoQuestionDto,
  ): Promise<ApiResponse<AskRepoQuestionResponseDto>> {
    const result = await this.agentService.ask(dto);
    return ok(result, 'Question answered');
  }

  /**
   * POST /api/v1/agent/find-files
   * Find the most relevant files for a natural language query.
   */
  @Post('find-files')
  @HttpCode(HttpStatus.OK)
  async findFiles(
    @Body() dto: FindRelevantFilesDto,
  ): Promise<ApiResponse<FindRelevantFilesResponseDto>> {
    const result = await this.agentService.findFiles(dto);
    return ok(result, 'Relevant files found');
  }

  /**
   * POST /api/v1/agent/explain
   * Produce a detailed code explanation for a file in the repository.
   */
  @Post('explain')
  @HttpCode(HttpStatus.OK)
  async explain(
    @Body() dto: ExplainCodeDto,
  ): Promise<ApiResponse<ExplainCodeResponseDto>> {
    const result = await this.agentService.explain(dto);
    return ok(result, 'Code explained');
  }

  // ─── Write capabilities ───────────────────────────────────────────────────

  /**
   * POST /api/v1/agent/propose-patch
   *
   * Analyse a bug or change request, gather relevant code context, and ask the
   * LLM for a structured patch proposal including a unified diff.
   *
   * The patch is **persisted but never auto-applied** — it must be reviewed and
   * submitted via the PR draft flow or applied manually.
   */
  @Post('propose-patch')
  @HttpCode(HttpStatus.OK)
  async proposePatch(
    @Body() dto: ProposePatchDto,
  ): Promise<ApiResponse<ProposePatchResponseDto>> {
    const result = await this.agentService.proposePatch(dto);
    return ok(result, 'Patch proposal created');
  }

  /**
   * POST /api/v1/agent/generate-tests
   *
   * Generate a complete, runnable unit test file for the specified source file.
   * The orchestrator reads the source, infers the existing test style from
   * adjacent spec files, and asks the LLM for a full test suite.
   *
   * The generated test is **persisted but not written to disk** — it can be
   * retrieved via GET /api/v1/testgen/:id and applied in a later PR draft.
   */
  @Post('generate-tests')
  @HttpCode(HttpStatus.OK)
  async generateTests(
    @Body() dto: GenerateTestsAgentDto,
  ): Promise<ApiResponse<GenerateTestsAgentResponseDto>> {
    const result = await this.agentService.generateTests(dto);
    return ok(result, 'Tests generated');
  }

  /**
   * POST /api/v1/agent/create-pr-draft
   *
   * Assemble approved patch changes into a GitHub pull request:
   *   1. Verify an APPROVED ApprovalRequest for the patch
   *   2. Generate PR title, body, branch name, and labels via LLM
   *   3. Create the feature branch on GitHub
   *   4. Commit the provided file changes (and optional generated tests) to that branch
   *   5. Open a draft pull request on GitHub
   *   6. Persist the PR draft record for audit
   *
   * The PR is opened as a **draft** — it is never auto-merged or deployed.
   * The caller must provide the full new content of each changed file (`changedFiles`).
   * An APPROVED ApprovalRequest (`approvalId`) is required before GitHub operations begin.
   */
  @Post('create-pr-draft')
  @HttpCode(HttpStatus.OK)
  async createPrDraft(
    @Body() dto: CreatePrDraftAgentDto,
  ): Promise<ApiResponse<CreatePrDraftAgentResponseDto>> {
    const result = await this.agentService.createPrDraft(dto);
    return ok(result, 'PR draft created');
  }

  /**
   * POST /api/v1/agent/review
   *
   * Run a structured code review on a file in the repository.
   * Returns severity-tagged findings grouped by CRITICAL → HIGH → MEDIUM → LOW.
   */
  @Post('review')
  @HttpCode(HttpStatus.OK)
  async review(
    @Body() dto: ReviewCodeDto,
  ): Promise<ApiResponse<ReviewCodeResponseDto>> {
    const result = await this.agentService.review(dto);
    return ok(result, 'Code review completed');
  }

  /**
   * POST /api/v1/agent/run-tests
   *
   * Run the test suite for a generated test file.
   * Requires an APPROVED ApprovalRequest before tests execute.
   */
  @Post('run-tests')
  @HttpCode(HttpStatus.OK)
  async runTests(
    @Body() dto: RunTestsAgentDto,
  ): Promise<ApiResponse<RunTestsAgentResponseDto>> {
    const result = await this.agentService.runTests(dto);
    return ok(result, 'Tests executed');
  }

  /**
   * POST /api/v1/agent/scaffold-project
   *
   * Scaffold a new project from scratch using a framework CLI, then build it.
   * Steps: check approval → LLM picks template → scaffold → npm build
   * Requires an APPROVED ApprovalRequest before any filesystem operations begin.
   */
  /**
   * POST /api/v1/agent/write-and-run-test
   *
   * Write the generated test file to disk in the target project, then execute
   * only that file using Jest's --testPathPattern flag.
   * Returns pass/fail, stdout, stderr, and the run result ID.
   */
  @Post('write-and-run-test')
  @HttpCode(HttpStatus.OK)
  async writeAndRunTest(
    @Body() dto: WriteAndRunTestDto,
  ): Promise<ApiResponse<RunTestsAgentResponseDto>> {
    const result = await this.agentService.writeAndRunTest(dto);
    return ok(result, result.passed ? 'Tests passed' : 'Tests failed');
  }

  @Post('scaffold-project')
  @HttpCode(HttpStatus.OK)
  async scaffoldProject(
    @Body() dto: ScaffoldProjectDto,
  ): Promise<ApiResponse<ScaffoldProjectResponseDto>> {
    const result = await this.agentService.scaffoldProject(dto);
    return ok(result, 'Project scaffolded successfully');
  }

  // ─── Run management ───────────────────────────────────────────────────────

  @Post('runs')
  async createRun(
    @Body() dto: CreateAgentRunDto,
  ): Promise<ApiResponse<AgentRunResponseDto>> {
    const run = await this.agentService.createRun(dto);
    return created(run, 'Agent run created');
  }

  @Get('runs')
  async listRuns(): Promise<ApiResponse<AgentRunResponseDto[]>> {
    const runs = await this.agentService.listRuns();
    return ok(runs, 'Agent runs retrieved');
  }

  @Get('runs/:id')
  async getRun(@Param('id') id: string): Promise<ApiResponse<AgentRunResponseDto>> {
    const run = await this.agentService.getRun(id);
    return ok(run, 'Agent run retrieved');
  }
}
