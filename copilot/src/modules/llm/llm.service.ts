import { Inject, Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import { AppConfigService } from '../../config/config.service';
import { ILlmProvider } from './interfaces/llm-provider.interface';
import {
  LlmMessage,
  LlmCompletionResponse,
  StructuredCompletionOptions,
} from './interfaces/llm-completion.interface';
import { LLM_PROVIDER_TOKEN } from './providers/llm-provider.token';
import { PromptBuilderService } from './prompt-builder.service';
import { OutputParserService } from './output-parser.service';
import { GuardrailsService } from './guardrails.service';
import { LlmOutputParseException } from './llm.exception';
import { RepoQuestionInput, RepoQuestionOutput, RepoQuestionOutputSchema } from './schemas/repo-question.schema';
import { FindFilesInput, FindFilesOutput, FindFilesOutputSchema } from './schemas/find-files.schema';
import { ExplainCodeInput, ExplainCodeOutput, ExplainCodeOutputSchema } from './schemas/explain-code.schema';
import { ProposePatchInput, ProposePatchOutput, ProposePatchOutputSchema } from './schemas/propose-patch.schema';
import { GenerateTestsInput, GenerateTestsOutput, GenerateTestsOutputSchema } from './schemas/generate-tests.schema';
import { CreatePrDraftInput, CreatePrDraftOutput, CreatePrDraftOutputSchema } from './schemas/create-pr-draft.schema';
import { ReviewCodeInput, ReviewCodeOutput, ReviewCodeOutputSchema } from './schemas/review-code.schema';

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);

  constructor(
    @Inject(LLM_PROVIDER_TOKEN)
    private readonly provider: ILlmProvider,
    private readonly config: AppConfigService,
    private readonly promptBuilder: PromptBuilderService,
    private readonly outputParser: OutputParserService,
    private readonly guardrails: GuardrailsService,
  ) {}

  // ─── Generic structured completion ──────────────────────────────────────────

  /**
   * Execute a completion and validate the output against a Zod schema.
   * Retries up to LLM_STRUCTURED_OUTPUT_RETRIES times, appending correction
   * feedback to the context on each retry.
   */
  async completeStructured<T>(
    messages: LlmMessage[],
    schema: z.ZodType<T>,
    options?: StructuredCompletionOptions,
  ): Promise<T> {
    this.guardrails.assertMessagesNotEmpty(messages);
    this.guardrails.assertContextWithinBudget(messages, this.config.llmMaxContextTokens);

    const maxRetries = this.config.llmStructuredOutputRetries;
    let currentMessages = messages;
    let lastError: LlmOutputParseException | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const response = await this.rawComplete(currentMessages, options);

      this.guardrails.assertResponseNotEmpty(response);
      this.guardrails.assertFinishReasonNotLength(response);

      const parseResult = this.outputParser.safeParseJson(response.content, schema);

      if (parseResult.success) {
        if (attempt > 0) {
          this.logger.log(`Structured output parsed successfully on retry ${attempt}`);
        }
        return parseResult.data;
      }

      lastError = parseResult.error;
      this.logger.warn(
        `Structured output parse failed (attempt ${attempt + 1}/${maxRetries + 1}): ${lastError.message}`,
      );

      if (attempt < maxRetries) {
        currentMessages = this.buildRetryMessages(
          currentMessages,
          response.content,
          lastError.message,
        );
      }
    }

    throw lastError ?? new LlmOutputParseException('All retry attempts exhausted');
  }

  // ─── Task-specific methods ───────────────────────────────────────────────────

  async answerRepoQuestion(input: RepoQuestionInput): Promise<RepoQuestionOutput> {
    this.logger.log(`answerRepoQuestion: repo=${input.repoName}`);
    const messages = this.promptBuilder.buildRepoQuestion(input);
    return this.completeStructured(messages, RepoQuestionOutputSchema);
  }

  async findFiles(input: FindFilesInput): Promise<FindFilesOutput> {
    this.logger.log(`findFiles: repo=${input.repoName} query="${input.query}"`);
    const messages = this.promptBuilder.buildFindFiles(input);
    return this.completeStructured(messages, FindFilesOutputSchema);
  }

  async explainCode(input: ExplainCodeInput): Promise<ExplainCodeOutput> {
    this.logger.log(`explainCode: file=${input.filePath}`);
    const messages = this.promptBuilder.buildExplainCode(input);
    return this.completeStructured(messages, ExplainCodeOutputSchema);
  }

  async proposePatch(input: ProposePatchInput): Promise<ProposePatchOutput> {
    this.logger.log(`proposePatch: repo=${input.repoName}`);
    const messages = this.promptBuilder.buildProposePatch(input);
    return this.completeStructured(messages, ProposePatchOutputSchema);
  }

  async generateTests(input: GenerateTestsInput): Promise<GenerateTestsOutput> {
    this.logger.log(`generateTests: file=${input.filePath}`);
    const messages = this.promptBuilder.buildGenerateTests(input);
    return this.completeStructured(messages, GenerateTestsOutputSchema);
  }

  async createPrDraft(input: CreatePrDraftInput): Promise<CreatePrDraftOutput> {
    this.logger.log(`createPrDraft: repo=${input.repoName}`);
    const messages = this.promptBuilder.buildCreatePrDraft(input);
    return this.completeStructured(messages, CreatePrDraftOutputSchema);
  }

  async reviewCode(input: ReviewCodeInput): Promise<ReviewCodeOutput> {
    this.logger.log(`reviewCode: file=${input.filePath}`);
    const messages = this.promptBuilder.buildReviewCode(input);
    return this.completeStructured(messages, ReviewCodeOutputSchema);
  }

  /**
   * Plain text completion — no JSON schema, no retry logic.
   * Use this for conversational responses where structured output isn't needed.
   */
  async completeText(
    messages: LlmMessage[],
    options?: StructuredCompletionOptions,
  ): Promise<string> {
    this.guardrails.assertMessagesNotEmpty(messages);
    this.guardrails.assertContextWithinBudget(messages, this.config.llmMaxContextTokens);

    const response = await this.provider.complete({
      messages,
      model: options?.model,
      maxTokens: options?.maxTokens,
      temperature: options?.temperature,
      // No responseFormat — plain text
    });

    this.guardrails.assertResponseNotEmpty(response);
    return response.content.trim();
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

  private async rawComplete(
    messages: LlmMessage[],
    options?: StructuredCompletionOptions,
  ): Promise<LlmCompletionResponse> {
    return this.provider.complete({
      messages,
      model: options?.model,
      maxTokens: options?.maxTokens,
      temperature: options?.temperature,
      responseFormat: 'json_object',
    });
  }

  private buildRetryMessages(
    original: LlmMessage[],
    badOutput: string,
    errorMessage: string,
  ): LlmMessage[] {
    return [
      ...original,
      { role: 'assistant', content: badOutput },
      {
        role: 'user',
        content:
          `Your previous response was not valid JSON matching the required schema.\n` +
          `Error: ${errorMessage}\n` +
          `Please respond with valid JSON only, exactly matching the schema specified in the system message.`,
      },
    ];
  }
}
