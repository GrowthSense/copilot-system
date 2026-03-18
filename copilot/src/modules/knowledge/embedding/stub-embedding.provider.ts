import { Logger } from '@nestjs/common';
import { IEmbeddingProvider } from './embedding-provider.interface';

/**
 * No-op embedding provider used until a real model is wired.
 * Returns zero vectors so the code path compiles and the column
 * can accept values without actually enabling vector search.
 *
 * Replace with OpenAiEmbeddingProvider (or similar) in Phase 5.
 */
export class StubEmbeddingProvider implements IEmbeddingProvider {
  readonly providerName = 'stub';
  readonly dimensions: number;

  private readonly logger = new Logger(StubEmbeddingProvider.name);

  constructor(dimensions = 1536) {
    this.dimensions = dimensions;
  }

  async embed(text: string): Promise<number[]> {
    this.logger.warn(
      `StubEmbeddingProvider.embed() called for text of length ${text.length}. ` +
        `Returning zero vector. Wire a real provider in Phase 5.`,
    );
    return new Array<number>(this.dimensions).fill(0);
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    this.logger.warn(
      `StubEmbeddingProvider.embedBatch() called for ${texts.length} texts. ` +
        `Returning zero vectors. Wire a real provider in Phase 5.`,
    );
    return texts.map(() => new Array<number>(this.dimensions).fill(0));
  }
}
