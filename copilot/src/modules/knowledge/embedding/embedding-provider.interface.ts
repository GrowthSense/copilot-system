/**
 * Provider interface for text embedding models.
 *
 * Phase 5 implementation notes:
 * - Wire OpenAI text-embedding-3-small (1536 dims) via OpenAiEmbeddingProvider
 * - Uncomment the `embedding Unsupported("vector(1536)")?` column in KnowledgeChunk
 * - Run: prisma migrate dev --name add_chunk_embeddings
 * - Replace keyword scoring in RetrievalService with pgvector cosine similarity
 */
export interface IEmbeddingProvider {
  readonly providerName: string;
  /** Output vector dimensions (e.g. 1536 for text-embedding-3-small). */
  readonly dimensions: number;
  /** Embed a single text string. Returns a float array of length `dimensions`. */
  embed(text: string): Promise<number[]>;
  /** Batch embed multiple strings. More efficient than calling embed() in a loop. */
  embedBatch(texts: string[]): Promise<number[][]>;
}
