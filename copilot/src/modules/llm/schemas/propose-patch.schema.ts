import { z } from 'zod';

export const ProposePatchOutputSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  diff: z.string().min(1),
  filePaths: z.array(z.string()).min(1),
  riskLevel: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  reasoning: z.string().min(1),
  testingNotes: z.string(),
  breakingChanges: z.boolean(),
});

export type ProposePatchOutput = z.infer<typeof ProposePatchOutputSchema>;

export interface ProposePatchInput {
  request: string;
  repoName: string;
  targetFiles: Array<{
    filePath: string;
    content: string;
  }>;
  context?: string;
  constraints?: string[];
}

export const PROPOSE_PATCH_OUTPUT_SCHEMA_DOC = `{
  "title": "string — short patch title (≤72 chars)",
  "description": "string — what the patch does and why",
  "diff": "string — unified diff format (--- a/file\\n+++ b/file\\n@@ ... @@)",
  "filePaths": ["string[] — relative paths of all modified files"],
  "riskLevel": "LOW | MEDIUM | HIGH | CRITICAL",
  "reasoning": "string — why this approach was chosen",
  "testingNotes": "string — what to test and how to verify the patch",
  "breakingChanges": "boolean — true if public API surface changes"
}`;
