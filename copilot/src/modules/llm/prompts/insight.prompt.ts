import { LlmMessage } from '../interfaces/llm-completion.interface';
import { InsightInput, INSIGHT_OUTPUT_SCHEMA_DOC } from '../schemas/insight-output.schema';

export function buildInsightMessages(input: InsightInput): LlmMessage[] {
  const stepLog = input.stepSummaries
    .map((s, i) => `Step ${i + 1}: ${s}`)
    .join('\n');

  const system = `You are an AI agent extracting durable long-term insights from a completed multi-step task.
Your goal is to identify patterns, decisions, and learnings that will be valuable for FUTURE tasks on this codebase.

REPO: ${input.repoName ?? 'unknown'}

RULES:
- Only extract insights that will still be relevant weeks or months from now.
- Skip one-off observations or things specific only to this exact task.
- Insights should help future tasks avoid mistakes, choose better approaches, or understand the codebase faster.
- Keep content concise — one to three sentences per insight.

Respond ONLY with valid JSON matching this exact schema:
${INSIGHT_OUTPUT_SCHEMA_DOC}`;

  const user = `Task completed:
Goal: ${input.userPrompt}
Summary: ${input.taskSummary}

Step log:
${stepLog}

Extract the most valuable durable insights from this task.`;

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}
