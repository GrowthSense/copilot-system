import { Injectable, Logger } from '@nestjs/common';
import * as https from 'https';
import * as http from 'http';
import * as zlib from 'zlib';
import {
  AgentToolDefinition,
  IAgentTool,
  ToolExecutionContext,
} from '../interfaces/agent-tool.interface';

export interface WebFetchInput {
  /** Full URL to fetch (https or http). */
  url: string;
  /** Max characters of content to return. Default: 20 000. */
  maxChars?: number;
}

export interface WebFetchOutput {
  url: string;
  statusCode: number;
  contentType: string;
  content: string;
  truncated: boolean;
}

const DEFAULT_MAX_CHARS = 20_000;
const TIMEOUT_MS = 15_000;

/**
 * web_fetch — read the raw text/HTML content of any public URL.
 * Strips HTML tags to return readable text, making web pages consumable by the LLM.
 */
@Injectable()
export class WebFetchTool implements IAgentTool<WebFetchInput, WebFetchOutput> {
  readonly name = 'web_fetch';
  readonly description =
    'Fetch the text content of any public URL (documentation, articles, GitHub files, APIs). ' +
    'Use this to read specific pages the LLM needs to reference. ' +
    'For broad searches use web_research instead.';
  readonly requiresApproval = false;

  private readonly logger = new Logger(WebFetchTool.name);

  getDefinition(): AgentToolDefinition {
    return {
      name: this.name,
      description: this.description,
      requiresApproval: this.requiresApproval,
      inputSchema: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'The full URL to fetch' },
          maxChars: {
            type: 'number',
            description: 'Maximum characters to return (default: 20 000)',
          },
        },
        required: ['url'],
      },
    };
  }

  async execute(input: WebFetchInput, _ctx: ToolExecutionContext): Promise<WebFetchOutput> {
    const maxChars = input.maxChars ?? DEFAULT_MAX_CHARS;
    this.logger.log(`web_fetch: ${input.url}`);

    const { statusCode, contentType, rawBody } = await this.fetchUrl(input.url);
    const text = this.extractText(rawBody, contentType);
    const truncated = text.length > maxChars;
    const content = truncated ? text.slice(0, maxChars) + '\n\n[Content truncated]' : text;

    return { url: input.url, statusCode, contentType, content, truncated };
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private fetchUrl(url: string): Promise<{ statusCode: number; contentType: string; rawBody: string }> {
    return new Promise((resolve, reject) => {
      const parsed = new URL(url);
      const lib = parsed.protocol === 'https:' ? https : http;

      const req = lib.get(
        url,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; BuntuCopilot/1.0)',
            Accept: 'text/html,application/xhtml+xml,text/plain,*/*',
            'Accept-Encoding': 'gzip, deflate',
          },
          timeout: TIMEOUT_MS,
        },
        (res) => {
          // Follow redirects (up to 5)
          if (
            (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307) &&
            res.headers.location
          ) {
            req.destroy();
            this.fetchUrl(res.headers.location)
              .then(resolve)
              .catch(reject);
            return;
          }

          const contentType = res.headers['content-type'] ?? '';
          const encoding = res.headers['content-encoding'];
          const chunks: Buffer[] = [];

          let stream: NodeJS.ReadableStream = res;
          if (encoding === 'gzip') stream = res.pipe(zlib.createGunzip());
          else if (encoding === 'deflate') stream = res.pipe(zlib.createInflate());

          stream.on('data', (chunk: Buffer) => chunks.push(chunk));
          stream.on('end', () => {
            resolve({
              statusCode: res.statusCode ?? 200,
              contentType,
              rawBody: Buffer.concat(chunks).toString('utf-8'),
            });
          });
          stream.on('error', reject);
        },
      );

      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`Timeout fetching ${url} after ${TIMEOUT_MS}ms`));
      });
      req.on('error', reject);
    });
  }

  /** Strip HTML tags and normalise whitespace for LLM consumption. */
  private extractText(body: string, contentType: string): string {
    const isHtml = contentType.includes('html');
    if (!isHtml) return body;

    return body
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }
}
