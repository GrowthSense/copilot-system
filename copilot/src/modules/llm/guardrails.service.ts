import { Injectable, Logger } from '@nestjs/common';
import { LlmCompletionResponse, LlmMessage } from './interfaces/llm-completion.interface';
import {
  LlmContextTooLargeException,
  LlmGuardrailException,
} from './llm.exception';

/** Rough token estimate: 4 chars per token with a 10 % safety buffer. */
const CHARS_PER_TOKEN = 4;
const TOKEN_OVERHEAD_PER_MESSAGE = 4; // role + formatting

@Injectable()
export class GuardrailsService {
  private readonly logger = new Logger(GuardrailsService.name);

  // ─── Pre-request ─────────────────────────────────────────────────────────────

  estimateTokenCount(text: string): number {
    return Math.ceil((text.length / CHARS_PER_TOKEN) * 1.1);
  }

  estimateMessagesTokenCount(messages: LlmMessage[]): number {
    const textTokens = messages.reduce(
      (sum, m) => sum + this.estimateTokenCount(m.content),
      0,
    );
    return textTokens + messages.length * TOKEN_OVERHEAD_PER_MESSAGE;
  }

  assertContextWithinBudget(messages: LlmMessage[], maxContextTokens: number): void {
    const estimated = this.estimateMessagesTokenCount(messages);
    if (estimated > maxContextTokens) {
      this.logger.warn(
        `Context budget exceeded: ~${estimated} tokens estimated, limit=${maxContextTokens}`,
      );
      throw new LlmContextTooLargeException(estimated, maxContextTokens);
    }
  }

  assertMessagesNotEmpty(messages: LlmMessage[]): void {
    if (!messages || messages.length === 0) {
      throw new LlmGuardrailException('Messages array must not be empty');
    }
  }

  // ─── Post-response ───────────────────────────────────────────────────────────

  assertResponseNotEmpty(response: LlmCompletionResponse): void {
    if (!response.content || response.content.trim().length === 0) {
      throw new LlmGuardrailException(
        'LLM returned an empty response — the model may have refused or encountered an error',
      );
    }
  }

  assertFinishReasonNotLength(response: LlmCompletionResponse): void {
    if (response.finishReason === 'length') {
      throw new LlmGuardrailException(
        `LLM output was truncated (finishReason=length). ` +
          `Received ${response.completionTokens} completion tokens. ` +
          `Increase LLM_MAX_TOKENS or reduce the size of the context passed to the prompt.`,
      );
    }
  }

  assertResponseSizeWithinBudget(
    response: LlmCompletionResponse,
    maxChars = 200_000,
  ): void {
    if (response.content.length > maxChars) {
      throw new LlmGuardrailException(
        `LLM response (${response.content.length} chars) exceeds the ` +
          `maximum allowed size of ${maxChars} characters`,
      );
    }
  }
}
