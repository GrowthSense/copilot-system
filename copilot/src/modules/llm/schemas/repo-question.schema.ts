import { z } from 'zod';
import { LlmMessage } from '../interfaces/llm-completion.interface';

export const RepoQuestionOutputSchema = z.object({
  answer: z.string().min(1, 'answer must not be empty'),
  confidence: z.number().min(0).max(1),
  relevantFiles: z.array(z.string()),
  reasoning: z.string(),
  caveats: z.array(z.string()),
});

export type RepoQuestionOutput = z.infer<typeof RepoQuestionOutputSchema>;

export interface RepoQuestionInput {
  question: string;
  repoName: string;
  codeContext: Array<{
    filePath: string;
    content: string;
  }>;
}

export const REPO_QUESTION_OUTPUT_SCHEMA_DOC = `{
  "answer": "string — clear technical answer to the question",
  "confidence": "number 0.0–1.0 — how confident you are given the available context",
  "relevantFiles": ["string[] — file paths most relevant to the answer"],
  "reasoning": "string — brief chain-of-thought used to arrive at the answer",
  "caveats": ["string[] — important gaps, assumptions, or missing context"]
}`;
