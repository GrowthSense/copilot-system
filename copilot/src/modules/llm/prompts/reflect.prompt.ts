import { LlmMessage } from '../interfaces/llm-completion.interface';
import { ReflectInput, REFLECT_OUTPUT_SCHEMA_DOC } from '../schemas/reflect-output.schema';

export function buildReflectMessages(input: ReflectInput): LlmMessage[] {
  const toolOutputStr = input.toolError
    ? `ERROR: ${input.toolError}`
    : JSON.stringify(input.toolOutput, null, 2).slice(0, 3000);

  const toolInputStr = JSON.stringify(input.toolInput, null, 2).slice(0, 1000);

  const system = `You are an AI agent reflecting on a completed step in a multi-step task.
Analyse what happened, decide if the overall plan needs to change, and extract any facts or insights worth remembering.

TASK: ${input.taskSummary}

PRIOR MEMORIES:
${input.priorMemories}

RULES FOR memoriesToWrite:
- FACT: concrete, timeless truth about the codebase (e.g. "repo uses NestJS v10", "bcrypt v4 used here")
- OBSERVATION: transient finding (e.g. "auth endpoint is slow")
- DECISION: a choice made (e.g. "decided to use argon2 instead of bcrypt")
- INSIGHT: cross-run pattern (e.g. "team never writes unit tests for utility functions")
- RESEARCH: verbatim web research result worth remembering
- Only write memories that are genuinely useful for future tasks. Skip trivial observations.

Respond ONLY with valid JSON matching this exact schema:
${REFLECT_OUTPUT_SCHEMA_DOC}`;

  const user = `Step completed:
Title: ${input.step.title}
Description: ${input.step.description}
Tool used: ${input.step.toolName ?? 'none (reasoning step)'}

Tool input:
${toolInputStr}

Tool output:
${toolOutputStr}`;

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}
