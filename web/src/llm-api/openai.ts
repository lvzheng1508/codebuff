import { env } from '@codebuff/internal/env'

import {
  consumeCreditsForMessage,
  extractRequestMetadata,
  insertMessageToBigQuery,
} from './helpers'
import { getLlmClientForAgent } from './local-llm-factory'

import type { UsageData } from './helpers'
import type { InsertMessageBigqueryFn } from '@codebuff/common/types/contracts/bigquery'
import type { Logger } from '@codebuff/common/types/contracts/logger'
import type { ChatCompletionRequestBody } from './types'

export const OPENAI_SUPPORTED_MODELS = ['gpt-5', 'gpt-5.1'] as const
export type OpenAIModel = (typeof OPENAI_SUPPORTED_MODELS)[number]

const INPUT_TOKEN_COSTS: Record<OpenAIModel, number> = {
  'gpt-5': 1.25,
  'gpt-5.1': 1.25,
} as const
const CACHED_INPUT_TOKEN_COSTS: Record<OpenAIModel, number> = {
  'gpt-5': 0.125,
  'gpt-5.1': 0.125,
} as const
const OUTPUT_TOKEN_COSTS: Record<OpenAIModel, number> = {
  'gpt-5': 10,
  'gpt-5.1': 10,
} as const

type OpenAIUsage = {
  prompt_tokens?: number
  prompt_tokens_details?: { cached_tokens?: number } | null
  completion_tokens?: number
  completion_tokens_details?: { reasoning_tokens?: number } | null
  total_tokens?: number
  // We will inject cost fields below
  cost?: number
  cost_details?: { upstream_inference_cost?: number | null } | null
}

function toChatCompletionsUrl(baseUrl: string): string {
  const normalizedBase = baseUrl.replace(/\/+$/, '')
  if (normalizedBase.endsWith('/chat/completions')) {
    return normalizedBase
  }
  // OpenAI-compatible vendors often expose versioned roots like /v1 or /v4.
  // In these cases we should append /chat/completions (not /v1/chat/completions).
  if (/\/v\d+$/.test(normalizedBase)) {
    return `${normalizedBase}/chat/completions`
  }
  return `${normalizedBase}/v1/chat/completions`
}

function buildOpenAICompatibleBody(params: {
  body: ChatCompletionRequestBody
  model: string
  forceStream?: boolean
}): Record<string, unknown> {
  const { body, model, forceStream } = params
  const openaiBody: Record<string, unknown> = {
    ...body,
    model,
    ...(forceStream !== undefined ? { stream: forceStream } : {}),
  }

  openaiBody.max_completion_tokens =
    openaiBody.max_completion_tokens ?? openaiBody.max_tokens
  delete openaiBody.max_tokens

  if (openaiBody.reasoning && typeof openaiBody.reasoning === 'object') {
    const reasoning = openaiBody.reasoning as {
      enabled?: boolean
      effort?: 'high' | 'medium' | 'low'
    }
    if (reasoning.enabled ?? true) {
      openaiBody.reasoning_effort = reasoning.effort ?? 'medium'
    }
  }
  delete openaiBody.reasoning

  delete openaiBody.stop
  delete openaiBody.usage
  delete openaiBody.provider
  delete openaiBody.transforms
  delete openaiBody.codebuff_metadata

  return openaiBody
}

function extractUsageAndCost(
  usage: OpenAIUsage,
  model: OpenAIModel,
): UsageData {
  const inputTokenCost = INPUT_TOKEN_COSTS[model]
  const cachedInputTokenCost = CACHED_INPUT_TOKEN_COSTS[model]
  const outputTokenCost = OUTPUT_TOKEN_COSTS[model]

  const inTokens = usage.prompt_tokens ?? 0
  const cachedInTokens = usage.prompt_tokens_details?.cached_tokens ?? 0
  const outTokens = usage.completion_tokens ?? 0
  const cost =
    (inTokens / 1_000_000) * inputTokenCost +
    (cachedInTokens / 1_000_000) * cachedInputTokenCost +
    (outTokens / 1_000_000) * outputTokenCost

  return {
    inputTokens: inTokens,
    outputTokens: outTokens,
    cacheReadInputTokens: cachedInTokens,
    reasoningTokens: usage.completion_tokens_details?.reasoning_tokens ?? 0,
    cost,
  }
}

export async function handleOpenAINonStream({
  body,
  userId,
  stripeCustomerId,
  agentId,
  fetch,
  logger,
  insertMessageBigquery,
}: {
  body: ChatCompletionRequestBody
  userId: string
  stripeCustomerId?: string | null
  agentId: string
  fetch: typeof globalThis.fetch
  logger: Logger
  insertMessageBigquery: InsertMessageBigqueryFn
}) {
  const startTime = new Date()
  const { clientId, clientRequestId, costMode, n } = extractRequestMetadata({
    body,
    logger,
  })

  const { model } = body
  const modelShortName =
    typeof model === 'string' ? model.split('/')[1] : undefined
  if (
    !modelShortName ||
    !OPENAI_SUPPORTED_MODELS.includes(modelShortName as OpenAIModel)
  ) {
    throw new Error(
      `Unsupported OpenAI model: ${model} (supported models include only: ${OPENAI_SUPPORTED_MODELS.map((m) => `'${m}'`).join(', ')})`,
    )
  }

  // Build OpenAI-compatible body
  const openaiBody = buildOpenAICompatibleBody({
    body,
    model: modelShortName,
    forceStream: false,
  })
  if (n) {
    openaiBody.n = n
  }

  // Get LLM client configuration for this agent
  const clientConfig = getLlmClientForAgent(agentId, modelShortName)
  const baseUrl = toChatCompletionsUrl(clientConfig.baseUrl)
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (clientConfig.apiKey) {
    headers.Authorization = `Bearer ${clientConfig.apiKey}`
  }

  const response = await fetch(baseUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      ...openaiBody,
      model: clientConfig.model,
    }),
  })

  if (!response.ok) {
    throw new Error(
      `OpenAI API error: ${response.status} ${response.statusText} ${await response.text()}`,
    )
  }

  const data = await response.json()

  // Extract usage and content from all choices
  const usage: OpenAIUsage = data.usage ?? {}
  const usageData = extractUsageAndCost(usage, modelShortName as OpenAIModel)

  // Inject cost into response
  data.usage.cost = usageData.cost
  data.usage.cost_details = { upstream_inference_cost: null }

  // Collect all response content from all choices into an array
  const responseContents: string[] = []
  if (data.choices && Array.isArray(data.choices)) {
    for (const choice of data.choices) {
      responseContents.push(choice.message?.content ?? '')
    }
  }
  const responseText = JSON.stringify(responseContents)
  const reasoningText = ''

  // BigQuery insert (do not await)
  insertMessageToBigQuery({
    messageId: data.id,
    userId,
    startTime,
    request: body,
    reasoningText,
    responseText,
    usageData,
    logger,
    insertMessageBigquery,
  }).catch((error) => {
    logger.error({ error }, 'Failed to insert message into BigQuery (OpenAI)')
  })

  await consumeCreditsForMessage({
    messageId: data.id,
    userId,
    stripeCustomerId,
    agentId,
    clientId,
    clientRequestId,
    startTime,
    model: data.model,
    reasoningText,
    responseText,
    usageData,
    byok: false,
    logger,
    costMode,
  })

  return {
    ...data,
    choices: [
      {
        index: 0,
        message: { content: responseText, role: 'assistant' },
        finish_reason: 'stop',
      },
    ],
  }
}

export async function handleOpenAICompatibleNonStream(params: {
  body: ChatCompletionRequestBody
  userId: string
  stripeCustomerId?: string | null
  agentId: string
  fetch: typeof globalThis.fetch
  logger: Logger
  insertMessageBigquery: InsertMessageBigqueryFn
}) {
  const { body, userId, stripeCustomerId, agentId, fetch, logger, insertMessageBigquery } =
    params
  const startTime = new Date()
  const { clientId, clientRequestId, costMode } = extractRequestMetadata({
    body,
    logger,
  })

  const rawModel = typeof body.model === 'string' ? body.model : 'unknown'
  const shortModel = rawModel.includes('/') ? rawModel.split('/').at(-1)! : rawModel

  const clientConfig = getLlmClientForAgent(agentId, shortModel)
  const baseUrl = toChatCompletionsUrl(clientConfig.baseUrl)
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (clientConfig.apiKey) {
    headers.Authorization = `Bearer ${clientConfig.apiKey}`
  }

  const response = await fetch(baseUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(
      buildOpenAICompatibleBody({
        body,
        model: clientConfig.model,
        forceStream: false,
      }),
    ),
  })
  if (!response.ok) {
    throw new Error(
      `OpenAI-compatible API error: ${response.status} ${response.statusText} ${await response.text()}`,
    )
  }

  const data = await response.json()
  const usage = (data?.usage ?? {}) as OpenAIUsage
  const usageData: UsageData = {
    inputTokens: usage.prompt_tokens ?? 0,
    outputTokens: usage.completion_tokens ?? 0,
    cacheReadInputTokens: usage.prompt_tokens_details?.cached_tokens ?? 0,
    reasoningTokens: usage.completion_tokens_details?.reasoning_tokens ?? 0,
    cost: 0,
  }

  if (data.usage) {
    data.usage.cost = 0
    data.usage.cost_details = { upstream_inference_cost: null }
  }

  const responseContents: string[] = []
  if (Array.isArray(data?.choices)) {
    for (const choice of data.choices) {
      responseContents.push(choice?.message?.content ?? '')
    }
  }
  const responseText = JSON.stringify(responseContents)
  const reasoningText = ''

  insertMessageToBigQuery({
    messageId: data.id,
    userId,
    startTime,
    request: body,
    reasoningText,
    responseText,
    usageData,
    logger,
    insertMessageBigquery,
  }).catch((error) => {
    logger.error(
      { error },
      'Failed to insert message into BigQuery (OpenAI-compatible)',
    )
  })

  await consumeCreditsForMessage({
    messageId: data.id,
    userId,
    stripeCustomerId,
    agentId,
    clientId,
    clientRequestId,
    startTime,
    model: data.model ?? clientConfig.model,
    reasoningText,
    responseText,
    usageData,
    byok: false,
    logger,
    costMode,
  })

  return {
    ...data,
    choices: [
      {
        index: 0,
        message: { content: responseText, role: 'assistant' },
        finish_reason: 'stop',
      },
    ],
  }
}

export async function handleOpenAICompatibleStream(params: {
  body: ChatCompletionRequestBody
  agentId: string
  fetch: typeof globalThis.fetch
}) {
  const { body, agentId, fetch } = params
  const rawModel = typeof body.model === 'string' ? body.model : 'unknown'
  const shortModel = rawModel.includes('/') ? rawModel.split('/').at(-1)! : rawModel
  const clientConfig = getLlmClientForAgent(agentId, shortModel)
  const baseUrl = toChatCompletionsUrl(clientConfig.baseUrl)
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (clientConfig.apiKey) {
    headers.Authorization = `Bearer ${clientConfig.apiKey}`
  }

  const response = await fetch(baseUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(
      buildOpenAICompatibleBody({
        body,
        model: clientConfig.model,
        forceStream: true,
      }),
    ),
  })
  if (!response.ok) {
    throw new Error(
      `OpenAI-compatible stream API error: ${response.status} ${response.statusText} ${await response.text()}`,
    )
  }
  if (!response.body) {
    throw new Error('OpenAI-compatible stream API returned empty body')
  }
  return response.body
}

export async function callOpenAIWithConfig(
  agentId: string,
  defaultModel: string,
  messages: any[],
  options: any = {}
) {
  const clientConfig = getLlmClientForAgent(agentId, defaultModel)
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers,
  }
  if (clientConfig.apiKey) {
    headers.Authorization = `Bearer ${clientConfig.apiKey}`
  }

  const response = await fetch(clientConfig.baseUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: clientConfig.model,
      messages,
      ...options.body,
    }),
  })

  return response
}
