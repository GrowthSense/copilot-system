import { LlmMessage } from '../interfaces/llm-completion.interface';
import { ScaffoldPlanInput, SCAFFOLD_PLAN_SCHEMA_DOC } from '../schemas/scaffold-project.schema';

const ALLOWED_TEMPLATES = [
  'create-next-app',
  'create-react-app',
  'create-vue',
  'create-vite',
  'create-svelte',
  'create-t3-app',
  'create-remix',
  'create-astro',
  'create-nuxt-app',
  'create-expo-app',
  'create-react-native-app',
  'create-express-app',
  '@nestjs/cli',
  '@angular/cli',
];

export function buildScaffoldProjectMessages(input: ScaffoldPlanInput): LlmMessage[] {
  const systemPrompt = `You are a senior software architect. Your job is to select the best project scaffolding template and configuration based on the user's description.

Allowed templates (npx create-* packages):
${ALLOWED_TEMPLATES.map((t) => `  - ${t}`).join('\n')}

Rules:
- Choose ONLY from the allowed templates list above.
- For NestJS/backend API projects: use "@nestjs/cli" with extraArgs ["new", "--skip-git", "--package-manager", "npm"].
- For Next.js/React fullstack: use "create-next-app" with extraArgs ["--typescript", "--no-git", "--eslint"].
- For plain React SPA: use "create-react-app" with extraArgs ["--template", "typescript"].
- For Vite-based projects: use "create-vite" with appropriate --template flag.
- Always add "--no-git" or "--skip-git" flags when available to avoid nested git repos.
- The buildScript should be the npm script name that compiles/builds the project (usually "build").

Respond with ONLY valid JSON matching this schema:
${SCAFFOLD_PLAN_SCHEMA_DOC}`;

  const userPrompt = `Project description: ${input.description}
Project name: ${input.projectName}${input.frameworkHint ? `\nFramework hint: ${input.frameworkHint}` : ''}

Select the best scaffolding template and configuration.`;

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];
}
