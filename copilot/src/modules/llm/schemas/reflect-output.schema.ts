import { z } from 'zod';

export const MemoryWriteItemSchema = z.object({
  type: z.enum(['FACT', 'OBSERVATION', 'DECISION', 'INSIGHT', 'RESEARCH']),
  subject: z.string().min(1),
  content: z.string().min(1),
  confidence: z.number().min(0).max(1).optional(),
  tags: z.array(z.string()).optional(),
});

export const ReflectOutputSchema = z.object({
  stepSucceeded: z.boolean(),
  observation: z.string(),
  replanNeeded: z.boolean(),
  replanReason: z.string().optional(),
  memoriesToWrite: z.array(MemoryWriteItemSchema),
  nextStepAdjustment: z.string().optional(),
});

export type MemoryWriteItem = z.infer<typeof MemoryWriteItemSchema>;
export type ReflectOutput = z.infer<typeof ReflectOutputSchema>;

export interface ReflectInput {
  taskSummary: string;
  step: { title: string; description: string; toolName?: string };
  toolInput: unknown;
  toolOutput: unknown;
  toolError: string | null;
  priorMemories: string;
}

export const REFLECT_OUTPUT_SCHEMA_DOC = `{
  "stepSucceeded": true,
  "observation": "string — what actually happened and what you learned",
  "replanNeeded": false,
  "replanReason": "string (optional) — why replanning is needed",
  "memoriesToWrite": [
    {
      "type": "FACT | OBSERVATION | DECISION | INSIGHT | RESEARCH",
      "subject": "string — short label e.g. bcrypt",
      "content": "string — the actual fact or insight to remember",
      "confidence": 0.9,
      "tags": ["security", "dependencies"]
    }
  ],
  "nextStepAdjustment": "string (optional) — instructions to adjust the next step"
}`;
