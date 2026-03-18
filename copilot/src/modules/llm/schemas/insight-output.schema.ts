import { z } from 'zod';

export const InsightItemSchema = z.object({
  subject: z.string().min(1),
  content: z.string().min(1),
  confidence: z.number().min(0).max(1),
  tags: z.array(z.string()),
});

export const InsightOutputSchema = z.object({
  insights: z.array(InsightItemSchema),
  taskLearnings: z.string(),
});

export type InsightItem = z.infer<typeof InsightItemSchema>;
export type InsightOutput = z.infer<typeof InsightOutputSchema>;

export interface InsightInput {
  taskSummary: string;
  userPrompt: string;
  stepSummaries: string[];
  repoName?: string;
}

export const INSIGHT_OUTPUT_SCHEMA_DOC = `{
  "taskLearnings": "string — prose summary of what was learned during this task",
  "insights": [
    {
      "subject": "string — short label for this insight",
      "content": "string — the durable insight worth remembering long-term",
      "confidence": 0.85,
      "tags": ["patterns", "auth"]
    }
  ]
}`;
