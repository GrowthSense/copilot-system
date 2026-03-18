import { HttpStatus } from '@nestjs/common';
import { AppException } from '../../common/exceptions/app.exception';

export class LlmOutputParseException extends AppException {
  constructor(
    detail: string,
    public readonly rawContent?: string,
  ) {
    super(
      `LLM output could not be parsed: ${detail}`,
      HttpStatus.UNPROCESSABLE_ENTITY,
      'LLM_OUTPUT_PARSE_ERROR',
    );
  }
}

export class LlmContextTooLargeException extends AppException {
  constructor(estimatedTokens: number, maxTokens: number) {
    super(
      `Context exceeds budget: ~${estimatedTokens} estimated tokens > ${maxTokens} max. ` +
        `Reduce the amount of code context passed to the prompt.`,
      HttpStatus.UNPROCESSABLE_ENTITY,
      'LLM_CONTEXT_TOO_LARGE',
    );
  }
}

export class LlmGuardrailException extends AppException {
  constructor(message: string) {
    super(message, HttpStatus.UNPROCESSABLE_ENTITY, 'LLM_GUARDRAIL_VIOLATION');
  }
}
