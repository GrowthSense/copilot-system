import { Injectable } from '@nestjs/common';
import { RepoMapService } from '../../repo/repo-map.service';
import { DirectoryNode } from '../../repo/interfaces/repo-index.interface';
import {
  AgentToolDefinition,
  IAgentTool,
  ToolExecutionContext,
} from '../interfaces/agent-tool.interface';

export interface GetRepoTreeInput {
  repoId: string;
  /** Limit tree depth (1 = repo root only, 2 = one level of directories, …). Default: unlimited. */
  maxDepth?: number;
}

export interface GetRepoTreeOutput {
  tree: DirectoryNode;
  totalFiles: number;
}

@Injectable()
export class GetRepoTreeTool implements IAgentTool<GetRepoTreeInput, GetRepoTreeOutput> {
  readonly name = 'get_repo_tree';
  readonly description =
    'Return the hierarchical directory tree of all indexed files in a repository. ' +
    'Use maxDepth to limit the output for large repositories.';
  readonly requiresApproval = false;

  constructor(private readonly repoMap: RepoMapService) {}

  getDefinition(): AgentToolDefinition {
    return {
      name: this.name,
      description: this.description,
      requiresApproval: this.requiresApproval,
      inputSchema: {
        type: 'object',
        properties: {
          repoId: { type: 'string', description: 'Repository ID' },
          maxDepth: {
            type: 'number',
            description:
              'Maximum depth of the directory tree to return (1 = root level only). Omit for the full tree.',
          },
        },
        required: ['repoId'],
      },
    };
  }

  async execute(
    input: GetRepoTreeInput,
    _context: ToolExecutionContext,
  ): Promise<GetRepoTreeOutput> {
    const tree = await this.repoMap.getDirectoryTree(input.repoId);
    const pruned = input.maxDepth !== undefined ? pruneTree(tree, input.maxDepth) : tree;
    const totalFiles = countFiles(pruned);

    return { tree: pruned, totalFiles };
  }
}

function pruneTree(node: DirectoryNode, maxDepth: number, currentDepth = 0): DirectoryNode {
  if (node.type === 'file') return node;
  if (currentDepth >= maxDepth) {
    return { ...node, children: undefined };
  }
  return {
    ...node,
    children: node.children?.map((child) => pruneTree(child, maxDepth, currentDepth + 1)),
  };
}

function countFiles(node: DirectoryNode): number {
  if (node.type === 'file') return 1;
  return (node.children ?? []).reduce((sum, child) => sum + countFiles(child), 0);
}
