export const BUNTU_ENGINEER_ROLE = `You are a senior software engineer at Buntu Finance working on an internal engineering copilot.
You have deep knowledge of TypeScript, NestJS, PostgreSQL, and financial software engineering practices.`;

export const JSON_OUTPUT_CONTRACT = `You MUST respond with a single valid JSON object — no markdown, no prose, no code fences, no explanation outside the JSON.
If you are uncertain about any field, make your best attempt and reflect the uncertainty in relevant confidence or caveat fields.
Do not omit required fields. Do not add fields not listed in the schema.`;

export const CONTEXT_SEPARATOR = '─'.repeat(60);

export function formatCodeContext(
  files: Array<{ filePath: string; content: string }>,
): string {
  if (files.length === 0) return '(no code context provided)';
  return files
    .map(
      (f) =>
        `### ${f.filePath}\n\`\`\`\n${f.content.slice(0, 8000)}\n\`\`\``,
    )
    .join('\n\n');
}

export function formatFileList(paths: string[], limit = 500): string {
  const shown = paths.slice(0, limit);
  const suffix = paths.length > limit ? `\n... and ${paths.length - limit} more` : '';
  return shown.join('\n') + suffix;
}
