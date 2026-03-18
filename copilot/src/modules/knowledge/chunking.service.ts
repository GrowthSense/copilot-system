import { Injectable } from '@nestjs/common';
import { ChunkOptions, DocumentSection, TextChunk } from './interfaces/knowledge-source.interface';

const DEFAULT_CHUNK_OPTIONS: ChunkOptions = {
  maxCharsPerChunk: 3600,
  overlapChars: 360,
};

@Injectable()
export class ChunkingService {
  /**
   * Chunk a flat plain-text string using paragraph boundaries + overlap.
   *
   * Algorithm:
   * 1. Split input on double-newlines into paragraphs.
   * 2. Accumulate paragraphs until the next one would exceed `maxCharsPerChunk`.
   * 3. Emit a chunk, then seed the next window with `overlapChars` of tail text
   *    from the current chunk (carried over at paragraph boundary).
   * 4. Paragraphs that individually exceed `maxCharsPerChunk` are split on
   *    sentence boundaries (`. `, `? `, `! `).
   */
  chunkText(text: string, options?: Partial<ChunkOptions>): TextChunk[] {
    const opts = { ...DEFAULT_CHUNK_OPTIONS, ...options };
    const paragraphs = text
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    const segments = this.splitLongParagraphs(paragraphs, opts.maxCharsPerChunk);
    return this.buildChunks(segments, opts);
  }

  /**
   * Chunk a parsed document's sections, preserving heading context.
   *
   * Each section is processed independently: the heading (if present) is
   * prepended to every chunk that originates from that section, so retrieval
   * results carry sufficient context.
   */
  chunkSections(sections: DocumentSection[], options?: Partial<ChunkOptions>): TextChunk[] {
    const opts = { ...DEFAULT_CHUNK_OPTIONS, ...options };
    const allChunks: TextChunk[] = [];
    let globalCharOffset = 0;

    for (const section of sections) {
      const prefix = section.heading ? `${section.heading}\n\n` : '';
      const body = section.content.trim();

      if (!body) continue;

      const sectionText = prefix + body;
      const paragraphs = sectionText
        .split(/\n{2,}/)
        .map((p) => p.trim())
        .filter((p) => p.length > 0);

      const segments = this.splitLongParagraphs(paragraphs, opts.maxCharsPerChunk);
      const sectionChunks = this.buildChunks(segments, opts, globalCharOffset, allChunks.length);
      allChunks.push(...sectionChunks);

      // Advance global offset by length of this section's raw text + separator.
      globalCharOffset += sectionText.length + 2;
    }

    return allChunks;
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  /**
   * Splits any paragraph longer than `maxChars` into sentence-sized segments.
   * Shorter paragraphs are returned unchanged.
   */
  private splitLongParagraphs(paragraphs: string[], maxChars: number): string[] {
    const result: string[] = [];
    for (const para of paragraphs) {
      if (para.length <= maxChars) {
        result.push(para);
      } else {
        // Split on sentence boundary markers.
        const sentences = para.split(/(?<=[.?!])\s+/);
        let buffer = '';
        for (const sentence of sentences) {
          if (buffer.length + sentence.length + 1 > maxChars && buffer.length > 0) {
            result.push(buffer.trim());
            buffer = sentence;
          } else {
            buffer = buffer ? `${buffer} ${sentence}` : sentence;
          }
        }
        if (buffer.trim()) result.push(buffer.trim());
      }
    }
    return result;
  }

  private buildChunks(
    segments: string[],
    opts: ChunkOptions,
    charOffset = 0,
    indexOffset = 0,
  ): TextChunk[] {
    const chunks: TextChunk[] = [];
    let buffer = '';
    let bufferStartChar = charOffset;
    let currentChar = charOffset;

    const emit = () => {
      if (!buffer.trim()) return;
      const content = buffer.trim();
      chunks.push({
        index: indexOffset + chunks.length,
        content,
        tokenEstimate: this.estimateTokens(content),
        startChar: bufferStartChar,
        endChar: bufferStartChar + content.length,
      });
    };

    for (const segment of segments) {
      const wouldExceed = buffer.length + segment.length + 2 > opts.maxCharsPerChunk;

      if (wouldExceed && buffer.length > 0) {
        emit();

        // Seed next chunk with overlap: take tail of current buffer.
        const overlapText = this.tailChars(buffer, opts.overlapChars);
        buffer = overlapText ? `${overlapText}\n\n${segment}` : segment;
        bufferStartChar = currentChar - overlapText.length;
      } else {
        buffer = buffer ? `${buffer}\n\n${segment}` : segment;
      }

      currentChar += segment.length + 2;
    }

    // Flush remaining buffer.
    emit();

    return chunks;
  }

  /** Returns the last `n` characters of `text`, clipped to a word boundary. */
  private tailChars(text: string, n: number): string {
    if (n <= 0 || text.length <= n) return text;
    const tail = text.slice(-n);
    // Advance to the first whitespace to avoid splitting a word mid-chunk.
    const firstSpace = tail.search(/\s/);
    return firstSpace > 0 ? tail.slice(firstSpace).trim() : tail;
  }

  /** Rough token estimate: 1 token ≈ 4 chars (conservative +10%). */
  estimateTokens(text: string): number {
    return Math.ceil((text.length / 4) * 1.1);
  }
}
