import { Injectable } from '@nestjs/common';
import { IAgentTool, AgentToolDefinition, ToolExecutionContext } from '../tools/interfaces/agent-tool.interface';
import { WebResearchService } from './web-research.service';
import { WebSearchResult } from './interfaces/web-search.interface';

export interface WebResearchInput {
  query: string;
  maxResults?: number;
  publishedAfter?: string;
}

export interface WebResearchOutput {
  results: WebSearchResult[];
  query: string;
  totalFound: number;
  formattedText: string;
}

@Injectable()
export class WebResearchTool implements IAgentTool<WebResearchInput, WebResearchOutput> {
  readonly name = 'web_research';
  readonly description =
    'Search the web for up-to-date information: best practices, deprecated packages, ' +
    'security advisories, framework release notes, and technology trends. ' +
    'Use this to ground decisions in current real-world knowledge.';
  readonly requiresApproval = false;

  constructor(private readonly webResearch: WebResearchService) {}

  getDefinition(): AgentToolDefinition {
    return {
      name: this.name,
      description: this.description,
      requiresApproval: this.requiresApproval,
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'The search query' },
          maxResults: { type: 'number', description: 'Max results to return (default: 5)' },
          publishedAfter: { type: 'string', description: 'ISO date — only return results after this date' },
        },
        required: ['query'],
      },
    };
  }

  async execute(input: WebResearchInput, _ctx: ToolExecutionContext): Promise<WebResearchOutput> {
    const results = await this.webResearch.search(input.query, {
      maxResults: input.maxResults,
      publishedAfter: input.publishedAfter,
    });

    return {
      results,
      query: input.query,
      totalFound: results.length,
      formattedText: this.webResearch.formatForPrompt(results),
    };
  }
}
