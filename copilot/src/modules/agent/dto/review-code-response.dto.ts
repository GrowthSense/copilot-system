import { ReviewFinding } from '../../llm/schemas/review-code.schema';

export class ReviewCodeResponseDto {
  runId: string;
  reviewId: string;
  filePath: string;
  summary: string;
  overallRisk: string;
  findings: ReviewFinding[];
  positives: string[];
  testingRecommendations: string[];
  durationMs: number;
}
