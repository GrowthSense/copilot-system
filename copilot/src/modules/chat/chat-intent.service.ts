import { Injectable } from '@nestjs/common';

export type ChatIntent = 'review' | 'generate_tests' | 'explain' | 'chat';

@Injectable()
export class ChatIntentService {
  /**
   * Classify the user's intent from a plain-text chat message.
   * Returns 'chat' as the fallback for anything unrecognised.
   */
  detectIntent(message: string): ChatIntent {
    const lower = message.toLowerCase().trim();

    if (/\b(review|code\s*review|audit)\b/.test(lower)) return 'review';
    if (/\b(generate\s+tests?|write\s+tests?|create\s+tests?|add\s+tests?)\b/.test(lower)) return 'generate_tests';
    if (/\b(explain|describe|what\s+does|how\s+does)\b/.test(lower)) return 'explain';

    return 'chat';
  }

  /**
   * Extract a relative file path from a message.
   * Matches patterns like "src/foo/bar.ts", "modules/auth.service.ts", etc.
   * Returns null if no plausible path is found.
   */
  extractFilePath(message: string): string | null {
    // Match src/..., lib/..., app/..., or any path ending with a known extension
    const pathRe = /(?:^|\s)((?:src|lib|app|test|modules?|components?|pages?|utils?|common)[/\\][\w./-]+\.[a-z]{2,4}|\b[\w./-]+\.(?:ts|js|tsx|jsx|py|go|java|rs|rb|cs|php|vue|svelte)\b)/i;
    const match = pathRe.exec(message);
    return match ? match[1].trim() : null;
  }
}
