import { z } from 'zod';

export const FindFilesOutputSchema = z.object({
  files: z.array(
    z.object({
      path: z.string().min(1),
      relevanceScore: z.number().min(0).max(1),
      reason: z.string(),
    }),
  ),
  searchStrategy: z.string(),
  totalMatches: z.number().int().nonnegative(),
});

export type FindFilesOutput = z.infer<typeof FindFilesOutputSchema>;

export interface FindFilesInput {
  query: string;
  repoName: string;
  fileList: string[];
  limit?: number;
}

export const FIND_FILES_OUTPUT_SCHEMA_DOC = `{
  "files": [
    {
      "path": "string — relative file path",
      "relevanceScore": "number 0.0–1.0",
      "reason": "string — why this file is relevant"
    }
  ],
  "searchStrategy": "string — brief description of how you matched files",
  "totalMatches": "integer — total number of relevant files found (may exceed the returned list)"
}`;
