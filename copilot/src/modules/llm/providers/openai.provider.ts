import { Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { AppConfigService } from '../../../config/config.service';
import { ILlmProvider } from '../interfaces/llm-provider.interface';
import {
  LlmCompletionRequest,
  LlmCompletionResponse,
  LlmMessage,
  LlmToolCall,
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
      timeout: 90_000, // 90 second hard timeout — prevents hanging forever
    });
  }

  async complete(request: LlmCompletionRequest): Promise<LlmCompletionResponse> {
    const model = request.model ?? this.config.llmModel;
    const hasTools = (request.tools?.length ?? 0) > 0;

    this.logger.debug(
      `OpenAI completion: model=${model} messages=${request.messages.length} format=${request.responseFormat ?? 'text'} tools=${request.tools?.length ?? 0}`,
    );

    try {
      const response = await this.client.chat.completions.create({
        model,
        messages: request.messages.map((m) => this.toOpenAiMessage(m)),
        max_tokens: request.maxTokens ?? this.config.llmMaxTokens,
        temperature: request.temperature ?? this.config.llmTemperature,
        // tools and json_object are mutually exclusive — don't set response_format when tools are present
        ...(!hasTools && request.responseFormat === 'json_object'
          ? { response_format: { type: 'json_object' as const } }
          : {}),
        ...(hasTools
          ? {
              tools: request.tools!.map((t) => ({
                type: 'function' as const,
                function: {
                  name: t.name,
                  description: t.description,
                  parameters: t.inputSchema,
                },
              })),
            }
          : {}),
      });

      const choice = response.choices[0];
      if (!choice) {
        throw new ExternalServiceException('OpenAI', 'Response contained no choices');
      }

      // Parse tool calls if present
      const toolCalls: LlmToolCall[] | undefined = choice.message.tool_calls?.map((tc) => ({
        id: tc.id,
        name: tc.function.name,
        arguments: this.safeParseArguments(tc.function.arguments),
      }));

      return {
        content: choice.message.content ?? '',
        toolCalls: toolCalls?.length ? toolCalls : undefined,
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

  // ─── Private helpers ──────────────────────────────────────────────────────

  private toOpenAiMessage(m: LlmMessage): OpenAI.Chat.ChatCompletionMessageParam {
    if (m.role === 'tool') {
      return {
        role: 'tool',
        tool_call_id: m.toolCallId ?? '',
        content: m.content,
      };
    }

    if (m.role === 'assistant' && m.toolCalls?.length) {
      return {
        role: 'assistant',
        content: m.content || null,
        tool_calls: m.toolCalls.map((tc) => ({
          id: tc.id,
          type: 'function' as const,
          function: {
            name: tc.name,
            arguments: JSON.stringify(tc.arguments),
          },
        })),
      };
    }

    return { role: m.role as 'system' | 'user' | 'assistant', content: m.content };
  }

  private safeParseArguments(raw: string): Record<string, unknown> {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
}
