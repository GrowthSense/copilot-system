import { ChunkingService } from './chunking.service';

describe('ChunkingService', () => {
  let service: ChunkingService;

  beforeEach(() => {
    service = new ChunkingService();
  });

  describe('chunkText', () => {
    it('should return a single chunk for short text', () => {
      const text = 'Hello world.\n\nThis is a short document.';
      const chunks = service.chunkText(text, { maxCharsPerChunk: 3600 });
      expect(chunks).toHaveLength(1);
      expect(chunks[0].index).toBe(0);
      expect(chunks[0].content).toContain('Hello world');
    });

    it('should split text into multiple chunks when it exceeds maxCharsPerChunk', () => {
      const paragraph = 'word '.repeat(200).trim(); // ~1000 chars
      const text = [paragraph, paragraph, paragraph, paragraph].join('\n\n');

      const chunks = service.chunkText(text, { maxCharsPerChunk: 1200, overlapChars: 100 });

      expect(chunks.length).toBeGreaterThan(1);
      // Every chunk should respect the max size (with some tolerance for overlap seeding).
      for (const chunk of chunks) {
        expect(chunk.content.length).toBeLessThanOrEqual(1400);
      }
    });

    it('should carry overlap from the previous chunk', () => {
      const para1 = 'alpha '.repeat(150).trim();
      const para2 = 'beta '.repeat(150).trim();
      const text = `${para1}\n\n${para2}`;

      const chunks = service.chunkText(text, { maxCharsPerChunk: 800, overlapChars: 100 });

      // The second chunk should begin with some content from the first.
      expect(chunks.length).toBeGreaterThanOrEqual(2);
      // Overlap content (from para1) should appear at the start of the second chunk.
      const overlapPresent = chunks[1].content.includes('alpha');
      expect(overlapPresent).toBe(true);
    });

    it('should assign sequential indices', () => {
      const para = 'sentence text here. '.repeat(100);
      const text = Array(5).fill(para).join('\n\n');

      const chunks = service.chunkText(text, { maxCharsPerChunk: 500, overlapChars: 50 });

      chunks.forEach((chunk, i) => {
        expect(chunk.index).toBe(i);
      });
    });

    it('should provide token estimates', () => {
      const text = 'This is a test document with several words in it.';
      const chunks = service.chunkText(text);

      expect(chunks[0].tokenEstimate).toBeGreaterThan(0);
    });

    it('should set startChar and endChar', () => {
      const text = 'First paragraph here.\n\nSecond paragraph here.';
      const chunks = service.chunkText(text, { maxCharsPerChunk: 3600, overlapChars: 0 });

      expect(chunks[0].startChar).toBe(0);
      expect(chunks[0].endChar).toBeGreaterThan(0);
      expect(chunks[0].endChar).toBeLessThanOrEqual(text.length);
    });

    it('should handle empty input gracefully', () => {
      const chunks = service.chunkText('');
      expect(chunks).toHaveLength(0);
    });

    it('should handle single very long paragraph via sentence splitting', () => {
      // One paragraph of 50 short sentences, no double newlines.
      const text = Array(50)
        .fill(0)
        .map((_, i) => `This is sentence number ${i} in a very long paragraph.`)
        .join(' ');

      const chunks = service.chunkText(text, { maxCharsPerChunk: 500, overlapChars: 50 });

      expect(chunks.length).toBeGreaterThan(1);
      for (const chunk of chunks) {
        expect(chunk.content.length).toBeLessThanOrEqual(600);
      }
    });
  });

  describe('chunkSections', () => {
    it('should produce chunks with heading context', () => {
      const sections = [
        { heading: '# Introduction', content: 'This section covers the basics.' },
        { heading: '# Details', content: 'This section has more information.' },
      ];

      const chunks = service.chunkSections(sections, { maxCharsPerChunk: 3600, overlapChars: 0 });

      expect(chunks.length).toBeGreaterThanOrEqual(2);
      expect(chunks[0].content).toContain('Introduction');
      expect(chunks[1].content).toContain('Details');
    });

    it('should skip empty sections', () => {
      const sections = [
        { heading: '# Empty', content: '' },
        { heading: '# Real', content: 'Actual content here.' },
      ];

      const chunks = service.chunkSections(sections);

      expect(chunks).toHaveLength(1);
      expect(chunks[0].content).toContain('Actual content');
    });

    it('should assign globally sequential indices across sections', () => {
      const longContent = 'word '.repeat(300).trim();
      const sections = [
        { heading: '# Section A', content: longContent },
        { heading: '# Section B', content: longContent },
      ];

      const chunks = service.chunkSections(sections, { maxCharsPerChunk: 600, overlapChars: 50 });

      chunks.forEach((chunk, i) => {
        expect(chunk.index).toBe(i);
      });
    });

    it('should handle sections without headings', () => {
      const sections = [{ content: 'No heading, just content.' }];
      const chunks = service.chunkSections(sections);

      expect(chunks).toHaveLength(1);
      expect(chunks[0].content).toBe('No heading, just content.');
    });
  });

  describe('estimateTokens', () => {
    it('should return a positive estimate for non-empty text', () => {
      expect(service.estimateTokens('hello world')).toBeGreaterThan(0);
    });

    it('should scale with text length', () => {
      const short = service.estimateTokens('hi');
      const long = service.estimateTokens('hi '.repeat(100));
      expect(long).toBeGreaterThan(short);
    });
  });
});
