export class KeyComponentDto {
  name: string;
  type:
    | 'function'
    | 'class'
    | 'interface'
    | 'type'
    | 'variable'
    | 'export'
    | 'decorator'
    | 'other';
  description: string;
}

export class ExplainCodeResponseDto {
  runId: string;
  filePath: string;

  /** One-paragraph plain-English summary of what the file does. */
  summary: string;

  /** Domain / business purpose — why this code exists at all. */
  purpose: string;

  /** Key functions, classes, interfaces, and other named components. */
  keyComponents: KeyComponentDto[];

  /** Imported packages and internal module dependencies. */
  dependencies: string[];

  /** Observable side effects: DB writes, HTTP calls, state mutations, etc. */
  sideEffects: string[];

  complexity: 'low' | 'medium' | 'high';
  testability: 'high' | 'medium' | 'low';

  /** Concrete improvement suggestions from the LLM. */
  suggestions: string[];

  durationMs: number;
}
