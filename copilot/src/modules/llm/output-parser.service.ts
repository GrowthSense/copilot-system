import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import { LlmOutputParseException } from './llm.exception';

export type SafeParseSuccess<T> = { success: true; data: T };
export type SafeParseFailure = { success: false; error: LlmOutputParseException };
export type SafeParseResult<T> = SafeParseSuccess<T> | SafeParseFailure;

@Injectable()
export class OutputParserService {
  private readonly logger = new Logger(OutputParserService.name);

  /**
   * Parse and validate LLM output against a Zod schema.
   * Throws LlmOutputParseException on failure.
   */
  parseJson<T>(content: string, schema: z.ZodType<T>): T {
    const result = this.safeParseJson(content, schema);
    if (!result.success) throw result.error;
    return result.data;
  }

  /**
   * Same as parseJson but returns a discriminated union instead of throwing.
   * Use this when you want to handle the error (e.g. for retry logic).
   */
  safeParseJson<T>(content: string, schema: z.ZodType<T>): SafeParseResult<T> {
    const extracted = this.extractJsonString(content);

    let parsed: unknown;
    try {
      parsed = JSON.parse(extracted);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown JSON parse error';
      this.logger.debug(`JSON parse failed. Raw content (first 500 chars): ${content.slice(0, 500)}`);
      return {
        success: false,
        error: new LlmOutputParseException(`JSON parse failed: ${msg}`, content),
      };
    }

    const result = schema.safeParse(parsed);
    if (!result.success) {
      const issues = result.error.issues
        .map((i) => `[${i.path.join('.') || 'root'}] ${i.message}`)
        .join('; ');
      this.logger.debug(`Schema validation failed: ${issues}`);
      return {
        success: false,
        error: new LlmOutputParseException(
          `Schema validation failed: ${issues}`,
          content,
        ),
      };
    }

    return { success: true, data: result.data };
  }

  /**
   * Try to extract a JSON object string from LLM output that may contain
   * markdown code fences, preamble, or trailing text.
   */
  private extractJsonString(text: string): string {
    // Strip ```json ... ``` or ``` ... ``` fences
    const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (fenceMatch) return fenceMatch[1].trim();

    // Find outermost { ... }
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start !== -1 && end > start) return text.slice(start, end + 1);

    return text.trim();
  }
}
