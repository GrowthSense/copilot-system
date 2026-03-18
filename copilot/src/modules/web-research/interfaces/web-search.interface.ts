export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
  publishedDate?: string;
}

export interface WebSearchOptions {
  maxResults?: number;
  /** Only return results published after this ISO date string */
  publishedAfter?: string;
}

export interface IWebSearchProvider {
  search(query: string, options?: WebSearchOptions): Promise<WebSearchResult[]>;
}
