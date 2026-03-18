import { Logger } from '@nestjs/common';
import { AppConfigService } from '../../../config/config.service';
import { ILlmProvider } from '../interfaces/llm-provider.interface';
import {
  LlmCompletionRequest,
  LlmCompletionResponse,
} from '../interfaces/llm-completion.interface';
import { ExternalServiceException } from '../../../common/exceptions/app.exception';

/**
 * Anthropic provider stub.
 * Wire @anthropic-ai/sdk in Phase 4:
 *   npm install @anthropic-ai/sdk
 * Then replace the complete() body with an Anthropic.messages.create() call.
 */
export class AnthropicProvider implements ILlmProvider {
  readonly providerName = 'anthropic';
  private readonly logger = new Logger(AnthropicProvider.name);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(_config: AppConfigService) {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async complete(_request: LlmCompletionRequest): Promise<LlmCompletionResponse> {
    this.logger.error('Anthropic provider invoked but not yet initialised');
    throw new ExternalServiceException(
      'Anthropic',
      'Anthropic provider not yet initialised — wire @anthropic-ai/sdk in Phase 4',
    );
  }
}
