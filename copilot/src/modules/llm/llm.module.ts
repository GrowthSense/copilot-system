import { Module } from '@nestjs/common';
import { LlmService } from './llm.service';
import { PromptBuilderService } from './prompt-builder.service';
import { OutputParserService } from './output-parser.service';
import { GuardrailsService } from './guardrails.service';
import { LLM_PROVIDER_TOKEN } from './providers/llm-provider.token';
import { OpenAiProvider } from './providers/openai.provider';
import { AnthropicProvider } from './providers/anthropic.provider';
import { AppConfigService } from '../../config/config.service';
import { LlmProvider } from '../../common/enums/llm-provider.enum';

const llmProviderFactory = {
  provide: LLM_PROVIDER_TOKEN,
  useFactory: (config: AppConfigService) => {
    switch (config.llmProvider) {
      case LlmProvider.OPENAI:
        return new OpenAiProvider(config);
      case LlmProvider.ANTHROPIC:
        return new AnthropicProvider(config);
      default:
        throw new Error(
          `LLM provider "${config.llmProvider}" is not supported. ` +
            `Supported values: openai, anthropic`,
        );
    }
  },
  inject: [AppConfigService],
};

@Module({
  providers: [
    llmProviderFactory,
    LlmService,
    PromptBuilderService,
    OutputParserService,
    GuardrailsService,
  ],
  exports: [LlmService, PromptBuilderService, OutputParserService, GuardrailsService],
})
export class LlmModule {}
