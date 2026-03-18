import { Injectable, Logger } from '@nestjs/common';
import { AppConfigService } from '../../../config/config.service';
import { IWebSearchProvider, WebSearchOptions, WebSearchResult } from '../interfaces/web-search.interface';

interface TavilyResult {
  title: string;
  url: string;
  content: string;
  published_date?: string;
}

interface TavilyResponse {
  results: TavilyResult[];
}

@Injectable()
export class TavilyProvider implements IWebSearchProvider {
  private readonly logger = new Logger(TavilyProvider.name);

  constructor(private readonly config: AppConfigService) {}

  async search(query: string, options?: WebSearchOptions): Promise<WebSearchResult[]> {
    const apiKey = this.config.webSearchApiKey;
    if (!apiKey) {
      this.logger.warn('WEB_SEARCH_API_KEY not set — returning empty results');
      return [];
    }

    const body: Record<string, unknown> = {
      query,
      search_depth: 'advanced',
      max_results: options?.maxResults ?? 5,
      include_answer: false,
    };

    try {
      const res = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        this.logger.warn(`Tavily search failed: ${res.status} ${res.statusText}`);
        return [];
      }

      const data = (await res.json()) as TavilyResponse;
      return (data.results ?? []).map((r) => ({
        title: r.title,
        url: r.url,
        snippet: r.content,
        publishedDate: r.published_date,
      }));
    } catch (err) {
      this.logger.error(`Tavily search error: ${err instanceof Error ? err.message : String(err)}`);
      return [];
    }
  }
}
