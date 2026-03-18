import { Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { AppConfigService } from '../../../config/config.service';
import { ILlmProvider } from '../interfaces/llm-provider.interface';
import {
  LlmCompletionRequest,
  LlmCompletionResponse,
} from '../interfaces/llm-completion.interface';
import { ExternalServiceException } from '../../../common/exceptions/app.exception';

export class OpenAiProvider implements ILlmProvider {
  readonly providerName = 'openai';
  private readonly logger = new Logger(OpenAiProvider.name);
  private readonly client: OpenAI;

  constructor(private readonly config: AppConfigService) {
    this.client = new OpenAI({
      apiKey: config.llmApiKey,
      ...(config.llmBaseUrl ? { baseURL: config.llmBaseUrl } : {}),
      defaultHeaders: config.llmBaseUrl
        ? { 'HTTP-Referer': 'https://buntu.finance', 'X-Title': 'Buntu Copilot' }
        : {},
    });
  }

  async complete(request: LlmCompletionRequest): Promise<LlmCompletionResponse> {
    const model = request.model ?? this.config.llmModel;
    this.logger.debug(
      `OpenAI completion: model=${model} messages=${request.messages.length} format=${request.responseFormat ?? 'text'}`,
    );

    try {
      const response = await this.client.chat.completions.create({
        model,
        messages: request.messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        max_tokens: request.maxTokens ?? this.config.llmMaxTokens,
        temperature: request.temperature ?? this.config.llmTemperature,
        ...(request.responseFormat === 'json_object'
          ? { response_format: { type: 'json_object' as const } }
          : {}),
      });

      const choice = response.choices[0];
      if (!choice) {
        throw new ExternalServiceException('OpenAI', 'Response contained no choices');
      }

      return {
        content: choice.message.content ?? '',
        model: response.model,
        promptTokens: response.usage?.prompt_tokens ?? 0,
        completionTokens: response.usage?.completion_tokens ?? 0,
        totalTokens: response.usage?.total_tokens ?? 0,
        finishReason: choice.finish_reason ?? 'stop',
      };
    } catch (err) {
      if (err instanceof ExternalServiceException) throw err;
      const message = err instanceof Error ? err.message : String(err);
      throw new ExternalServiceException('OpenAI', message);
    }
  }
}
