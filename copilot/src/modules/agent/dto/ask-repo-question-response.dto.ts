export class RelevantFileRefDto {
  filePath: string;
  /** Why this file was cited in the answer. */
  reason?: string;
}

export class AskRepoQuestionResponseDto {
  /** The AgentRun ID — use GET /api/v1/runs/:id for full step audit trail. */
  runId: string;

  question: string;

  /** The LLM's direct answer to the question. */
  answer: string;

  /** Confidence score in [0, 1] produced by the LLM. */
  confidence: number;

  /** Files the LLM cited as relevant to the answer. */
  relevantFiles: RelevantFileRefDto[];

  /** Chain-of-thought summary the LLM used to arrive at the answer. */
  reasoning: string;

  /** Gaps, assumptions, or caveats the LLM flagged. */
  caveats: string[];

  /** Wall-clock time for the entire orchestration in milliseconds. */
  durationMs: number;
}
