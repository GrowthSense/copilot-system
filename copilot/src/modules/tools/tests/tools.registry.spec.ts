import { Test, TestingModule } from '@nestjs/testing';
import { ToolsRegistry } from '../tools.registry';
import { SearchFilesTool } from '../tools/search-files.tool';
import { ReadFileTool } from '../tools/read-file.tool';
import { ReadFilesTool } from '../tools/read-files.tool';
import { GetRepoTreeTool } from '../tools/get-repo-tree.tool';
import { GrepCodeTool } from '../tools/grep-code.tool';
import { GenerateDiffTool } from '../tools/generate-diff.tool';
import { RunTestsTool } from '../tools/run-tests.tool';
import { RunLintTool } from '../tools/run-lint.tool';

/** Minimal stub that satisfies IAgentTool. */
function makeTool(name: string, requiresApproval = false) {
  return {
    name,
    description: `${name} description`,
    requiresApproval,
    getDefinition: jest.fn().mockReturnValue({ name, description: '', requiresApproval, inputSchema: { type: 'object', properties: {}, required: [] } }),
    execute: jest.fn(),
  };
}

describe('ToolsRegistry', () => {
  let registry: ToolsRegistry;

  const searchFiles = makeTool('search_files');
  const readFile = makeTool('read_file');
  const readFiles = makeTool('read_files');
  const getRepoTree = makeTool('get_repo_tree');
  const grepCode = makeTool('grep_code');
  const generateDiff = makeTool('generate_diff');
  const runTests = makeTool('run_tests', true);
  const runLint = makeTool('run_lint', true);

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ToolsRegistry,
        { provide: SearchFilesTool, useValue: searchFiles },
        { provide: ReadFileTool, useValue: readFile },
        { provide: ReadFilesTool, useValue: readFiles },
        { provide: GetRepoTreeTool, useValue: getRepoTree },
        { provide: GrepCodeTool, useValue: grepCode },
        { provide: GenerateDiffTool, useValue: generateDiff },
        { provide: RunTestsTool, useValue: runTests },
        { provide: RunLintTool, useValue: runLint },
      ],
    }).compile();

    registry = module.get(ToolsRegistry);
  });

  it('registers all 8 tools', () => {
    expect(registry.getAll()).toHaveLength(8);
  });

  it.each([
    'search_files',
    'read_file',
    'read_files',
    'get_repo_tree',
    'grep_code',
    'generate_diff',
    'run_tests',
    'run_lint',
  ])('has("%s") returns true', (name) => {
    expect(registry.has(name)).toBe(true);
  });

  it('get() returns the correct tool', () => {
    expect(registry.get('grep_code')).toBe(grepCode);
  });

  it('get() returns undefined for an unknown tool', () => {
    expect(registry.get('nonexistent')).toBeUndefined();
  });

  it('getAll() returns all registered tools', () => {
    const names = registry.getAll().map((t) => t.name);
    expect(names).toContain('run_tests');
    expect(names).toContain('run_lint');
  });

  it('getAllDefinitions() calls getDefinition() on each tool', () => {
    const defs = registry.getAllDefinitions();
    expect(defs).toHaveLength(8);
    expect(searchFiles.getDefinition).toHaveBeenCalled();
  });

  it('run_tests and run_lint have requiresApproval=true', () => {
    expect(registry.get('run_tests')!.requiresApproval).toBe(true);
    expect(registry.get('run_lint')!.requiresApproval).toBe(true);
  });

  it('read/search tools have requiresApproval=false', () => {
    ['search_files', 'read_file', 'read_files', 'get_repo_tree', 'grep_code', 'generate_diff']
      .forEach((name) => {
        expect(registry.get(name)!.requiresApproval).toBe(false);
      });
  });
});
