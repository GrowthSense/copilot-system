# Buntu Finance Copilot — Backend

## Overview

Buntu Finance internal engineering copilot. A NestJS backend that provides the persistence, orchestration, and API surface for an AI-powered coding assistant.

## Prerequisites

- Node.js 20+
- npm 10+ or pnpm 9+
- PostgreSQL 15+ with `pgvector` extension
- A configured `.env` file (see `.env.example`)

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# → fill in DATABASE_URL and LLM_API_KEY

# 3. Enable pgvector on your PostgreSQL instance
# Connect to psql and run:
# CREATE EXTENSION IF NOT EXISTS vector;

# 4. Run initial migration
npm run prisma:migrate:dev -- --name init

# 5. Generate Prisma client
npm run prisma:generate

# 6. Start development server
npm run start:dev
```

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `NODE_ENV` | No | `development` | Runtime environment |
| `PORT` | No | `3000` | HTTP port |
| `APP_NAME` | No | `buntu-copilot` | Application name |
| `DATABASE_URL` | **Yes** | — | PostgreSQL connection string |
| `LLM_PROVIDER` | No | `openai` | LLM provider (openai, anthropic, mistral, local) |
| `LLM_API_KEY` | **Yes** | — | API key for the chosen LLM provider |
| `LLM_MODEL` | No | `gpt-4o` | Model identifier |
| `LLM_MAX_TOKENS` | No | `4096` | Max tokens per completion |
| `LLM_TEMPERATURE` | No | `0.2` | Sampling temperature (0–2) |
| `LLM_STRUCTURED_OUTPUT_RETRIES` | No | `2` | Retries on malformed JSON output (0–5) |
| `LLM_MAX_CONTEXT_TOKENS` | No | `100000` | Pre-request context budget guardrail (tokens) |
| `GITHUB_APP_ID` | No | — | GitHub App ID (Phase 2) |
| `GITHUB_APP_PRIVATE_KEY` | No | — | GitHub App private key PEM (Phase 2) |
| `GITHUB_WEBHOOK_SECRET` | No | — | Webhook secret for GitHub events (Phase 2) |
| `VECTOR_DIMENSION` | No | `1536` | Embedding vector dimensions (matches model output) |
| `GITHUB_TOKEN` | Cond. | — | GitHub Personal Access Token for API calls (required unless using App auth) |
| `GITHUB_BASE_BRANCH` | No | `main` | Default base branch for pull requests |
| `GITHUB_APP_ID` | Cond. | — | GitHub App ID (alternative to PAT — requires private key) |
| `GITHUB_APP_PRIVATE_KEY` | Cond. | — | GitHub App private key PEM (alternative to PAT) |
| `GITHUB_WEBHOOK_SECRET` | No | — | Webhook signing secret for incoming GitHub events |

## GitHub Setup

### Option A — Personal Access Token (recommended for development)

1. Go to **GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens**
2. Create a token scoped to your target repo with permissions:
   - **Contents**: Read and write (branch creation + commits)
   - **Pull requests**: Read and write (PR creation + labels)
   - **Metadata**: Read
3. Copy the token and set it in `.env`:
   ```
   GITHUB_TOKEN=ghp_your_token_here
   GITHUB_BASE_BRANCH=main
   ```

### Option B — GitHub App (recommended for production)

1. Create a GitHub App at **GitHub → Settings → Developer settings → GitHub Apps**
2. Grant permissions: Contents (R/W), Pull requests (R/W), Metadata (R)
3. Install the App on the target repository
4. Download the private key PEM file
5. Set in `.env`:
   ```
   GITHUB_APP_ID=123456
   GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n..."
   GITHUB_WEBHOOK_SECRET=your_webhook_secret
   ```
6. Wire `@octokit/auth-app` in `GithubService.getOctokit()` — see the inline comment in [github.service.ts](src/modules/github/github.service.ts#L59)

> **Note:** `GITHUB_TOKEN` takes precedence over App credentials. App auth is currently stubbed with a clear implementation comment — install `@octokit/auth-app` to enable it.

### Required npm package

The GitHub integration uses `@octokit/rest` and `@octokit/request-error`:

```bash
npm install @octokit/rest @octokit/request-error
```

## Database Migrations

### Create a new migration after schema changes

```bash
npm run prisma:migrate:dev -- --name <migration-name>
```

### Apply migrations in CI / production

```bash
npm run prisma:migrate:deploy
```

### Reset the database (development only — destroys all data)

```bash
npx prisma migrate reset
```

### Open Prisma Studio (local data browser)

```bash
npm run prisma:studio
```

### Re-generate the Prisma client after schema edits

```bash
npm run prisma:generate
```

## API Reference

All routes are prefixed with `/api` and versioned with `/v1`.

### Health

| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | Liveness + database probe |

### Agent — `/api/v1/agent`

#### Orchestrated capabilities

| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/agent/ask` | Answer a natural language engineering question about a repo (Phase 7) |
| POST | `/api/v1/agent/find-files` | Find the most relevant files for a query using search + LLM re-ranking (Phase 7) |
| POST | `/api/v1/agent/explain` | Produce a structured code explanation for a specific file (Phase 7) |
| POST | `/api/v1/agent/propose-patch` | Analyse a change request and produce a validated patch proposal with unified diff (Phase 8) |
| POST | `/api/v1/agent/generate-tests` | Generate a complete, runnable unit test file for a source file (Phase 8) |
| POST | `/api/v1/agent/create-pr-draft` | Assemble approved changes into a GitHub branch, commit, and draft PR (Phase 9) |

#### Run management

| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/agent/runs` | Create an agent run (manual / legacy) |
| GET | `/api/v1/agent/runs` | List all runs |
| GET | `/api/v1/agent/runs/:id` | Get a single run |

#### Example: ask a question

```bash
curl -X POST http://localhost:3000/api/v1/agent/ask \
  -H 'Content-Type: application/json' \
  -d '{
    "repoId": "<repoId>",
    "question": "Where is JWT token validation implemented and how does it work?",
    "topKFiles": 5,
    "topKChunks": 8
  }'
```

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Question answered",
  "data": {
    "runId": "cm9abc123",
    "question": "Where is JWT token validation implemented and how does it work?",
    "answer": "JWT validation is handled in AuthService (src/modules/auth/auth.service.ts). The service uses the @nestjs/jwt JwtService to verify tokens on each request via the JwtAuthGuard. The guard calls authService.validateToken() which decodes the token, checks expiry, and loads the user from the database.",
    "confidence": 0.92,
    "relevantFiles": [
      { "filePath": "src/modules/auth/auth.service.ts", "reason": "filename matches auth, content matches jwt" },
      { "filePath": "src/modules/auth/jwt.strategy.ts", "reason": "filename matches jwt" }
    ],
    "reasoning": "Found AuthService and JwtStrategy as the primary auth files. JwtStrategy.validate() is the Passport.js integration point.",
    "caveats": ["Token refresh logic was not found — may be missing or in a separate package."],
    "durationMs": 1840
  },
  "timestamp": "2026-03-17T10:00:00.000Z"
}
```

#### Example: find relevant files

```bash
curl -X POST http://localhost:3000/api/v1/agent/find-files \
  -H 'Content-Type: application/json' \
  -d '{
    "repoId": "<repoId>",
    "query": "database connection pooling and query timeout configuration",
    "topK": 8
  }'
```

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Relevant files found",
  "data": {
    "runId": "cm9def456",
    "query": "database connection pooling and query timeout configuration",
    "files": [
      {
        "filePath": "src/modules/database/database.service.ts",
        "fileName": "database.service.ts",
        "language": "typescript",
        "lineCount": 45,
        "relevanceScore": 0.97,
        "reason": "Contains PrismaClient instantiation with connection pool config"
      },
      {
        "filePath": "src/config/config.service.ts",
        "fileName": "config.service.ts",
        "language": "typescript",
        "lineCount": 120,
        "relevanceScore": 0.71,
        "reason": "Exposes DATABASE_URL and pool size env variables"
      }
    ],
    "searchStrategy": "Matched files by filename keywords 'database', path keywords 'database', and content keywords 'pool', 'timeout'",
    "totalCandidates": 6,
    "durationMs": 980
  },
  "timestamp": "2026-03-17T10:00:01.000Z"
}
```

#### Example: explain a file

```bash
curl -X POST http://localhost:3000/api/v1/agent/explain \
  -H 'Content-Type: application/json' \
  -d '{
    "repoId": "<repoId>",
    "filePath": "src/modules/runs/runs.service.ts",
    "additionalContext": "focus on the step lifecycle and state transitions"
  }'
```

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Code explained",
  "data": {
    "runId": "cm9ghi789",
    "filePath": "src/modules/runs/runs.service.ts",
    "summary": "RunsService manages the full lifecycle of AgentRun records and their child steps and tool executions. It exposes methods to create, transition, and query runs, steps, and tool executions through Prisma.",
    "purpose": "Acts as the central audit and execution-tracking service for all agent operations within the Buntu Finance copilot system.",
    "keyComponents": [
      { "name": "create", "type": "function", "description": "Creates a new AgentRun in PENDING status" },
      { "name": "markRunning", "type": "function", "description": "Transitions a run from PENDING to RUNNING" },
      { "name": "appendStep", "type": "function", "description": "Creates a new AgentRunStep linked to a run" },
      { "name": "recordToolExecution", "type": "function", "description": "Persists a ToolExecution audit record" }
    ],
    "dependencies": ["@nestjs/common", "@prisma/client", "class-transformer"],
    "sideEffects": ["writes to AgentRun table", "writes to AgentRunStep table", "writes to ToolExecution table"],
    "complexity": "medium",
    "testability": "high",
    "suggestions": [
      "Consider extracting step transitions into a StepService to keep RunsService focused",
      "Add optimistic concurrency check on run status transitions"
    ],
    "durationMs": 2100
  },
  "timestamp": "2026-03-17T10:00:02.000Z"
}
```

#### Example: propose a patch

```bash
curl -X POST http://localhost:3000/api/v1/agent/propose-patch \
  -H 'Content-Type: application/json' \
  -d '{
    "repoId": "<repoId>",
    "request": "The login endpoint returns 500 when the user email contains uppercase letters. Fix the case-sensitivity bug.",
    "topKFiles": 5,
    "includeTests": true
  }'
```

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Patch proposal created",
  "data": {
    "runId": "cm9jkl012",
    "patchId": "cm9mno345",
    "title": "Fix email case sensitivity in login",
    "description": "Normalise email to lower-case before lookup.\n\n**Reasoning:** Email addresses are case-insensitive per RFC 5321 so the lookup must normalise the input.\n\n**Testing notes:** Test login with \"User@Example.com\" — should succeed and match the \"user@example.com\" record.\n\n**Breaking changes:** No",
    "diff": "--- a/src/auth/auth.service.ts\n+++ b/src/auth/auth.service.ts\n@@ -10,1 +10,1 @@\n-  const user = await this.db.user.findUnique({ where: { email } });\n+  const user = await this.db.user.findUnique({ where: { email: email.toLowerCase() } });",
    "filePaths": ["src/auth/auth.service.ts"],
    "riskLevel": "LOW",
    "breakingChanges": false,
    "reasoning": "Email addresses are case-insensitive per RFC 5321.",
    "testingNotes": "Test login with mixed-case email. Verify that \"User@Example.com\" logs in successfully.",
    "validationWarnings": [],
    "durationMs": 3200
  },
  "timestamp": "2026-03-17T10:00:03.000Z"
}
```

> **Note:** The patch is persisted but **never auto-applied**. Retrieve it via `GET /api/v1/patches/<patchId>` and apply it through the PR draft flow or manually.

#### Example: generate tests

```bash
curl -X POST http://localhost:3000/api/v1/agent/generate-tests \
  -H 'Content-Type: application/json' \
  -d '{
    "repoId": "<repoId>",
    "filePath": "src/modules/auth/auth.service.ts",
    "framework": "jest",
    "additionalContext": "Focus on the validateToken method and expired-token edge cases."
  }'
```

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Tests generated",
  "data": {
    "runId": "cm9pqr678",
    "testgenId": "cm9stu901",
    "targetFile": "src/modules/auth/auth.service.ts",
    "testFile": "src/modules/auth/auth.service.spec.ts",
    "content": "import { Test } from '@nestjs/testing';\nimport { AuthService } from './auth.service';\n\ndescribe('AuthService', () => {\n  let service: AuthService;\n\n  beforeEach(async () => {\n    const module = await Test.createTestingModule({\n      providers: [AuthService, { provide: DatabaseService, useValue: mockDb }],\n    }).compile();\n    service = module.get(AuthService);\n  });\n\n  it('should validate a valid token', async () => { /* ... */ });\n  it('should throw UnauthorizedException for an expired token', async () => { /* ... */ });\n  it('should throw UnauthorizedException for a malformed token', async () => { /* ... */ });\n});",
    "framework": "jest",
    "testCount": 3,
    "coveredScenarios": ["valid token", "expired token", "malformed token"],
    "setupNotes": "Mock DatabaseService with jest.fn(). No external process needed.",
    "mockedDependencies": ["DatabaseService"],
    "validationWarnings": [],
    "durationMs": 4100
  },
  "timestamp": "2026-03-17T10:00:04.000Z"
}
```

> **Note:** The generated test file is persisted but **not written to disk**. Retrieve it via `GET /api/v1/testgen/<testgenId>` and apply it in a PR draft.

#### Example: create a PR draft

**Prerequisites:**
1. Run `POST /agent/propose-patch` → get `patchId`
2. Create an approval: `POST /api/v1/approvals` with `{ riskLevel, reason, patchId }`
3. Approve it: `PATCH /api/v1/approvals/:id/approve`
4. Apply the diff to your files locally and prepare the new file contents

```bash
curl -X POST http://localhost:3000/api/v1/agent/create-pr-draft \
  -H 'Content-Type: application/json' \
  -d '{
    "repoId": "<repoId>",
    "patchId": "<patchId>",
    "approvalId": "<approvalId>",
    "changedFiles": [
      {
        "filePath": "src/auth/auth.service.ts",
        "content": "import { Injectable } from '\''@nestjs/common'\'';\n\n@Injectable()\nexport class AuthService {\n  async login(email: string) {\n    const user = await this.db.user.findUnique({\n      where: { email: email.toLowerCase() },\n    });\n    return user;\n  }\n}"
      }
    ],
    "testgenId": "<optional-testgen-id>",
    "baseBranch": "main",
    "teamReviewers": ["alice", "bob"]
  }'
```

```json
{
  "success": true,
  "statusCode": 200,
  "message": "PR draft created",
  "data": {
    "runId": "cm9vwx234",
    "prDraftId": "cm9yza567",
    "prNumber": 42,
    "prUrl": "https://github.com/buntu/copilot/pull/42",
    "title": "Fix email case sensitivity in login",
    "body": "## Summary\n- Normalise email address to lower-case before database lookup\n\n## Changes\n- `src/auth/auth.service.ts` — apply `email.toLowerCase()` before `findUnique`\n\n## Testing\n- Login with `\"User@Example.com\"` should succeed\n\n## Checklist\n- [x] Unit tests added\n- [ ] Integration test against real DB",
    "headBranch": "fix/email-case-sensitivity-in-login",
    "baseBranch": "main",
    "labels": ["bug"],
    "checklist": ["Unit tests added", "Integration test against real DB"],
    "riskLevel": "LOW",
    "isDraft": true,
    "status": "OPEN",
    "durationMs": 5800
  },
  "timestamp": "2026-03-17T10:00:05.000Z"
}
```

> **Note:** The PR is opened as a **draft** and is never auto-merged. The entire operation is approval-gated — any attempt without an `APPROVED` `ApprovalRequest` is rejected with `400 Validation failed`.

#### Retrieving the full step audit trail after a run

```bash
# Get the run with all steps
curl http://localhost:3000/api/v1/runs/<runId>

# Get tool execution records for the run
curl http://localhost:3000/api/v1/runs/<runId>/tool-executions
```

### Runs — `/api/v1/runs`

| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/runs` | Create a run |
| GET | `/api/v1/runs` | List runs |
| GET | `/api/v1/runs/:id` | Get run with steps |
| PATCH | `/api/v1/runs/:id/start` | Mark run as running |
| PATCH | `/api/v1/runs/:id/cancel` | Cancel a run |
| POST | `/api/v1/runs/:id/steps` | Append a step |
| GET | `/api/v1/runs/:id/steps` | List steps |
| PATCH | `/api/v1/runs/:id/steps/:stepId/start` | Start a step |
| PATCH | `/api/v1/runs/:id/steps/:stepId/complete` | Complete a step |
| PATCH | `/api/v1/runs/:id/steps/:stepId/fail` | Fail a step |
| POST | `/api/v1/runs/:id/tool-executions` | Record a tool execution |
| GET | `/api/v1/runs/:id/tool-executions` | List tool executions |

### Knowledge — `/api/v1/knowledge`

#### Knowledge Source pipeline (Phase 4)

| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/knowledge/sources/text` | Ingest plain-text document |
| POST | `/api/v1/knowledge/sources/markdown` | Ingest Markdown document |
| POST | `/api/v1/knowledge/sources/webpage` | Ingest HTML webpage |
| GET | `/api/v1/knowledge/sources` | List active knowledge sources (`?sourceType=`) |
| GET | `/api/v1/knowledge/sources/:id` | Get a knowledge source |
| DELETE | `/api/v1/knowledge/sources/:id` | Deactivate a knowledge source (soft-delete) |
| GET | `/api/v1/knowledge/chunks` | Retrieve relevant chunks (`?query=&topK=&sourceType=&tags=&sourceIds=&minScore=`) |

#### Legacy repo-file endpoints (Phase 1/2)

| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/knowledge/ingest` | Ingest a repo source file |
| GET | `/api/v1/knowledge/query` | Query the knowledge base |
| DELETE | `/api/v1/knowledge/repos/:repoId` | Delete all documents for a repo |

### Repos — `/api/v1/repos`

#### Repository management

| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/repos` | Register a repository |
| GET | `/api/v1/repos` | List active repos |
| GET | `/api/v1/repos/:id` | Get a repo |
| DELETE | `/api/v1/repos/:id` | Deactivate a repo |

#### Indexing (Phase 5)

| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/repos/:id/indexes` | Start indexing a local path (async, returns PENDING) |
| GET | `/api/v1/repos/:id/indexes/latest` | Get the most recent index status |
| GET | `/api/v1/repos/:id/indexes/:indexId` | Get a specific index |

#### File access

| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/repos/:id/files` | List indexed files (`?language=typescript&extension=ts`) |
| GET | `/api/v1/repos/:id/files/:fileId` | Get file metadata |
| GET | `/api/v1/repos/:id/files/:fileId/content` | Read full file content from disk |

#### Search

| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/repos/:id/search` | Search files (`?query=auth&mode=filename\|path\|keyword\|all&topK=20`) |
| GET | `/api/v1/repos/:id/candidates` | Find top candidate files for a natural language query (`?query=where+is+JWT+validation&topK=10`) |

#### Repo map

| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/repos/:id/tree` | Hierarchical directory tree of indexed files |
| GET | `/api/v1/repos/:id/languages` | Files grouped by language |
| GET | `/api/v1/repos/:id/summary` | Aggregate stats (file count, lines, language breakdown) |

#### Indexing example

```bash
# 1. Register the repo
curl -X POST http://localhost:3000/api/v1/repos \
  -H 'Content-Type: application/json' \
  -d '{"name":"copilot","fullName":"buntu/copilot","cloneUrl":"https://github.com/buntu/copilot.git"}'

# 2. Start indexing a local clone
curl -X POST http://localhost:3000/api/v1/repos/<repoId>/indexes \
  -H 'Content-Type: application/json' \
  -d '{
    "localPath": "/home/user/projects/copilot",
    "branch": "main",
    "additionalIgnorePatterns": ["*.min.js", "fixtures/"]
  }'

# 3. Poll for completion
curl http://localhost:3000/api/v1/repos/<repoId>/indexes/latest

# 4. Find relevant files for a question
curl "http://localhost:3000/api/v1/repos/<repoId>/candidates?query=where+is+JWT+token+validation&topK=5"

# 5. Search by filename
curl "http://localhost:3000/api/v1/repos/<repoId>/search?query=auth.service&mode=filename"

# 6. Read a file
curl http://localhost:3000/api/v1/repos/<repoId>/files/<fileId>/content
```

### Tools — `/api/v1/tools`

| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/tools` | List all registered tools with their JSON-schema definitions |
| POST | `/api/v1/tools/execute` | Execute a tool by name with typed input |

#### Registered tools

| Tool name | `requiresApproval` | Description |
|---|---|---|
| `search_files` | false | Search indexed repo files by filename, path, keyword, or all strategies |
| `read_file` | false | Read the full content of a single file by relative path |
| `read_files` | false | Read multiple files in a single call (max 20) |
| `get_repo_tree` | false | Return the hierarchical directory tree of all indexed files |
| `grep_code` | false | Search for a regex or literal string across all indexed source files |
| `generate_diff` | false | Generate a unified diff between original and modified file contents |
| `run_tests` | **true** | Run the project test suite (`test \| test:cov \| test:e2e \| test:watch`) |
| `run_lint` | **true** | Run the project linter (`lint \| lint:fix`) |

### Patches — `/api/v1/patches`

| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/patches` | Create a patch proposal |
| GET | `/api/v1/patches` | List patch proposals |
| GET | `/api/v1/patches/:id` | Get a patch proposal |
| PATCH | `/api/v1/patches/:id/apply` | Mark patch as applied |

### PR Drafts — `/api/v1/pr-drafts`

| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/pr-drafts` | Create a PR draft |
| GET | `/api/v1/pr-drafts` | List PR drafts |
| GET | `/api/v1/pr-drafts/:id` | Get a PR draft |
| PATCH | `/api/v1/pr-drafts/:id` | Update status / PR number / URL |
| PATCH | `/api/v1/pr-drafts/:id/close` | Close a PR draft |

### Approvals — `/api/v1/approvals`

| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/approvals` | Create an approval request |
| GET | `/api/v1/approvals/pending` | List pending approvals (sorted by risk) |
| GET | `/api/v1/approvals/runs/:runId` | List approvals for a run |
| GET | `/api/v1/approvals/:id` | Get an approval |
| PATCH | `/api/v1/approvals/:id/approve` | Approve |
| PATCH | `/api/v1/approvals/:id/reject` | Reject |

### Audit Logs — `/api/v1/audit`

| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/audit` | List recent audit logs |
| GET | `/api/v1/audit/runs/:runId` | Audit trail for a run |
| GET | `/api/v1/audit/entity/:type/:id` | Audit trail for any entity |

### Test Generation — `/api/v1/testgen`

| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/testgen` | Generate a test scaffold |
| GET | `/api/v1/testgen?repoId=` | List generated tests |
| GET | `/api/v1/testgen/:id` | Get a generated test |

## Architecture

```
src/
  main.ts                  # Bootstrap, pipes, versioning, filters
  app.module.ts            # Root module
  health.controller.ts     # GET /api/health
  config/                  # Joi-validated env, AppConfigService
  common/
    enums/                 # RunStatus, RunType, StepStatus, StepType,
    │                      # ApprovalStatus, RiskLevel, PrDraftStatus,
    │                      # AuditAction, LlmProvider, AgentCapability
    interfaces/            # ApiResponse<T>, PaginatedResult<T>
    dto/                   # ApiResponseDto, PaginationDto
    exceptions/            # AppException hierarchy + AllExceptionsFilter
    utils/                 # ok(), created(), paginated()
  modules/
    database/              # Global PrismaClient singleton
    agent/                 # Orchestration entry point — all 6 capabilities
    │   agent.orchestrator.ts     # Stage-by-stage orchestration with run+step tracking
    │   agent.service.ts          # Facade over orchestrator + legacy run CRUD
    │   dto/                      # Request+response DTOs for all 6 capabilities
    runs/                  # Full run + step + tool-execution lifecycle
    knowledge/             # Document ingest + semantic query
    │   parsers/           #   PlainTextParser, MarkdownParser, HtmlParser (strategy pattern)
    │   embedding/         #   IEmbeddingProvider interface + StubEmbeddingProvider
    │   interfaces/        #   TextChunk, IngestResult, RetrievalQuery, etc.
    │   chunking.service.ts      # Deterministic overlap chunker
    │   ingestion.service.ts     # parse → chunk → checksum dedup → upsert pipeline
    │   retrieval.service.ts     # Keyword scoring retrieval (pgvector-ready)
    repo/                  # Repository registry + indexing + search
    │   interfaces/        #   MatchReason, SearchMode, FileMatchResult, DirectoryNode
    │   file-reader.service.ts    # Safe filesystem reads (binary detection, path-traversal guard)
    │   repo-index.service.ts     # Background indexer: walk → chunk → upsert RepoFile/RepoFileChunk
    │   repo-search.service.ts    # Filename/path/keyword/ALL search + candidate finder
    │   repo-map.service.ts       # Directory tree, language breakdown, index summary
    llm/                   # LLM integration layer
    │   providers/         #   OpenAiProvider (wired), AnthropicProvider (stub)
    │   schemas/           #   Zod output schemas + input interfaces per task
    │   prompts/           #   Pure prompt builder functions per task
    │   guardrails.service.ts     # Pre/post validation (context budget, empty, truncated)
    │   output-parser.service.ts  # JSON extraction + Zod schema validation
    │   prompt-builder.service.ts # NestJS wrapper around prompt functions
    │   llm.service.ts            # completeStructured<T> + 6 task methods
    tools/                 # Tool registry + dispatcher
    patch/                 # Patch proposal persistence
    prdraft/               # PR draft persistence
    approval/              # Approval request workflow
    audit/                 # Immutable audit log
    testgen/               # Test scaffold generation
    github/                # GitHub API integration — branch, commit, PR creation
    │   github-branch.service.ts  # Create branches via Git Data API
    │   github-commit.service.ts  # Tree-based atomic multi-file commits
    │   github-pr.service.ts      # Draft PR creation + labels + reviewer requests
    │   github.service.ts         # Unified facade, Octokit auth (PAT or App)
```

### Status machines

**AgentRun:**
```
PENDING → RUNNING → COMPLETED
       ↘         ↘ FAILED
         CANCELLED
```

**AgentRunStep:**
```
PENDING → RUNNING → COMPLETED
                 ↘ FAILED
        ↘ SKIPPED
```

**ApprovalRequest:**
```
WAITING → APPROVED
        ↘ REJECTED
```

**PullRequestDraft:**
```
DRAFT → OPEN → MERGED
             ↘ CLOSED
  ↘ ABANDONED
```

## Testing

```bash
# Unit tests
npm run test

# Unit tests with coverage
npm run test:cov

# Watch mode
npm run test:watch

# E2E tests (requires a running database)
npm run test:e2e
```

## Phase Roadmap

| Phase | Status | Description |
|---|---|---|
| 1 | Complete | Foundation scaffold — modules, DTOs, config, health |
| 2 | Complete | Persistence layer — full run lifecycle, steps, tool executions, approvals, audit, PR drafts |
| 3 | Complete | LLM integration — provider abstraction, prompt builders, output parser, guardrails, Zod schemas |
| 4 | Complete | Knowledge pipeline — ingestion, chunking, keyword retrieval, parser strategies, embedding stub |
| 5 | Complete | Repo indexing layer — file scanner, language detection, search, candidate finder, repo map |
| 6 | Complete | Tool execution framework — 8 tools, typed registry, audit-logged executor, shell safety |
| 7 | Complete | Agent orchestration — `ask`, `find-files`, `explain` with run/step tracking end-to-end |
| 8 | Complete | Write capabilities — `propose-patch` (validated diff proposals) + `generate-tests` (runnable test files) |
| 9 | Complete | GitHub integration — approval-gated branch/commit/PR creation via `create-pr-draft` |
| 10 | Planned | Webhook handling — GitHub App events, PR status callbacks, automatic run updates |

## Contributing

Internal project. See the Buntu Engineering handbook for contribution guidelines.
