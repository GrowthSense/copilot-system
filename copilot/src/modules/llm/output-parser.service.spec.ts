import { Test, TestingModule } from '@nestjs/testing';
import { OutputParserService } from './output-parser.service';
import { LlmOutputParseException } from './llm.exception';
import { z } from 'zod';

const TestSchema = z.object({
  name: z.string(),
  score: z.number(),
});

describe('OutputParserService', () => {
  let service: OutputParserService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [OutputParserService],
    }).compile();

    service = module.get<OutputParserService>(OutputParserService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─── safeParseJson — happy paths ──────────────────────────────────────────

  describe('safeParseJson — valid input', () => {
    it('parses a clean JSON string', () => {
      const result = service.safeParseJson('{"name":"Alice","score":0.9}', TestSchema);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('Alice');
        expect(result.data.score).toBe(0.9);
      }
    });

    it('strips ```json ... ``` markdown fences before parsing', () => {
      const fenced = '```json\n{"name":"Bob","score":0.5}\n```';
      const result = service.safeParseJson(fenced, TestSchema);
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.name).toBe('Bob');
    });

    it('strips plain ``` ... ``` fences before parsing', () => {
      const fenced = '```\n{"name":"Carol","score":0.3}\n```';
      const result = service.safeParseJson(fenced, TestSchema);
      expect(result.success).toBe(true);
    });

    it('extracts JSON from text with preamble and suffix', () => {
      const withPreamble = 'Here is the result:\n{"name":"Dave","score":0.7}\nThank you.';
      const result = service.safeParseJson(withPreamble, TestSchema);
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.name).toBe('Dave');
    });

    it('handles extra whitespace around the JSON object', () => {
      const padded = '  \n  {"name":"Eve","score":1.0}  \n  ';
      const result = service.safeParseJson(padded, TestSchema);
      expect(result.success).toBe(true);
    });
  });

  // ─── safeParseJson — failure paths ────────────────────────────────────────

  describe('safeParseJson — invalid input', () => {
    it('returns failure for malformed JSON', () => {
      const result = service.safeParseJson('{name: Alice, score: 0.9}', TestSchema);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(LlmOutputParseException);
        expect(result.error.message).toContain('JSON parse failed');
      }
    });

    it('returns failure for empty string', () => {
      const result = service.safeParseJson('', TestSchema);
      expect(result.success).toBe(false);
    });

    it('returns failure when required field is missing', () => {
      const result = service.safeParseJson('{"name":"Frank"}', TestSchema);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('Schema validation failed');
        expect(result.error.message).toContain('score');
      }
    });

    it('returns failure when field has wrong type', () => {
      const result = service.safeParseJson('{"name":"Grace","score":"high"}', TestSchema);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('score');
      }
    });

    it('returns failure for plain text with no JSON object', () => {
      const result = service.safeParseJson('Sorry, I cannot help with that.', TestSchema);
      expect(result.success).toBe(false);
    });
  });

  // ─── parseJson ─────────────────────────────────────────────────────────────

  describe('parseJson', () => {
    it('returns data directly on success', () => {
      const data = service.parseJson('{"name":"Heidi","score":0.8}', TestSchema);
      expect(data.name).toBe('Heidi');
    });

    it('throws LlmOutputParseException on failure', () => {
      expect(() => service.parseJson('not json', TestSchema)).toThrow(LlmOutputParseException);
    });
  });

  // ─── schema edge cases ─────────────────────────────────────────────────────

  describe('schema edge cases', () => {
    it('passes through additional fields if schema uses passthrough', () => {
      const loose = z.object({ name: z.string() }).passthrough();
      const result = service.safeParseJson('{"name":"Ivan","extra":true}', loose);
      expect(result.success).toBe(true);
    });

    it('reports multiple field errors in one message', () => {
      const multi = z.object({ a: z.string(), b: z.number(), c: z.boolean() });
      const result = service.safeParseJson('{}', multi);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('a');
        expect(result.error.message).toContain('b');
      }
    });
  });
});
