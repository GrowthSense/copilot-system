import { Injectable } from '@nestjs/common';
import { RepoSearchService } from '../../repo/repo-search.service';
import { SearchMode, FileMatchResult } from '../../repo/interfaces/repo-index.interface';
import {
  AgentToolDefinition,
  IAgentTool,
  ToolExecutionContext,
} from '../interfaces/agent-tool.interface';

export interface SearchFilesInput {
  repoId: string;
  query: string;
  mode?: 'filename' | 'path' | 'keyword' | 'all';
  topK?: number;
}

export interface SearchFilesOutput {
  results: FileMatchResult[];
  totalFound: number;
}

@Injectable()
export class SearchFilesTool implements IAgentTool<SearchFilesInput, SearchFilesOutput> {
  readonly name = 'search_files';
  readonly description =
    'Search indexed repository files by filename, path fragment, keyword content, or all strategies combined. ' +
    'Returns matched files with a relevance score and explanation of why each matched.';
  readonly requiresApproval = false;

  constructor(private readonly repoSearch: RepoSearchService) {}

  getDefinition(): AgentToolDefinition {
    return {
      name: this.name,
      description: this.description,
      requiresApproval: this.requiresApproval,
      inputSchema: {
        type: 'object',
        properties: {
          repoId: { type: 'string', description: 'Repository ID to search within' },
          query: { type: 'string', description: 'Search term or phrase' },
          mode: {
            type: 'string',
            description: 'Search strategy — filename | path | keyword | all (default: all)',
            enum: ['filename', 'path', 'keyword', 'all'],
          },
          topK: {
            type: 'number',
            description: 'Maximum number of results to return (default: 20, max: 100)',
          },
        },
        required: ['repoId', 'query'],
      },
    };
  }

  async execute(
    input: SearchFilesInput,
    _context: ToolExecutionContext,
  ): Promise<SearchFilesOutput> {
    const results = await this.repoSearch.search(input.repoId, {
      query: input.query,
      mode: (input.mode as SearchMode) ?? SearchMode.ALL,
      topK: input.topK ?? 20,
    });

    return { results, totalFound: results.length };
  }
}
