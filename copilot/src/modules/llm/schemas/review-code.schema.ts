import { z } from 'zod';

export const ReviewFindingSchema = z.object({
  severity: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']),
  category: z.enum([
    'SECURITY',
    'PERFORMANCE',
    'CORRECTNESS',
    'MAINTAINABILITY',
    'STYLE',
    'TESTING',
    'ERROR_HANDLING',
  ]),
  title: z.string().min(1),
  description: z.string().min(1),
  filePath: z.string(),
  lineStart: z.number().int().positive().optional(),
  lineEnd: z.number().int().positive().optional(),
  suggestion: z.string(),
  codeSnippet: z.string().optional(),
});

export const ReviewCodeOutputSchema = z.object({
  summary: z.string().min(1),
  overallRisk: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'NONE']),
  findings: z.array(ReviewFindingSchema),
  positives: z.array(z.string()),
  testingRecommendations: z.array(z.string()),
});

export type ReviewFinding = z.infer<typeof ReviewFindingSchema>;
export type ReviewCodeOutput = z.infer<typeof ReviewCodeOutputSchema>;

export interface ReviewCodeInput {
  filePath: string;
  content: string;
  language?: string;
  focusAreas?: string[];
  additionalContext?: string;
}

export const REVIEW_CODE_OUTPUT_SCHEMA_DOC = `{
  "summary": "string — 2-3 sentence overall code quality summary",
  "overallRisk": "CRITICAL | HIGH | MEDIUM | LOW | NONE",
  "findings": [
    {
      "severity": "CRITICAL | HIGH | MEDIUM | LOW",
      "category": "SECURITY | PERFORMANCE | CORRECTNESS | MAINTAINABILITY | STYLE | TESTING | ERROR_HANDLING",
      "title": "string — short finding title",
      "description": "string — detailed explanation of the issue",
      "filePath": "string — file path",
      "lineStart": "integer (optional) — start line",
      "lineEnd": "integer (optional) — end line",
      "suggestion": "string — actionable fix recommendation",
      "codeSnippet": "string (optional) — relevant code excerpt"
    }
  ],
  "positives": ["string[] — things done well in this code"],
  "testingRecommendations": ["string[] — specific test scenarios that should be covered"]
}`;
