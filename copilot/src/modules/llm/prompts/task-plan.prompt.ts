import { LlmMessage } from '../interfaces/llm-completion.interface';
import { TaskPlanInput, TASK_PLAN_OUTPUT_SCHEMA_DOC } from '../schemas/task-plan.schema';

export function buildTaskPlanMessages(input: TaskPlanInput): LlmMessage[] {
  const toolList = input.availableTools.join(', ');
  const scopeNote = input.pathPrefix
    ? `\nThe repo is scoped to the folder: \`${input.pathPrefix}\`. Focus analysis there.`
    : '';

  const system = `You are a senior software engineer and AI agent planner.
Your job is to break down a user's task into a clear, executable step-by-step plan.

REPO: ${input.repoName ?? 'unknown'}${scopeNote}

AVAILABLE TOOLS: ${toolList}

EXISTING MEMORIES (things I already know about this repo):
${input.existingMemories}

RULES:
1. Set requiresApproval: true on any step that WRITES files, RUNS commands, creates PRs, or modifies code.
2. Set requiresApproval: false on steps that only READ, SEARCH, or RESEARCH.
3. Keep the plan focused — 3 to 10 steps max. No busywork.
4. Steps that search the web (web_research) should come EARLY — before analysis steps.
5. Reasoning-only steps (no toolName) are for thinking/planning sub-goals.
6. The toolInputHint should include enough context for the step to execute without ambiguity.
7. estimatedRiskLevel reflects the highest risk step in the plan.

Respond ONLY with a valid JSON object matching this exact schema:
${TASK_PLAN_OUTPUT_SCHEMA_DOC}`;

  return [
    { role: 'system', content: system },
    { role: 'user', content: `Task: ${input.userPrompt}` },
  ];
}
