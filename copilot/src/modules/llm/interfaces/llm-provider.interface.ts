import { LlmCompletionRequest, LlmCompletionResponse } from './llm-completion.interface';

export interface ILlmProvider {
  readonly providerName: string;
  complete(request: LlmCompletionRequest): Promise<LlmCompletionResponse>;
}
