import { Injectable, Logger } from '@nestjs/common';
import { AppConfigService } from '../../../config/config.service';
import { IWebSearchProvider, WebSearchOptions, WebSearchResult } from '../interfaces/web-search.interface';

interface SerperOrganic {
  title: string;
  link: string;
  snippet: string;
  date?: string;
}

interface SerperResponse {
  organic: SerperOrganic[];
}

@Injectable()
export class SerperProvider implements IWebSearchProvider {
  private readonly logger = new Logger(SerperProvider.name);

  constructor(private readonly config: AppConfigService) {}

  async search(query: string, options?: WebSearchOptions): Promise<WebSearchResult[]> {
    const apiKey = this.config.webSearchApiKey;
    if (!apiKey) {
      this.logger.warn('WEB_SEARCH_API_KEY not set — returning empty results');
      return [];
    }

    try {
      const res = await fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-KEY': apiKey },
        body: JSON.stringify({ q: query, num: options?.maxResults ?? 5 }),
      });

      if (!res.ok) {
        this.logger.warn(`Serper search failed: ${res.status} ${res.statusText}`);
        return [];
      }

      const data = (await res.json()) as SerperResponse;
      return (data.organic ?? []).map((r) => ({
        title: r.title,
        url: r.link,
        snippet: r.snippet,
        publishedDate: r.date,
      }));
    } catch (err) {
      this.logger.error(`Serper search error: ${err instanceof Error ? err.message : String(err)}`);
      return [];
    }
  }
}
