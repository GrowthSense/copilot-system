import { Injectable } from '@nestjs/common';
import { LlmMessage } from './interfaces/llm-completion.interface';
import { buildRepoQuestionMessages } from './prompts/repo-question.prompt';
import { buildFindFilesMessages } from './prompts/find-files.prompt';
import { buildExplainCodeMessages } from './prompts/explain-code.prompt';
import { buildProposePatchMessages } from './prompts/propose-patch.prompt';
import { buildGenerateTestsMessages } from './prompts/generate-tests.prompt';
import { buildCreatePrDraftMessages } from './prompts/create-pr-draft.prompt';
import { buildReviewCodeMessages } from './prompts/review-code.prompt';
import { RepoQuestionInput } from './schemas/repo-question.schema';
import { FindFilesInput } from './schemas/find-files.schema';
import { ExplainCodeInput } from './schemas/explain-code.schema';
import { ProposePatchInput } from './schemas/propose-patch.schema';
import { GenerateTestsInput } from './schemas/generate-tests.schema';
import { CreatePrDraftInput } from './schemas/create-pr-draft.schema';
import { ReviewCodeInput } from './schemas/review-code.schema';

@Injectable()
export class PromptBuilderService {
  buildRepoQuestion(input: RepoQuestionInput): LlmMessage[] {
    return buildRepoQuestionMessages(input);
  }

  buildFindFiles(input: FindFilesInput): LlmMessage[] {
    return buildFindFilesMessages(input);
  }

  buildExplainCode(input: ExplainCodeInput): LlmMessage[] {
    return buildExplainCodeMessages(input);
  }

  buildProposePatch(input: ProposePatchInput): LlmMessage[] {
    return buildProposePatchMessages(input);
  }

  buildGenerateTests(input: GenerateTestsInput): LlmMessage[] {
    return buildGenerateTestsMessages(input);
  }

  buildCreatePrDraft(input: CreatePrDraftInput): LlmMessage[] {
    return buildCreatePrDraftMessages(input);
  }

  buildReviewCode(input: ReviewCodeInput): LlmMessage[] {
    return buildReviewCodeMessages(input);
  }
}
