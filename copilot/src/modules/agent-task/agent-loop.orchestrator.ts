import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { LlmService } from '../llm/llm.service';
import { MemoryService } from '../memory/memory.service';
import { WebResearchTool } from '../web-research/web-research.tool';
import { ApprovalService } from '../approval/approval.service';
import { RepoService } from '../repo/repo.service';
import { ToolsRegistry } from '../tools/tools.registry';
import { AgentService } from '../agent/agent.service';
import { ReactEngine } from '../agent/react-engine.service';
import { CreateAgentTaskDto } from './dto/create-agent-task.dto';
import { AgentTaskResponseDto } from './dto/agent-task-response.dto';
import { AgentTaskStatus } from '../../common/enums/agent-task-status.enum';
import { AgentTaskStepStatus } from '../../common/enums/agent-task-step-status.enum';
import { AgentMemoryType } from '../../common/enums/agent-memory-type.enum';
import { ApprovalStatus } from '../../common/enums/approval-status.enum';
import { RiskLevel } from '../../common/enums/risk-level.enum';
import { TaskPlanStep } from '../llm/schemas/task-plan.schema';
import { MemoryWriteItem } from '../llm/schemas/reflect-output.schema';
import { ResourceNotFoundException, ValidationException } from '../../common/exceptions/app.exception';

const MAX_STEPS = 12;

@Injectable()
export class AgentLoopOrchestrator {
  private readonly logger = new Logger(AgentLoopOrchestrator.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly llm: LlmService,
    private readonly memory: MemoryService,
    private readonly webResearchTool: WebResearchTool,
    private readonly approvalService: ApprovalService,
    private readonly repoService: RepoService,
    private readonly toolsRegistry: ToolsRegistry,
    private readonly agentService: AgentService,
    private readonly reactEngine: ReactEngine,
  ) {}

  // ─── Create task + generate plan ────────────────────────────────────────────

  async createTask(dto: CreateAgentTaskDto): Promise<AgentTaskResponseDto> {
    const startedAt = Date.now();

    // Resolve repo name for context
    let repoName: string | undefined;
    if (dto.repoId) {
      try {
        const repo = await this.repoService.findOne(dto.repoId);
        repoName = repo.name;
      } catch {
        // repo not found — continue without name
      }
    }

    // Load existing memories for this repo to inform the plan
    const memories = await this.memory.loadForContext(dto.repoId);
    const existingMemories = this.memory.formatForPrompt(memories);

    // Get list of available tools
    const availableTools = this.toolsRegistry.getAllDefinitions().map((t) => t.name);
    // Add agent pipeline tools (not in ToolsRegistry but available via AgentService)
    const agentTools = ['explain_code', 'propose_patch', 'generate_tests', 'review_code', 'find_files'];
    const allTools = [...new Set([...availableTools, ...agentTools, 'web_research'])];

    // Ask LLM to produce the task plan
    const userPrompt = dto.context ? `${dto.goal}\n\nAdditional context: ${dto.context}` : dto.goal;
    const plan = await this.llm.planTask({
      userPrompt,
      repoName,
      existingMemories,
      availableTools: allTools,
      pathPrefix: dto.pathPrefix,
    });

    // Create approval request for the plan
    const planApproval = await this.approvalService.create({
      riskLevel: plan.estimatedRiskLevel as RiskLevel,
      reason: `Plan approval required for task: "${dto.goal}". ${plan.planReasoning}`,
    });

    // Persist the task
    const task = await this.db.agentTask.create({
      data: {
        repoId: dto.repoId ?? null,
        title: dto.goal,
        userPrompt,
        status: AgentTaskStatus.AWAITING_PLAN_APPROVAL,
        planJson: plan as never,
        planApprovalId: planApproval.id,
        totalSteps: plan.steps.length,
        metadata: { pathPrefix: dto.pathPrefix ?? '', repoName: repoName ?? '' } as never,
      },
    });

    // Link the approval to this task
    await this.db.approvalRequest.update({
      where: { id: planApproval.id },
      data: { agentTaskId: task.id },
    });

    this.logger.log(
      `Task created: ${task.id} "${dto.goal}" — ${plan.steps.length} steps, approval=${planApproval.id} [${plan.estimatedRiskLevel}] (${Date.now() - startedAt}ms)`,
    );

    return this.toResponseDto(task);
  }

  // ─── Approve plan → create steps → start loop ───────────────────────────────

  async approvePlan(taskId: string): Promise<AgentTaskResponseDto> {
    const task = await this.db.agentTask.findUnique({ where: { id: taskId } });
    if (!task) throw new ResourceNotFoundException('AgentTask', taskId);

    if (task.status !== AgentTaskStatus.AWAITING_PLAN_APPROVAL) {
      throw new ValidationException(
        `Task "${taskId}" is not awaiting plan approval (status: ${task.status})`,
      );
    }

    // Auto-approve the underlying plan ApprovalRequest when the user hits this endpoint
    if (task.planApprovalId) {
      const approval = await this.approvalService.findOne(task.planApprovalId);
      if (approval.status === ApprovalStatus.WAITING) {
        await this.approvalService.approve(task.planApprovalId, { reviewedBy: 'user' });
      }
    }

    const plan = task.planJson as unknown as { steps: TaskPlanStep[] };

    // Create step records
    await this.db.agentTaskStep.createMany({
      data: plan.steps.map((s) => ({
        taskId: task.id,
        stepIndex: s.stepIndex,
        title: s.title,
        description: s.description,
        toolName: s.toolName ?? null,
        toolInput: (s.toolInputHint ?? {}) as never,
        requiresApproval: s.requiresApproval,
        status: AgentTaskStepStatus.PENDING,
      })),
    });

    // Mark task as running
    await this.db.agentTask.update({
      where: { id: taskId },
      data: {
        status: AgentTaskStatus.RUNNING,
        planApprovedAt: new Date(),
        startedAt: new Date(),
      },
    });

    this.logger.log(`Task ${taskId} plan approved — starting execution loop`);

    // Fire and forget — run loop asynchronously
    this.executeLoop(taskId).catch((err) => {
      this.logger.error(`AgentLoop unhandled error for task ${taskId}: ${err instanceof Error ? err.message : String(err)}`);
    });

    return this.getTask(taskId);
  }

  // ─── Resume after a step approval ───────────────────────────────────────────

  async resume(taskId: string): Promise<AgentTaskResponseDto> {
    const task = await this.db.agentTask.findUnique({ where: { id: taskId } });
    if (!task) throw new ResourceNotFoundException('AgentTask', taskId);

    if (
      task.status !== AgentTaskStatus.AWAITING_STEP_APPROVAL &&
      task.status !== AgentTaskStatus.RUNNING
    ) {
      throw new ValidationException(
        `Task "${taskId}" cannot be resumed from status "${task.status}"`,
      );
    }

    // Fire loop asynchronously
    this.executeLoop(taskId).catch((err) => {
      this.logger.error(`AgentLoop resume error for task ${taskId}: ${err instanceof Error ? err.message : String(err)}`);
    });

    return this.getTask(taskId);
  }

  // ─── Cancel task ────────────────────────────────────────────────────────────

  async cancel(taskId: string): Promise<AgentTaskResponseDto> {
    const task = await this.db.agentTask.findUnique({ where: { id: taskId } });
    if (!task) throw new ResourceNotFoundException('AgentTask', taskId);

    await this.db.agentTask.update({
      where: { id: taskId },
      data: { status: AgentTaskStatus.CANCELLED, completedAt: new Date() },
    });

    return this.getTask(taskId);
  }

  // ─── Core execution loop ────────────────────────────────────────────────────

  private async executeLoop(taskId: string): Promise<void> {
    const loopStart = Date.now();

    while (true) {
      const task = await this.db.agentTask.findUnique({
        where: { id: taskId },
        include: { steps: { orderBy: { stepIndex: 'asc' } } },
      });

      if (!task) return;

      // Stop conditions
      if (
        task.status === AgentTaskStatus.CANCELLED ||
        task.status === AgentTaskStatus.COMPLETED ||
        task.status === AgentTaskStatus.FAILED ||
        task.status === AgentTaskStatus.PLAN_REJECTED
      ) {
        return;
      }

      // Find the current step
      const step = task.steps[task.currentStepIndex];
      if (!step) {
        // All steps done — finalise
        await this.finaliseTask(task.id, loopStart);
        return;
      }

      // ── Approval gate ──
      if (step.requiresApproval && step.status === AgentTaskStepStatus.PENDING) {
        const approval = await this.approvalService.create({
          riskLevel: RiskLevel.MEDIUM,
          reason: `Step ${step.stepIndex + 1}: "${step.title}" — ${step.description}`,
        });

        await this.db.agentTaskStep.update({
          where: { id: step.id },
          data: { status: AgentTaskStepStatus.AWAITING_APPROVAL, approvalId: approval.id },
        });
        await this.db.approvalRequest.update({
          where: { id: approval.id },
          data: { agentTaskId: taskId },
        });
        await this.db.agentTask.update({
          where: { id: taskId },
          data: { status: AgentTaskStatus.AWAITING_STEP_APPROVAL },
        });

        this.logger.log(`Task ${taskId} paused — step ${step.stepIndex} awaiting approval ${approval.id}`);
        return; // Pause — resume() will re-enter the loop
      }

      // ── Check if approval was resolved ──
      if (step.status === AgentTaskStepStatus.AWAITING_APPROVAL) {
        if (!step.approvalId) {
          await this.failTask(taskId, `Step ${step.stepIndex} missing approvalId`);
          return;
        }

        const approval = await this.approvalService.findOne(step.approvalId);
        if (approval.status === ApprovalStatus.WAITING) {
          return; // Still waiting
        }
        if (approval.status === ApprovalStatus.REJECTED) {
          await this.db.agentTaskStep.update({
            where: { id: step.id },
            data: { status: AgentTaskStepStatus.SKIPPED, completedAt: new Date() },
          });
          await this.db.agentTask.update({
            where: { id: taskId },
            data: {
              status: AgentTaskStatus.RUNNING,
              currentStepIndex: task.currentStepIndex + 1,
            },
          });
          continue;
        }

        // Approved — mark step as approved and fall through to execute
        await this.db.agentTaskStep.update({
          where: { id: step.id },
          data: { status: AgentTaskStepStatus.APPROVED },
        });
        await this.db.agentTask.update({
          where: { id: taskId },
          data: { status: AgentTaskStatus.RUNNING },
        });
      }

      // ── Execute step ──
      await this.executeStep(task, step);
    }
  }

  // ─── Execute a single step ──────────────────────────────────────────────────

  private async executeStep(task: { id: string; repoId: string | null; userPrompt: string; metadata: unknown }, step: { id: string; stepIndex: number; title: string; description: string; toolName: string | null; toolInput: unknown }): Promise<void> {
    const stepStart = Date.now();

    // Mark step as running
    await this.db.agentTaskStep.update({
      where: { id: step.id },
      data: { status: AgentTaskStepStatus.RUNNING, startedAt: new Date() },
    });

    let toolOutput: unknown = null;
    let toolError: string | null = null;

    try {
      // Use ReactEngine to execute the step — the LLM dynamically calls tools
      // to accomplish the step goal rather than following a fixed dispatch.
      const meta = task.metadata as Record<string, unknown>;
      const pathPrefix = meta?.['pathPrefix'] as string | undefined;

      const tools = [
        ...this.toolsRegistry.getAll(),
        this.webResearchTool,
      ];

      const reactResult = await this.reactEngine.run({
        systemPrompt: this.buildStepSystemPrompt(task, pathPrefix),
        userMessage: `Accomplish this step:\n\n**${step.title}**\n\n${step.description}`,
        tools,
        repoId: task.repoId ?? undefined,
        maxIterations: 15,
      });

      toolOutput = {
        answer: reactResult.answer,
        toolCallCount: reactResult.toolCallCount,
        iterations: reactResult.iterations,
      };
    } catch (err) {
      toolError = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Step ${step.stepIndex} ReactEngine error: ${toolError}`);
    }

    // ── Reflect on the step ──
    const priorMemories = this.memory.formatForPrompt(
      await this.memory.loadForContext(task.repoId ?? undefined),
    );

    let reflection: Awaited<ReturnType<LlmService['reflectOnStep']>> | null = null;
    try {
      reflection = await this.llm.reflectOnStep({
        taskSummary: (task as { userPrompt: string }).userPrompt,
        step: { title: step.title, description: step.description, toolName: step.toolName ?? undefined },
        toolInput: step.toolInput,
        toolOutput,
        toolError,
        priorMemories,
      });

      // Write memories from reflection
      if (reflection.memoriesToWrite.length > 0) {
        await this.writeMemories(reflection.memoriesToWrite, task.id, task.repoId ?? undefined);
      }
    } catch (reflectErr) {
      this.logger.warn(`Reflection failed for step ${step.stepIndex}: ${reflectErr instanceof Error ? reflectErr.message : String(reflectErr)}`);
    }

    const durationMs = Date.now() - stepStart;
    const succeeded = toolError === null;

    // Mark step completed/failed
    await this.db.agentTaskStep.update({
      where: { id: step.id },
      data: {
        status: succeeded ? AgentTaskStepStatus.COMPLETED : AgentTaskStepStatus.FAILED,
        toolOutput: (toolOutput ?? {}) as never,
        reflectionJson: (reflection ?? null) as never,
        error: toolError,
        durationMs,
        completedAt: new Date(),
      },
    });

    // Advance step counter
    const taskRecord = await this.db.agentTask.findUnique({ where: { id: task.id } });
    const nextIndex = (taskRecord?.currentStepIndex ?? 0) + 1;
    const totalSteps = taskRecord?.totalSteps ?? 0;

    if (reflection?.replanNeeded) {
      this.logger.log(`Task ${task.id} step ${step.stepIndex} triggered replan: ${reflection.replanReason ?? ''}`);
      // For now mark as continuing — future enhancement: replan remaining steps
    }

    await this.db.agentTask.update({
      where: { id: task.id },
      data: {
        currentStepIndex: nextIndex,
        status: nextIndex >= totalSteps ? AgentTaskStatus.RUNNING : AgentTaskStatus.RUNNING,
      },
    });

    this.logger.log(
      `Task ${task.id} step ${step.stepIndex} "${step.title}" ${succeeded ? 'completed' : 'failed'} in ${durationMs}ms`,
    );
  }

  // ─── System prompt for step ReactEngine ─────────────────────────────────────

  private readonly nodeVersionMajor = parseInt(process.versions.node.split('.')[0], 10);
  private readonly nodeVersion = process.versions.node;
  private readonly osPlatform = `${process.platform} ${process.arch}`;

  private buildStepSystemPrompt(
    task: { id: string; repoId: string | null; userPrompt: string },
    pathPrefix?: string,
  ): string {
    const viteVersion = this.nodeVersionMajor >= 20 ? '6' : '5';
    const nextVersion = this.nodeVersionMajor >= 18 ? '14' : '13';

    return [
      'You are an autonomous engineering agent executing a step within a larger task.',
      '',
      `Overall task goal: ${task.userPrompt}`,
      pathPrefix ? `Repository path scope: ${pathPrefix}` : '',
      '',
      'Runtime environment:',
      `- Node.js: v${this.nodeVersion} (major: ${this.nodeVersionMajor}) — platform: ${this.osPlatform}`,
      `- Recommended versions: vite@${viteVersion}, next@${nextVersion}`,
      `- ALWAYS call check_environment before scaffolding to confirm compatible versions.`,
      '',
      'Guidelines:',
      '- Use tools to gather information, read files, search the codebase, run commands, or write files.',
      '- Chain tool calls as needed — read files before editing them, search before reading.',
      '- After gathering enough information, write your findings or make the required changes.',
      '- Be thorough but focused — accomplish the step goal, nothing more.',
      '- When you are done, provide a clear summary of what was accomplished.',
      '',
      'Error recovery rules:',
      '- When a tool returns {"error": "..."} — read the error carefully and try a different approach.',
      '- Never give up after one failure — try at least 2 alternative strategies.',
      '- Version incompatibility (e.g. "requires Node 20+"): switch to the recommended version above.',
      '- If scaffold_project fails: use create_directory + write_file to create package.json and config manually.',
    ]
      .filter(Boolean)
      .join('\n');
  }

  // ─── Dispatch tool by name (legacy — kept for direct tool dispatch) ──────────

  private async dispatchTool(
    task: { id: string; repoId: string | null; metadata: unknown },
    step: { toolName: string | null; toolInput: unknown; description: string },
  ): Promise<unknown> {
    const toolName = step.toolName!;
    const input = (step.toolInput ?? {}) as Record<string, unknown>;
    const repoId = task.repoId;

    // Inject repoId if the tool accepts it and it's not already set
    if (repoId && !input['repoId']) input['repoId'] = repoId;

    const meta = task.metadata as Record<string, unknown>;

    // ── Agent pipeline tools ──
    if (toolName === 'explain_code') {
      return this.agentService.explain({ repoId: repoId!, filePath: String(input['filePath'] ?? ''), additionalContext: String(input['additionalContext'] ?? '') });
    }
    if (toolName === 'propose_patch') {
      const constraints = meta['pathPrefix'] ? [`Focus on files within: ${String(meta['pathPrefix'])}`] : undefined;
      return this.agentService.proposePatch({ repoId: repoId!, request: String(input['request'] ?? step.description), constraints });
    }
    if (toolName === 'generate_tests') {
      return this.agentService.generateTests({ repoId: repoId!, filePath: String(input['filePath'] ?? '') });
    }
    if (toolName === 'review_code') {
      return this.agentService.review({ repoId: repoId!, filePath: String(input['filePath'] ?? '') });
    }
    if (toolName === 'find_files') {
      return this.agentService.findFiles({ repoId: repoId!, query: String(input['query'] ?? step.description) });
    }

    // ── Web research tool ──
    if (toolName === 'web_research') {
      return this.webResearchTool.execute(
        { query: String(input['query'] ?? step.description), maxResults: input['maxResults'] as number | undefined },
        {},
      );
    }

    // ── Generic tools from ToolsRegistry ──
    const tool = this.toolsRegistry.get(toolName);
    if (!tool) {
      throw new Error(`Unknown tool: "${toolName}". Available: ${this.toolsRegistry.getAll().map((t) => t.name).join(', ')}`);
    }

    return tool.execute(input, {});
  }

  // ─── Finalise completed task ────────────────────────────────────────────────

  private async finaliseTask(taskId: string, loopStart: number): Promise<void> {
    const task = await this.db.agentTask.findUnique({
      where: { id: taskId },
      include: { steps: { orderBy: { stepIndex: 'asc' } } },
    });
    if (!task) return;

    // Extract end-of-task insights via LLM
    const stepSummaries = task.steps.map(
      (s) => `${s.title}: ${s.status}${s.error ? ` — ERROR: ${s.error}` : ''}`,
    );

    try {
      const insights = await this.llm.extractInsights({
        taskSummary: (task.planJson as Record<string, unknown>)?.['taskSummary'] as string ?? task.userPrompt,
        userPrompt: task.userPrompt,
        stepSummaries,
        repoName: (task.metadata as Record<string, unknown>)?.['repoName'] as string | undefined,
      });

      // Persist insights
      for (const insight of insights.insights) {
        await this.memory.create({
          repoId: task.repoId ?? undefined,
          taskId: task.id,
          type: AgentMemoryType.INSIGHT,
          subject: insight.subject,
          content: insight.content,
          confidence: insight.confidence,
          tags: insight.tags,
        });
      }

      await this.db.agentTask.update({
        where: { id: taskId },
        data: {
          status: AgentTaskStatus.COMPLETED,
          completedAt: new Date(),
          durationMs: Date.now() - loopStart,
          output: { taskLearnings: insights.taskLearnings, stepSummaries } as never,
        },
      });

      this.logger.log(`Task ${taskId} COMPLETED in ${Date.now() - loopStart}ms — ${insights.insights.length} insights stored`);
    } catch (err) {
      this.logger.warn(`Insight extraction failed for ${taskId}: ${err instanceof Error ? err.message : String(err)}`);
      await this.db.agentTask.update({
        where: { id: taskId },
        data: {
          status: AgentTaskStatus.COMPLETED,
          completedAt: new Date(),
          durationMs: Date.now() - loopStart,
          output: { stepSummaries } as never,
        },
      });
    }
  }

  private async failTask(taskId: string, error: string): Promise<void> {
    await this.db.agentTask.update({
      where: { id: taskId },
      data: { status: AgentTaskStatus.FAILED, error, completedAt: new Date() },
    });
    this.logger.error(`Task ${taskId} FAILED: ${error}`);
  }

  // ─── Write memories ──────────────────────────────────────────────────────────

  private async writeMemories(
    items: MemoryWriteItem[],
    taskId: string,
    repoId?: string,
  ): Promise<void> {
    for (const item of items) {
      try {
        await this.memory.create({
          repoId,
          taskId,
          type: item.type as AgentMemoryType,
          subject: item.subject,
          content: item.content,
          confidence: item.confidence,
          tags: item.tags,
        });
      } catch (err) {
        this.logger.warn(`Failed to write memory "${item.subject}": ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  // ─── Query helpers ──────────────────────────────────────────────────────────

  async getTask(taskId: string): Promise<AgentTaskResponseDto> {
    const task = await this.db.agentTask.findUnique({
      where: { id: taskId },
      include: { steps: { orderBy: { stepIndex: 'asc' } } },
    });
    if (!task) throw new ResourceNotFoundException('AgentTask', taskId);
    return this.toResponseDto(task);
  }

  async listTasks(repoId?: string, status?: AgentTaskStatus): Promise<AgentTaskResponseDto[]> {
    const tasks = await this.db.agentTask.findMany({
      where: {
        ...(repoId ? { repoId } : {}),
        ...(status ? { status } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return tasks.map((t) => this.toResponseDto(t));
  }

  private toResponseDto(task: Record<string, unknown>): AgentTaskResponseDto {
    return {
      id: task['id'] as string,
      repoId: task['repoId'] as string | null,
      title: task['title'] as string,
      userPrompt: task['userPrompt'] as string,
      goal: task['title'] as string,  // alias — frontend uses this field
      status: task['status'] as AgentTaskStatus,
      planJson: task['planJson'],
      planApprovalId: task['planApprovalId'] as string | null,
      currentStepIndex: task['currentStepIndex'] as number,
      totalSteps: task['totalSteps'] as number,
      error: task['error'] as string | null,
      errorMessage: task['error'] as string | null,  // alias for frontend
      output: task['output'],
      durationMs: task['durationMs'] as number | null,
      createdAt: task['createdAt'] as Date,
      startedAt: task['startedAt'] as Date | null,
      completedAt: task['completedAt'] as Date | null,
      steps: (task['steps'] as unknown[])?.map((s: unknown) => {
        const step = s as Record<string, unknown>;
        return {
          id: step['id'] as string,
          taskId: step['taskId'] as string,
          stepIndex: step['stepIndex'] as number,
          title: step['title'] as string,
          description: step['description'] as string,
          toolName: step['toolName'] as string | null,
          toolInput: step['toolInput'],
          toolOutput: step['toolOutput'],
          requiresApproval: step['requiresApproval'] as boolean,
          approvalId: step['approvalId'] as string | null,
          status: step['status'] as AgentTaskStepStatus,
          reflectionJson: step['reflectionJson'],
          error: step['error'] as string | null,
          durationMs: step['durationMs'] as number | null,
          createdAt: step['createdAt'] as Date,
          startedAt: step['startedAt'] as Date | null,
          completedAt: step['completedAt'] as Date | null,
        };
      }),
    };
  }
}
