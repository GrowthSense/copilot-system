import { KnowledgeSourceType } from '../../../common/enums/knowledge-source-type.enum';
import { IDocumentParser } from './document-parser.interface';
import { DocumentSection, ParsedDocument } from '../interfaces/knowledge-source.interface';

/**
 * Regex-based HTML parser. Handles typical webpage HTML without an external dependency.
 * For complex SPAs or heavily JavaScript-rendered pages, use a headless browser upstream
 * and pass the resulting HTML here.
 */
export class HtmlParser implements IDocumentParser {
  readonly supportedType = KnowledgeSourceType.WEBPAGE;

  parse(rawContent: string, sourceRef?: string): ParsedDocument {
    const withoutScript = this.removeScriptAndStyle(rawContent);
    const title = this.extractTitle(withoutScript, sourceRef);
    const sections = this.extractSections(withoutScript);
    const plainText = this.toPlainText(withoutScript);
    const wordCount = plainText.split(/\s+/).filter((w) => w.length > 0).length;

    return {
      title,
      plainText,
      sections,
      extractedLinks: this.extractLinks(rawContent),
      wordCount,
    };
  }

  private removeScriptAndStyle(html: string): string {
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '');
  }

  private extractTitle(html: string, sourceRef?: string): string {
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch) return this.decodeEntities(titleMatch[1].trim());

    const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    if (h1Match) return this.decodeEntities(this.stripTags(h1Match[1]).trim());

    if (sourceRef) return sourceRef;
    return 'Untitled Page';
  }

  private extractSections(html: string): DocumentSection[] {
    // Split on heading tags and treat each as a section
    const headingPattern = /<(h[1-3])[^>]*>([\s\S]*?)<\/\1>/gi;
    const sections: DocumentSection[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = headingPattern.exec(html)) !== null) {
      // Content before this heading
      if (match.index > lastIndex) {
        const before = this.toPlainText(html.slice(lastIndex, match.index)).trim();
        if (before.length > 40) {
          sections.push({ content: before });
        }
      }

      const heading = this.decodeEntities(this.stripTags(match[2]).trim());
      lastIndex = headingPattern.lastIndex;

      // Find the next heading to delimit this section's body
      const nextHeading = html.indexOf('<h', lastIndex);
      const sectionEnd = nextHeading === -1 ? html.length : nextHeading;
      const body = this.toPlainText(html.slice(lastIndex, sectionEnd)).trim();

      if (body.length > 0 || heading.length > 0) {
        sections.push({ heading, content: body });
      }

      lastIndex = sectionEnd;
    }

    if (lastIndex < html.length) {
      const remaining = this.toPlainText(html.slice(lastIndex)).trim();
      if (remaining.length > 40) {
        sections.push({ content: remaining });
      }
    }

    if (sections.length === 0) {
      const full = this.toPlainText(html).trim();
      if (full.length > 0) sections.push({ content: full });
    }

    return sections;
  }

  toPlainText(html: string): string {
    return this.decodeEntities(
      this.stripTags(html)
        .replace(/\n{3,}/g, '\n\n')
        .replace(/[ \t]{2,}/g, ' ')
        .trim(),
    );
  }

  private stripTags(html: string): string {
    // Replace block-level elements with newlines to preserve structure
    const withNewlines = html
      .replace(/<\/?(p|div|section|article|header|footer|nav|main|aside|li|dt|dd|blockquote|pre|h[1-6])[^>]*>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '');
    return withNewlines;
  }

  private decodeEntities(text: string): string {
    return text
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .replace(/&#(\d+);/g, (_, code: string) =>
        String.fromCharCode(parseInt(code, 10)),
      )
      .replace(/&[a-z]+;/gi, '');
  }

  private extractLinks(html: string): string[] {
    const hrefPattern = /href=["']([^"']+)["']/gi;
    const links: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = hrefPattern.exec(html)) !== null) {
      const href = match[1];
      if (href.startsWith('http://') || href.startsWith('https://')) {
        links.push(href);
      }
    }
    return [...new Set(links)];
  }
}
