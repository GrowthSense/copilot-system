import { Inject, Injectable, Logger } from '@nestjs/common';
import { IWebSearchProvider, WebSearchOptions, WebSearchResult } from './interfaces/web-search.interface';
import { WEB_SEARCH_PROVIDER_TOKEN } from './providers/web-search-provider.token';

@Injectable()
export class WebResearchService {
  private readonly logger = new Logger(WebResearchService.name);

  constructor(
    @Inject(WEB_SEARCH_PROVIDER_TOKEN)
    private readonly provider: IWebSearchProvider,
  ) {}

  async search(query: string, options?: WebSearchOptions): Promise<WebSearchResult[]> {
    this.logger.log(`Web search: "${query}" max=${options?.maxResults ?? 5}`);
    return this.provider.search(query, options);
  }

  /**
   * Format search results as a compact text block for LLM prompt injection.
   */
  formatForPrompt(results: WebSearchResult[]): string {
    if (results.length === 0) return '(no results found)';
    return results
      .map((r, i) => {
        const date = r.publishedDate ? ` (${r.publishedDate})` : '';
        return `[${i + 1}] ${r.title}${date}\n${r.url}\n${r.snippet}`;
      })
      .join('\n\n');
  }
}
