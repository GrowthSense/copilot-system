import { z } from 'zod';

export const ScaffoldPlanOutputSchema = z.object({
  template: z.string().min(1, 'template must not be empty'),
  extraArgs: z.array(z.string()),
  buildScript: z.string().optional(),
  reasoning: z.string(),
});

export type ScaffoldPlanOutput = z.infer<typeof ScaffoldPlanOutputSchema>;

export interface ScaffoldPlanInput {
  description: string;
  projectName: string;
  frameworkHint?: string;
}

export const SCAFFOLD_PLAN_SCHEMA_DOC = `{
  "template": "string — npx create-* package name (must be one of the allowed templates)",
  "extraArgs": ["string[] — CLI flags to pass to the scaffold tool (e.g. --typescript --no-git)"],
  "buildScript": "string — npm script name to build the project (default: build)",
  "reasoning": "string — brief explanation of why this template was chosen"
}`;
