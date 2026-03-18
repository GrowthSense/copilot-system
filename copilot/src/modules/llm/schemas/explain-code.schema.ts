import { z } from 'zod';

export const ExplainCodeOutputSchema = z.object({
  summary: z.string().min(1),
  purpose: z.string().min(1),
  keyComponents: z.array(
    z.object({
      name: z.string(),
      type: z.enum([
        'function',
        'class',
        'interface',
        'type',
        'variable',
        'export',
        'decorator',
        'other',
      ]),
      description: z.string(),
    }),
  ),
  dependencies: z.array(z.string()),
  sideEffects: z.array(z.string()),
  complexity: z.enum(['low', 'medium', 'high']),
  testability: z.enum(['high', 'medium', 'low']),
  suggestions: z.array(z.string()),
});

export type ExplainCodeOutput = z.infer<typeof ExplainCodeOutputSchema>;

export interface ExplainCodeInput {
  filePath: string;
  content: string;
  language?: string;
  context?: string;
}

export const EXPLAIN_CODE_OUTPUT_SCHEMA_DOC = `{
  "summary": "string — one-paragraph summary of what the file does",
  "purpose": "string — the domain purpose / business reason this code exists",
  "keyComponents": [
    {
      "name": "string — identifier name",
      "type": "function | class | interface | type | variable | export | decorator | other",
      "description": "string — what it does"
    }
  ],
  "dependencies": ["string[] — imported packages or internal modules"],
  "sideEffects": ["string[] — observable side effects (DB writes, HTTP calls, state mutations, etc.)"],
  "complexity": "low | medium | high",
  "testability": "high | medium | low",
  "suggestions": ["string[] — concrete improvement suggestions"]
}`;
