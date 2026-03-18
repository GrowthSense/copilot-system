import { KnowledgeSourceType } from '../../../common/enums/knowledge-source-type.enum';

export interface ParsedDocument {
  /** Extracted or supplied title for the document. */
  title: string;
  /** Fully normalised plain text — markup removed, whitespace normalised. */
  plainText: string;
  /** Logical sections found in the document. Used as chunking hints. */
  sections: DocumentSection[];
  /** Any hyperlinks found in the document (useful for web content). */
  extractedLinks: string[];
  /** Rough word count of the plain text. */
  wordCount: number;
}

export interface DocumentSection {
  heading?: string;
  content: string;
}

export interface IngestOptions {
  title?: string;
  sourceRef: string;
  sourceType: KnowledgeSourceType;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface ChunkOptions {
  /** Maximum characters per chunk. Default: 3600 (~900 tokens at 4 chars/token). */
  maxCharsPerChunk: number;
  /** Overlap characters carried from the tail of the previous chunk. Default: 360. */
  overlapChars: number;
}

export interface TextChunk {
  index: number;
  content: string;
  tokenEstimate: number;
  startChar: number;
  endChar: number;
}

export interface IngestResult {
  sourceId: string;
  title: string;
  sourceType: KnowledgeSourceType;
  chunksCreated: number;
  isDuplicate: boolean;
  checksum: string;
}

export interface ChunkResult {
  chunkId: string;
  sourceId: string;
  sourceTitle: string;
  sourceType: KnowledgeSourceType;
  sourceRef: string;
  chunkIndex: number;
  content: string;
  score: number;
  tags: string[];
}

export interface RetrievalQuery {
  query: string;
  topK?: number;
  sourceType?: KnowledgeSourceType;
  tags?: string[];
  sourceIds?: string[];
  minScore?: number;
}
