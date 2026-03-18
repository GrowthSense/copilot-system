import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LlmProvider } from '../common/enums/llm-provider.enum';

@Injectable()
export class AppConfigService {
  constructor(private readonly config: ConfigService) {}

  get nodeEnv(): string {
    return this.config.getOrThrow<string>('NODE_ENV');
  }

  get port(): number {
    return this.config.getOrThrow<number>('PORT');
  }

  get appName(): string {
    return this.config.getOrThrow<string>('APP_NAME');
  }

  get databaseUrl(): string {
    return this.config.getOrThrow<string>('DATABASE_URL');
  }

  get llmProvider(): LlmProvider {
    return this.config.getOrThrow<LlmProvider>('LLM_PROVIDER');
  }

  get llmApiKey(): string {
    return this.config.getOrThrow<string>('LLM_API_KEY');
  }

  get llmModel(): string {
    return this.config.getOrThrow<string>('LLM_MODEL');
  }

  get llmMaxTokens(): number {
    return this.config.getOrThrow<number>('LLM_MAX_TOKENS');
  }

  get llmTemperature(): number {
    return this.config.getOrThrow<number>('LLM_TEMPERATURE');
  }

  get llmStructuredOutputRetries(): number {
    return this.config.getOrThrow<number>('LLM_STRUCTURED_OUTPUT_RETRIES');
  }

  get llmMaxContextTokens(): number {
    return this.config.getOrThrow<number>('LLM_MAX_CONTEXT_TOKENS');
  }

  /** Optional base URL override — use for OpenRouter or other OpenAI-compatible APIs. */
  get llmBaseUrl(): string {
    return this.config.get<string>('LLM_BASE_URL') ?? '';
  }

  // ─── GitHub ───────────────────────────────────────────────────────────────

  /**
   * Personal Access Token for GitHub API calls.
   * Takes precedence over GitHub App credentials.
   * Required when GITHUB_APP_ID is not set.
   */
  get githubToken(): string {
    return this.config.get<string>('GITHUB_TOKEN') ?? '';
  }

  /** GitHub App ID (alternative to PAT — requires private key too). */
  get githubAppId(): string {
    return this.config.get<string>('GITHUB_APP_ID') ?? '';
  }

  /** GitHub App private key PEM string. */
  get githubAppPrivateKey(): string {
    return this.config.get<string>('GITHUB_APP_PRIVATE_KEY') ?? '';
  }

  /** GitHub webhook signing secret (for incoming webhook validation). */
  get githubWebhookSecret(): string {
    return this.config.get<string>('GITHUB_WEBHOOK_SECRET') ?? '';
  }

  /**
   * Default base branch for pull requests.
   * Overridable per-request via the `baseBranch` DTO field.
   * Defaults to "main".
   */
  get githubBaseBranch(): string {
    return this.config.get<string>('GITHUB_BASE_BRANCH') ?? 'main';
  }

  // ─── Vector ───────────────────────────────────────────────────────────────

  get vectorDimension(): number {
    return this.config.getOrThrow<number>('VECTOR_DIMENSION');
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  get isProduction(): boolean {
    return this.nodeEnv === 'production';
  }

  get isDevelopment(): boolean {
    return this.nodeEnv === 'development';
  }
}
