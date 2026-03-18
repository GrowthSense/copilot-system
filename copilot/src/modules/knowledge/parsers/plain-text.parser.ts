import { KnowledgeSourceType } from '../../../common/enums/knowledge-source-type.enum';
import { IDocumentParser } from './document-parser.interface';
import { DocumentSection, ParsedDocument } from '../interfaces/knowledge-source.interface';

export class PlainTextParser implements IDocumentParser {
  readonly supportedType = KnowledgeSourceType.PLAIN_TEXT;

  parse(rawContent: string, sourceRef?: string): ParsedDocument {
    const normalised = this.normalise(rawContent);
    const sections = this.extractSections(normalised);
    const title = this.extractTitle(normalised, sourceRef);
    const wordCount = this.countWords(normalised);

    return {
      title,
      plainText: normalised,
      sections,
      extractedLinks: this.extractUrls(rawContent),
      wordCount,
    };
  }

  private normalise(text: string): string {
    return text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\t/g, '  ')
      .replace(/[ ]{3,}/g, '  ')
      .replace(/\n{4,}/g, '\n\n\n')
      .trim();
  }

  private extractTitle(text: string, sourceRef?: string): string {
    // Use the first non-empty line if it looks like a title (short, no period)
    const firstLine = text.split('\n').find((l) => l.trim().length > 0) ?? '';
    const trimmed = firstLine.trim();
    if (trimmed.length > 0 && trimmed.length <= 120 && !trimmed.endsWith('.')) {
      return trimmed;
    }
    if (sourceRef) {
      // Derive title from file name / URL path segment
      const segment = sourceRef.split(/[/\\]/).pop() ?? sourceRef;
      return segment.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
    }
    return 'Untitled Document';
  }

  private extractSections(text: string): DocumentSection[] {
    const paragraphs = text
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    return paragraphs.map((p) => ({ content: p }));
  }

  private extractUrls(text: string): string[] {
    const urlPattern = /https?:\/\/[^\s"'>)]+/g;
    return [...new Set(text.match(urlPattern) ?? [])];
  }

  private countWords(text: string): number {
    return text.split(/\s+/).filter((w) => w.length > 0).length;
  }
}
