# Local CLI Transformation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform Codebuff into a fully local CLI tool that uses user-configured OpenAI-compatible APIs instead of Codebuff's official billing and key system.

**Architecture:** Keep the existing two-process architecture (CLI + Backend). Replace LLM calls to use local configuration, disable billing/credits checks, add optional local mode (no auth required).

**Tech Stack:** TypeScript, Next.js (backend), Bun (CLI), YAML/JSON (config)

---

## Overview

This plan transforms Codebuff to work as a local CLI tool with:

1. **Config file-based LLM setup** - Users configure endpoints in a local config file
2. **Agent-LLM decoupling** - Each agent can use different LLMs via config
3. **Billing disabled** - All credits/subscription checks become no-ops
4. **Optional local mode** - No login required when using local config

---

## Task 1: Create Configuration File Schema and Loader

**Files:**
- Create: `common/src/config/local-config.types.ts`
- Create: `common/src/config/local-config.ts`
- Create: `common/src/config/load-config.ts`

**Step 1: Write the type definitions**

```typescript
// common/src/config/local-config.types.ts
export interface LocalEndpoint {
  name: string
  base_url: string
  api_key?: string
  model?: string
}

export interface AgentModelBinding {
  agent_id: string
  endpoint: string
  model?: string
}

export interface LocalCliConfig {
  mode: 'local' | 'cloud'
  default_endpoint?: string
  endpoints: LocalEndpoint[]
  agent_bindings?: AgentModelBinding[]
}
```

**Step 2: Write the config loader**

```typescript
// common/src/config/load-config.ts
import fs from 'fs/promises'
import path from 'path'
import { existsSync } from 'fs'
import type { LocalCliConfig } from './local-config.types'

const CONFIG_PATHS = [
  path.join(process.cwd(), 'codebuff.local.yaml'),
  path.join(process.cwd(), 'codebuff.local.json'),
  path.join(process.cwd(), '../codebuff.local.yaml'),
  path.join(process.cwd(), '../codebuff.local.json'),
]

export async function loadLocalConfig(): Promise<LocalCliConfig | null> {
  for (const configPath of CONFIG_PATHS) {
    if (existsSync(configPath)) {
      const content = await fs.readFile(configPath, 'utf-8')
      if (configPath.endsWith('.json')) {
        return JSON.parse(content) as LocalCliConfig
      } else {
        // YAML parsing - use js-yaml
        const yaml = (await import('js-yaml')).default
        return yaml.load(content) as LocalCliConfig
      }
    }
  }
  return null
}
```

**Step 3: Add js-yaml dependency**

Run: `cd common && bun add js-yaml`

Expected: Package added to common/package.json

**Step 4: Write tests for config loader**

```typescript
// common/src/config/__tests__/load-config.test.ts
import { loadLocalConfig } from '../load-config'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'

describe('loadLocalConfig', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'codebuff-test-'))
  })

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true })
  })

  it('returns null when no config file exists', async () => {
    const result = await loadLocalConfig()
    expect(result).toBeNull()
  })

  it('loads JSON config file', async () => {
    const config = {
      mode: 'local',
      endpoints: [{ name: 'openai', base_url: 'https://api.openai.com' }],
    }
    const configPath = path.join(tempDir, 'codebuff.local.json')
    await fs.writeFile(configPath, JSON.stringify(config))

    const originalCwd = process.cwd()
    process.chdir(tempDir)
    const result = await loadLocalConfig()
    process.chdir(originalCwd)

    expect(result).toEqual(config)
  })
})
```

**Step 5: Run tests**

Run: `cd common && bun test`

Expected: Tests pass

**Step 6: Commit**

```bash
git add common/src/config/
git commit -m "feat: add local config schema and loader"
```

---

## Task 2: Pass Config to Backend via CLI

**Files:**
- Create: `common/src/config/config-client.ts`
- Modify: `cli/src/utils/codebuff-api.ts`
- Modify: `web/src/app/api/v1/chat/completions/_post.ts`

**Step 1: Write config client for CLI-Backend communication**

```typescript
// common/src/config/config-client.ts
import type { LocalCliConfig } from './local-config.types'

export interface ConfigRequest {
  config: LocalCliConfig | null
}

export async function sendConfigToBackend(
  config: LocalCliConfig | null,
  baseUrl: string = 'http://localhost:3000'
): Promise<void> {
  const response = await fetch(`${baseUrl}/api/v1/config`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ config }),
  })

  if (!response.ok) {
    throw new Error(`Failed to send config: ${response.statusText}`)
  }
}
```

**Step 2: Add config API endpoint in backend**

```typescript
// web/src/app/api/v1/config/route.ts
import { NextRequest, NextResponse } from 'next/server'
import type { LocalCliConfig } from '@/config/local-config.types'

// Store config in memory (per-session)
let currentConfig: LocalCliConfig | null = null

export async function POST(request: NextRequest) {
  const body = await request.json()
  currentConfig = body.config as LocalCliConfig | null
  return NextResponse.json({ success: true })
}

export async function GET() {
  return NextResponse.json({ config: currentConfig })
}

export function getCurrentConfig(): LocalCliConfig | null {
  return currentConfig
}
```

**Step 3: Modify CLI to load and send config on startup**

```typescript
// cli/src/utils/codebuff-api.ts - add to initialization
import { loadLocalConfig } from '@codebuff/common/config'
import { sendConfigToBackend } from '@codebuff/common/config/config-client'

export async function initializeConfig() {
  const config = await loadLocalConfig()
  if (config) {
    await sendConfigToBackend(config)
    console.log(`Loaded local config with ${config.endpoints.length} endpoint(s)`)
  }
  return config
}
```

**Step 4: Update CLI index to initialize config**

```typescript
// cli/src/index.tsx - add to startup
import { initializeConfig } from './utils/codebuff-api'

// In the initialization code
await initializeConfig()
```

**Step 5: Test config is passed to backend**

Run: `bun run start-cli` with a config file present

Expected: Backend receives config via `/api/v1/config`

**Step 6: Commit**

```bash
git add common/src/config/config-client.ts web/src/app/api/v1/config/ cli/src/
git commit -m "feat: pass local config from CLI to backend"
```

---

## Task 3: Create LLM Client Factory Using Config

**Files:**
- Create: `web/src/llm-api/local-llm-factory.ts`
- Modify: `web/src/llm-api/openai.ts`

**Step 1: Write the factory function**

```typescript
// web/src/llm-api/local-llm-factory.ts
import { getCurrentConfig } from '@/app/api/v1/config/route'
import type { LocalEndpoint, AgentModelBinding } from '@/config/local-config.types'

export interface LlmClientConfig {
  baseUrl: string
  apiKey?: string
  model: string
}

export function getLlmClientForAgent(agentId: string, defaultModel: string): LlmClientConfig {
  const config = getCurrentConfig()

  if (!config || config.mode !== 'local') {
    // Use default behavior (env vars, existing logic)
    return {
      baseUrl: process.env.OPENAI_API_BASE || 'https://api.openai.com',
      apiKey: process.env.OPENAI_API_KEY,
      model: defaultModel,
    }
  }

  // Find agent-specific binding
  const binding = config.agent_bindings?.find(b => b.agent_id === agentId)
  const endpointName = binding?.endpoint || config.default_endpoint

  if (!endpointName) {
    throw new Error(`No endpoint configured for agent ${agentId}`)
  }

  const endpoint = config.endpoints.find(e => e.name === endpointName)
  if (!endpoint) {
    throw new Error(`Endpoint ${endpointName} not found in config`)
  }

  return {
    baseUrl: endpoint.base_url,
    apiKey: endpoint.api_key || process.env.OPENAI_API_KEY,
    model: binding?.model || endpoint.model || defaultModel,
  }
}
```

**Step 2: Modify OpenAI client to use factory**

```typescript
// web/src/llm-api/openai.ts - add new function
import { getLlmClientForAgent } from './local-llm-factory'

export async function callOpenAIWithConfig(
  agentId: string,
  defaultModel: string,
  messages: any[],
  options: any = {}
) {
  const clientConfig = getLlmClientForAgent(agentId, defaultModel)

  const response = await fetch(clientConfig.baseUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${clientConfig.apiKey}`,
      ...options.headers,
    },
    body: JSON.stringify({
      model: clientConfig.model,
      messages,
      ...options.body,
    }),
  })

  return response
}
```

**Step 3: Write tests for factory**

```typescript
// web/src/llm-api/__tests__/local-llm-factory.test.ts
import { getLlmClientForAgent } from '../local-llm-factory'
import { getCurrentConfig } from '@/app/api/v1/config/route'

vi.mock('@/app/api/v1/config/route')

describe('getLlmClientForAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('uses default behavior when no config', () => {
    vi.mocked(getCurrentConfig).mockReturnValue(null)

    const result = getLlmClientForAgent('test-agent', 'gpt-4')

    expect(result.baseUrl).toBe('https://api.openai.com')
    expect(result.model).toBe('gpt-4')
  })

  it('uses agent-specific binding when configured', () => {
    const config = {
      mode: 'local' as const,
      endpoints: [
        { name: 'custom', base_url: 'https://custom.ai', api_key: 'test-key' },
      ],
      agent_bindings: [
        { agent_id: 'test-agent', endpoint: 'custom' },
      ],
    }
    vi.mocked(getCurrentConfig).mockReturnValue(config)

    const result = getLlmClientForAgent('test-agent', 'gpt-4')

    expect(result.baseUrl).toBe('https://custom.ai')
    expect(result.apiKey).toBe('test-key')
  })
})
```

**Step 4: Run tests**

Run: `cd web && bun test`

Expected: Tests pass

**Step 5: Commit**

```bash
git add web/src/llm-api/
git commit -m "feat: add LLM client factory using local config"
```

---

## Task 4: Disable Billing/Credits Checks in Local Mode

**Files:**
- Modify: `web/src/app/api/v1/chat/completions/_post.ts`
- Modify: `packages/billing/subscription.ts` (optional - add local mode bypass)

**Step 1: Add helper to check if local mode is active**

```typescript
// web/src/lib/local-mode.ts
import { getCurrentConfig } from '@/app/api/v1/config/route'

export function isLocalMode(): boolean {
  const config = getCurrentConfig()
  return config?.mode === 'local'
}

export function skipBillingChecks(): boolean {
  return isLocalMode()
}
```

**Step 2: Modify completions endpoint to skip credits check in local mode**

```typescript
// web/src/app/api/v1/chat/completions/_post.ts - modify
import { skipBillingChecks } from '@/lib/local-mode'

// Find the credits check section (around line 100-150)
// Wrap it with local mode check:

// BEFORE:
// await ensureSubscriberBlockGrant(...)
// checkCreditsBalance(...)

// AFTER:
if (!skipBillingChecks()) {
  await ensureSubscriberBlockGrant(...)
  checkCreditsBalance(...)
} else {
  // Local mode: skip all billing checks
  console.log('Local mode active: skipping billing checks')
}
```

**Step 3: Test billing is skipped in local mode**

Run: Start with local config, make a completion request

Expected: Request succeeds without credits check

**Step 4: Write test**

```typescript
// web/src/lib/__tests__/local-mode.test.ts
import { isLocalMode, skipBillingChecks } from '../local-mode'
import { getCurrentConfig } from '@/app/api/v1/config/route'

vi.mock('@/app/api/v1/config/route')

describe('Local Mode', () => {
  it('returns false when no config', () => {
    vi.mocked(getCurrentConfig).mockReturnValue(null)
    expect(isLocalMode()).toBe(false)
  })

  it('returns true when config mode is local', () => {
    vi.mocked(getCurrentConfig).mockReturnValue({ mode: 'local' } as any)
    expect(isLocalMode()).toBe(true)
  })

  it('skips billing checks in local mode', () => {
    vi.mocked(getCurrentConfig).mockReturnValue({ mode: 'local' } as any)
    expect(skipBillingChecks()).toBe(true)
  })
})
```

**Step 5: Run tests**

Run: `cd web && bun test`

Expected: Tests pass

**Step 6: Commit**

```bash
git add web/src/lib/local-mode.ts web/src/app/api/v1/chat/completions/_post.ts
git commit -m "feat: skip billing checks in local mode"
```

---

## Task 5: Make Authentication Optional in Local Mode

**Files:**
- Modify: `cli/src/utils/auth.ts`
- Modify: `web/src/middleware.ts` (if exists)
- Modify: `web/src/app/api/v1/chat/completions/_post.ts`

**Step 1: Add local mode check to CLI auth**

```typescript
// cli/src/utils/auth.ts - modify
import { loadLocalConfig } from '@codebuff/common/config'

export async function getAuthToken(): Promise<string | null> {
  const config = await loadLocalConfig()

  // Skip auth in local mode
  if (config?.mode === 'local') {
    return 'local-mode-token'
  }

  // Existing auth logic...
  const credsPath = path.join(os.homedir(), '.config', 'manicode', 'credentials.json')
  // ... rest of existing code
}
```

**Step 2: Add local mode bypass to backend auth check**

```typescript
// web/src/lib/auth-bypass.ts
import { skipBillingChecks } from './local-mode'

export function shouldBypassAuth(): boolean {
  return skipBillingChecks() // Same condition: local mode
}

export function createLocalAuthToken(): string {
  return 'local-mode-token'
}
```

**Step 3: Modify API endpoints to allow local mode token**

```typescript
// web/src/app/api/v1/chat/completions/_post.ts - add auth bypass
import { shouldBypassAuth, createLocalAuthToken } from '@/lib/auth-bypass'

// In the auth check section:
const token = request.headers.get('authorization')
if (shouldBypassAuth() && token === createLocalAuthToken()) {
  // Allow request in local mode
} else {
  // Existing auth check...
}
```

**Step 4: Test CLI works without login in local mode**

Run: `bun run start-cli` with local config, no login

Expected: CLI works without prompting for login

**Step 5: Commit**

```bash
git add cli/src/utils/auth.ts web/src/lib/auth-bypass.ts web/src/app/api/v1/chat/completions/_post.ts
git commit -m "feat: make authentication optional in local mode"
```

---

## Task 6: Update Agent Loop to Use Configured LLM

**Files:**
- Modify: `web/src/server/agent-runner.ts` (or equivalent file)
- Modify: `web/src/app/api/v1/agent-runs/route.ts`

**Step 1: Find where agent LLM calls are made**

Search for: `callOpenAI` or similar LLM invocation in agent runner

**Step 2: Inject config-based client**

```typescript
// In agent runner, replace direct OpenAI calls:
import { callOpenAIWithConfig } from '@/llm-api/openai'

// BEFORE:
// const response = await callOpenAI(messages, { model: 'gpt-4' })

// AFTER:
// const response = await callOpenAIWithConfig(agent.id, 'gpt-4', messages)
```

**Step 3: Test different agents use different endpoints**

Config:
```yaml
mode: local
endpoints:
  - name: openai
    base_url: https://api.openai.com
    api_key: sk-xxx
  - name: deepseek
    base_url: https://api.deepseek.com
    api_key: sk-yyy
agent_bindings:
  - agent_id: planner
    endpoint: openai
  - agent_id: editor
    endpoint: deepseek
```

Expected: Planner uses OpenAI, Editor uses DeepSeek

**Step 4: Commit**

```bash
git add web/src/server/agent-runner.ts
git commit -m "feat: use configured LLM per agent"
```

---

## Task 7: Add Example Config File and Documentation

**Files:**
- Create: `codebuff.local.example.yaml`
- Modify: `README.md` (add local mode section)

**Step 1: Create example config**

```yaml
# codebuff.local.example.yaml
mode: local  # Use 'local' for self-hosted, 'cloud' for Codebuff official

# Default endpoint for agents without specific bindings
default_endpoint: openai

# Available LLM endpoints
endpoints:
  - name: openai
    base_url: https://api.openai.com
    api_key: sk-your-openai-key-here
    model: gpt-4

  - name: deepseek
    base_url: https://api.deepseek.com
    api_key: sk-your-deepseek-key
    model: deepseek-chat

  - name: ollama
    base_url: http://localhost:11434/v1
    model: llama2

# Optional: Map specific agents to endpoints
agent_bindings:
  - agent_id: planner
    endpoint: openai
    model: gpt-4-turbo

  - agent_id: editor
    endpoint: deepseek
```

**Step 2: Add documentation to README**

```markdown
## Local Mode (Self-Hosted)

Codebuff can run in local mode without requiring a Codebuff account or subscription.

### Setup

1. Copy the example config:
   ```bash
   cp codebuff.local.example.yaml codebuff.local.yaml
   ```

2. Edit `codebuff.local.yaml` with your API endpoints

3. Start Codebuff normally:
   ```bash
   codebuff
   ```

In local mode:
- No login required
- No credits/billing checks
- You control which LLMs each agent uses
```

**Step 3: Commit**

```bash
git add codebuff.local.example.yaml README.md
git commit -m "docs: add local mode example config and documentation"
```

---

## Task 8: Integration Testing

**Files:**
- Create: `cli/src/__tests__/local-mode.e2e.test.ts`
- Create: `web/src/__tests__/local-mode-integration.test.ts`

**Step 1: Write CLI integration test**

```typescript
// cli/src/__tests__/local-mode.e2e.test.ts
import { loadLocalConfig } from '@codebuff/common/config'
import { initializeConfig } from '../utils/codebuff-api'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'

describe('Local Mode E2E', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'codebuff-e2e-'))
  })

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true })
  })

  it('loads and sends config to backend', async () => {
    const config = {
      mode: 'local',
      endpoints: [
        { name: 'test', base_url: 'https://test.ai', api_key: 'test-key' },
      ],
    }
    const configPath = path.join(tempDir, 'codebuff.local.yaml')
    await fs.writeFile(configPath, YAML.stringify(config))

    const originalCwd = process.cwd()
    process.chdir(tempDir)

    const loaded = await loadLocalConfig()
    expect(loaded).toEqual(config)

    process.chdir(originalCwd)
  })
})
```

**Step 2: Run E2E tests**

Run: `cd cli && bun test`

Expected: All tests pass

**Step 3: Manual testing checklist**

- [ ] CLI starts without login when local config present
- [ ] Completions work with configured endpoint
- [ ] Different agents use different endpoints when configured
- [ ] No credits deducted in local mode
- [ ] Missing config falls back to cloud mode (existing behavior)

**Step 4: Commit**

```bash
git add cli/src/__tests__/ web/src/__tests__/
git commit -m "test: add local mode integration tests"
```

---

## Task 9: Validation and Edge Cases

**Files:**
- Modify: `common/src/config/load-config.ts`
- Modify: `web/src/llm-api/local-llm-factory.ts`

**Step 1: Add config validation**

```typescript
// common/src/config/load-config.ts - add validation
import { z } from 'zod'

const LocalEndpointSchema = z.object({
  name: z.string(),
  base_url: z.string().url(),
  api_key: z.string().optional(),
  model: z.string().optional(),
})

const LocalConfigSchema = z.object({
  mode: z.enum(['local', 'cloud']),
  default_endpoint: z.string().optional(),
  endpoints: z.array(LocalEndpointSchema).min(1),
  agent_bindings: z.array(z.object({
    agent_id: z.string(),
    endpoint: z.string(),
    model: z.string().optional(),
  })).optional(),
})

export async function loadLocalConfig(): Promise<LocalCliConfig | null> {
  // ... existing load logic ...

  try {
    return LocalConfigSchema.parse(parsed)
  } catch (error) {
    console.error('Invalid config:', error)
    throw new Error(`Invalid codebuff.local config: ${error}`)
  }
}
```

**Step 2: Add error handling for missing endpoints**

```typescript
// web/src/llm-api/local-llm-factory.ts - improve error
export function getLlmClientForAgent(agentId: string, defaultModel: string): LlmClientConfig {
  // ... existing code ...

  if (!endpoint) {
    throw new Error(
      `Endpoint "${endpointName}" not found. Available endpoints: ` +
      config.endpoints.map(e => e.name).join(', ')
    )
  }

  // ... rest of code
}
```

**Step 3: Add graceful fallback**

```typescript
// web/src/llm-api/local-llm-factory.ts
export function getLlmClientForAgent(agentId: string, defaultModel: string): LlmClientConfig {
  const config = getCurrentConfig()

  if (!config) {
    console.warn(`No local config found, using environment variables`)
    // Fall back to env vars
  }

  // ... rest of code
}
```

**Step 4: Test edge cases**

- [ ] Empty config file
- [ ] Invalid YAML/JSON
- [ ] Missing required fields
- [ ] Unknown endpoint in agent_binding
- [ ] Network error to configured endpoint

**Step 5: Commit**

```bash
git add common/src/config/load-config.ts web/src/llm-api/local-llm-factory.ts
git commit -m "feat: add config validation and error handling"
```

---

## Summary of Changes

| File | Change |
|------|--------|
| `common/src/config/` | New config types and loader |
| `web/src/app/api/v1/config/` | New config API endpoint |
| `web/src/llm-api/local-llm-factory.ts` | LLM client factory |
| `web/src/lib/local-mode.ts` | Local mode detection |
| `web/src/lib/auth-bypass.ts` | Auth bypass for local mode |
| `web/src/app/api/v1/chat/completions/_post.ts` | Skip billing in local mode |
| `cli/src/utils/auth.ts` | Optional auth in local mode |
| `cli/src/utils/codebuff-api.ts` | Send config to backend |
| `codebuff.local.example.yaml` | Example config |
| `README.md` | Documentation |

---

## Testing Checklist

- [ ] Unit tests for config loader pass
- [ ] Unit tests for LLM factory pass
- [ ] Integration tests pass
- [ ] Manual testing with real OpenAI API key
- [ ] Manual testing with multiple endpoints
- [ ] Verify billing is skipped in local mode
- [ ] Verify auth is skipped in local mode
- [ ] Verify fallback to cloud mode when no config

---

## Rollback Plan

If any issues arise:

1. Revert to cloud mode: Remove `codebuff.local.yaml` file
2. Existing behavior preserved: All changes are additive with fallbacks
3. Config errors logged: Invalid config will show clear error messages

---

*End of Implementation Plan*
