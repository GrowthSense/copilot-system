import { Injectable } from '@nestjs/common';
import { LlmMessage } from './interfaces/llm-completion.interface';
import { buildRepoQuestionMessages } from './prompts/repo-question.prompt';
import { buildFindFilesMessages } from './prompts/find-files.prompt';
import { buildExplainCodeMessages } from './prompts/explain-code.prompt';
import { buildProposePatchMessages } from './prompts/propose-patch.prompt';
import { buildGenerateTestsMessages } from './prompts/generate-tests.prompt';
import { buildCreatePrDraftMessages } from './prompts/create-pr-draft.prompt';
import { buildReviewCodeMessages } from './prompts/review-code.prompt';
import { buildScaffoldProjectMessages } from './prompts/scaffold-project.prompt';
import { buildTaskPlanMessages } from './prompts/task-plan.prompt';
import { buildReflectMessages } from './prompts/reflect.prompt';
import { buildInsightMessages } from './prompts/insight.prompt';
import { RepoQuestionInput } from './schemas/repo-question.schema';
import { FindFilesInput } from './schemas/find-files.schema';
import { ExplainCodeInput } from './schemas/explain-code.schema';
import { ProposePatchInput } from './schemas/propose-patch.schema';
import { GenerateTestsInput } from './schemas/generate-tests.schema';
import { CreatePrDraftInput } from './schemas/create-pr-draft.schema';
import { ReviewCodeInput } from './schemas/review-code.schema';
import { ScaffoldPlanInput } from './schemas/scaffold-project.schema';
import { TaskPlanInput } from './schemas/task-plan.schema';
import { ReflectInput } from './schemas/reflect-output.schema';
import { InsightInput } from './schemas/insight-output.schema';

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

  buildScaffoldProject(input: ScaffoldPlanInput): LlmMessage[] {
    return buildScaffoldProjectMessages(input);
  }

  buildTaskPlan(input: TaskPlanInput): LlmMessage[] {
    return buildTaskPlanMessages(input);
  }

  buildReflect(input: ReflectInput): LlmMessage[] {
    return buildReflectMessages(input);
  }

  buildInsight(input: InsightInput): LlmMessage[] {
    return buildInsightMessages(input);
  }
}
