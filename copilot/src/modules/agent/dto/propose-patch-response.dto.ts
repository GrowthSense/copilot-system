import { RiskLevel } from '../../../common/enums/risk-level.enum';

export class ProposePatchResponseDto {
  /** The AgentRun ID — retrieve via GET /api/v1/runs/:runId for full step audit trail. */
  runId: string;

  /** The persisted PatchProposal ID — retrieve via GET /api/v1/patches/:patchId. */
  patchId: string;

  /** Short title for the patch (≤72 chars). */
  title: string;

  /** What the patch does and why. */
  description: string;

  /** Unified diff in `--- a/file / +++ b/file / @@ ... @@` format. */
  diff: string;

  /** Relative paths of all files the patch modifies. */
  filePaths: string[];

  riskLevel: RiskLevel;

  /** True if any exported interface, public API surface, or DB schema changes. */
  breakingChanges: boolean;

  /** LLM's reasoning: why this approach was chosen over alternatives. */
  reasoning: string;

  /** What to test and how to verify the patch is correct. */
  testingNotes: string;

  /**
   * Non-fatal validation warnings flagged by PatchValidatorService.
   * Empty when the patch passed cleanly.
   */
  validationWarnings: string[];

  durationMs: number;
}
