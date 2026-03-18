import { Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { AppConfigService } from '../../../config/config.service';
import { ILlmProvider } from '../interfaces/llm-provider.interface';
import {
  LlmCompletionRequest,
  LlmCompletionResponse,
  LlmMessage,
  LlmToolCall,
} from '../interfaces/llm-completion.interface';
import { ExternalServiceException } from '../../../common/exceptions/app.exception';

export class AnthropicProvider implements ILlmProvider {
  readonly providerName = 'anthropic';
  private readonly logger = new Logger(AnthropicProvider.name);
  private readonly client: Anthropic;

  constructor(private readonly config: AppConfigService) {
    this.client = new Anthropic({ apiKey: config.llmApiKey });
  }

  async complete(request: LlmCompletionRequest): Promise<LlmCompletionResponse> {
    const model = request.model ?? this.config.llmModel;
    const hasTools = (request.tools?.length ?? 0) > 0;

    this.logger.debug(
      `Anthropic completion: model=${model} messages=${request.messages.length} tools=${request.tools?.length ?? 0}`,
    );

    try {
      // Anthropic separates system prompt from the messages array
      const systemMessage = request.messages.find((m) => m.role === 'system')?.content;
      const conversationMessages = request.messages.filter((m) => m.role !== 'system');

      const params: Anthropic.MessageCreateParamsNonStreaming = {
        model,
        max_tokens: request.maxTokens ?? this.config.llmMaxTokens ?? 4096,
        ...(systemMessage ? { system: systemMessage } : {}),
        messages: conversationMessages.map((m) => this.toAnthropicMessage(m)),
        ...(hasTools
          ? {
              tools: request.tools!.map((t) => ({
                name: t.name,
                description: t.description,
                input_schema: t.inputSchema as Anthropic.Tool['input_schema'],
              })),
            }
          : {}),
      };

      const response = await this.client.messages.create(params);

      // Extract text and tool use blocks
      let content = '';
      const toolCalls: LlmToolCall[] = [];

      for (const block of response.content) {
        if (block.type === 'text') {
          content += block.text;
        } else if (block.type === 'tool_use') {
          toolCalls.push({
            id: block.id,
            name: block.name,
            arguments: block.input as Record<string, unknown>,
          });
        }
      }

      const finishReason =
        response.stop_reason === 'tool_use'
          ? 'tool_calls'
          : response.stop_reason ?? 'stop';

      return {
        content,
        toolCalls: toolCalls.length ? toolCalls : undefined,
        model: response.model,
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens,
        finishReason,
      };
    } catch (err) {
      if (err instanceof ExternalServiceException) throw err;
      const message = err instanceof Error ? err.message : String(err);
      throw new ExternalServiceException('Anthropic', message);
    }
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private toAnthropicMessage(
    m: LlmMessage,
  ): Anthropic.MessageParam {
    // Tool result message → Anthropic expects a user message with tool_result content block
    if (m.role === 'tool') {
      return {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: m.toolCallId ?? '',
            content: m.content,
          },
        ],
      };
    }

    // Assistant message with tool calls → include tool_use content blocks
    if (m.role === 'assistant' && m.toolCalls?.length) {
      const blocks: Anthropic.Messages.ContentBlockParam[] = [];
      if (m.content) blocks.push({ type: 'text', text: m.content });
      for (const tc of m.toolCalls) {
        blocks.push({
          type: 'tool_use',
          id: tc.id,
          name: tc.name,
          input: tc.arguments,
        });
      }
      return { role: 'assistant', content: blocks };
    }

    // Standard user / assistant message
    return {
      role: m.role as 'user' | 'assistant',
      content: m.content,
    };
  }
}
