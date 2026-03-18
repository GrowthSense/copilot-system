import { z } from 'zod';

export const TaskPlanStepSchema = z.object({
  stepIndex: z.number().int().min(0),
  title: z.string().min(1),
  description: z.string().min(1),
  toolName: z.string().optional(),
  toolInputHint: z.record(z.unknown()).optional(),
  requiresApproval: z.boolean(),
  reasoning: z.string(),
});

export const TaskPlanOutputSchema = z.object({
  taskSummary: z.string().min(1),
  steps: z.array(TaskPlanStepSchema).min(1).max(12),
  memoryQueries: z.array(z.string()),
  estimatedRiskLevel: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  planReasoning: z.string(),
});

export type TaskPlanStep = z.infer<typeof TaskPlanStepSchema>;
export type TaskPlanOutput = z.infer<typeof TaskPlanOutputSchema>;

export interface TaskPlanInput {
  userPrompt: string;
  repoName?: string;
  existingMemories: string;
  availableTools: string[];
  pathPrefix?: string;
}

export const TASK_PLAN_OUTPUT_SCHEMA_DOC = `{
  "taskSummary": "string — one-sentence summary of the overall task",
  "estimatedRiskLevel": "LOW | MEDIUM | HIGH | CRITICAL",
  "planReasoning": "string — why you chose these steps",
  "memoryQueries": ["string[] — memory subjects to look up before starting"],
  "steps": [
    {
      "stepIndex": 0,
      "title": "string — short step title",
      "description": "string — what this step does and why",
      "toolName": "string | undefined — tool name if a tool is called, omit for reasoning-only steps",
      "toolInputHint": { "key": "value" },
      "requiresApproval": false,
      "reasoning": "string — why this step is needed"
    }
  ]
}`;
