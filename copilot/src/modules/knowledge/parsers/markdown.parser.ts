import { KnowledgeSourceType } from '../../../common/enums/knowledge-source-type.enum';
import { IDocumentParser } from './document-parser.interface';
import { DocumentSection, ParsedDocument } from '../interfaces/knowledge-source.interface';

export class MarkdownParser implements IDocumentParser {
  readonly supportedType = KnowledgeSourceType.MARKDOWN;

  parse(rawContent: string, sourceRef?: string): ParsedDocument {
    const normalised = rawContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const title = this.extractTitle(normalised, sourceRef);
    const sections = this.extractSections(normalised);
    const plainText = this.toPlainText(normalised);
    const wordCount = plainText.split(/\s+/).filter((w) => w.length > 0).length;

    return {
      title,
      plainText,
      sections,
      extractedLinks: this.extractLinks(normalised),
      wordCount,
    };
  }

  private extractTitle(md: string, sourceRef?: string): string {
    // First H1 heading
    const h1Match = md.match(/^#\s+(.+)$/m);
    if (h1Match) return h1Match[1].trim();
    // Setext-style heading
    const setextMatch = md.match(/^([^\n]+)\n={3,}/m);
    if (setextMatch) return setextMatch[1].trim();
    if (sourceRef) {
      const segment = sourceRef.split(/[/\\]/).pop() ?? sourceRef;
      return segment.replace(/\.md$/i, '').replace(/[-_]/g, ' ');
    }
    return 'Untitled';
  }

  private extractSections(md: string): DocumentSection[] {
    // Split on any heading line (ATX style: # ## ### etc.)
    const headingPattern = /^(#{1,6})\s+(.+)$/m;
    const lines = md.split('\n');
    const sections: DocumentSection[] = [];
    let currentHeading: string | undefined;
    let currentLines: string[] = [];

    for (const line of lines) {
      const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
      if (headingMatch) {
        if (currentLines.length > 0) {
          const content = this.toPlainText(currentLines.join('\n')).trim();
          if (content.length > 0) {
            sections.push({ heading: currentHeading, content });
          }
        }
        currentHeading = headingMatch[2].trim();
        currentLines = [];
      } else {
        currentLines.push(line);
      }
    }

    if (currentLines.length > 0) {
      const content = this.toPlainText(currentLines.join('\n')).trim();
      if (content.length > 0) {
        sections.push({ heading: currentHeading, content });
      }
    }

    return sections.length > 0 ? sections : [{ content: this.toPlainText(md).trim() }];
  }

  /** Strip markdown syntax to produce readable plain text. */
  toPlainText(md: string): string {
    return md
      // Remove fenced code blocks (keep code content, strip fences)
      .replace(/```[\w]*\n([\s\S]*?)```/g, '$1')
      // Remove inline code
      .replace(/`([^`]+)`/g, '$1')
      // Remove images but keep alt text
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
      // Remove links but keep link text
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      // Remove reference-style links
      .replace(/\[([^\]]+)\]\[[^\]]*\]/g, '$1')
      // Remove ATX headings markers
      .replace(/^#{1,6}\s+/gm, '')
      // Remove setext heading underlines
      .replace(/^[=-]{3,}\s*$/gm, '')
      // Remove bold/italic (**, __, *, _)
      .replace(/(\*{1,3}|_{1,3})([^*_]+)\1/g, '$2')
      // Remove blockquote markers
      .replace(/^>\s?/gm, '')
      // Remove horizontal rules
      .replace(/^[-*_]{3,}\s*$/gm, '')
      // Remove ordered / unordered list markers
      .replace(/^(\s*)([-*+]|\d+\.)\s+/gm, '$1')
      // Normalise whitespace
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  private extractLinks(md: string): string[] {
    const inline = [...(md.match(/\]\(([^)]+)\)/g) ?? [])].map((m) =>
      m.slice(2, -1).split(' ')[0],
    );
    const urlPattern = /https?:\/\/[^\s"'>)]+/g;
    const bare = md.match(urlPattern) ?? [];
    return [...new Set([...inline, ...bare])].filter(
      (u) => u.startsWith('http://') || u.startsWith('https://'),
    );
  }
}
