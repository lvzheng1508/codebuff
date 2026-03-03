type LocalRunStatus = 'running' | 'completed' | 'failed' | 'cancelled'
type LocalStepStatus = 'running' | 'completed' | 'skipped'

export type LocalAgentRun = {
  id: string
  userId: string
  agentId: string
  ancestorRunIds: string[]
  status: LocalRunStatus
  createdAt: string
  completedAt?: string
  totalSteps?: number
  directCredits?: number
  totalCredits?: number
  errorMessage?: string
}

type LocalAgentStep = {
  id: string
  runId: string
  stepNumber: number
  credits?: number
  childRunIds?: string[]
  messageId?: string | null
  status: LocalStepStatus
  errorMessage?: string
  createdAt: string
  completedAt: string
}

const runs = new Map<string, LocalAgentRun>()
const steps = new Map<string, LocalAgentStep[]>()

export function createLocalAgentRun(params: {
  userId: string
  agentId: string
  ancestorRunIds?: string[]
}): string {
  const runId = crypto.randomUUID()
  runs.set(runId, {
    id: runId,
    userId: params.userId,
    agentId: params.agentId,
    ancestorRunIds: params.ancestorRunIds ?? [],
    status: 'running',
    createdAt: new Date().toISOString(),
  })
  return runId
}

export function finishLocalAgentRun(params: {
  runId: string
  status: Exclude<LocalRunStatus, 'running'>
  totalSteps: number
  directCredits: number
  totalCredits: number
  errorMessage?: string
}): void {
  const run = runs.get(params.runId)
  if (!run) {
    return
  }
  run.status = params.status
  run.totalSteps = params.totalSteps
  run.directCredits = params.directCredits
  run.totalCredits = params.totalCredits
  run.errorMessage = params.errorMessage
  run.completedAt = new Date().toISOString()
}

export function getLocalAgentRun(params: {
  runId: string
  userId: string
}): LocalAgentRun | null {
  const run = runs.get(params.runId)
  if (!run || run.userId !== params.userId) {
    return null
  }
  return run
}

export function appendLocalAgentStep(params: {
  runId: string
  userId: string
  stepNumber: number
  credits?: number
  childRunIds?: string[]
  messageId?: string | null
  status?: LocalStepStatus
  errorMessage?: string
  startTime?: string
}): { ok: true; stepId: string } | { ok: false; status: 403 | 404 } {
  const run = runs.get(params.runId)
  if (!run) {
    return { ok: false, status: 404 }
  }
  if (run.userId !== params.userId) {
    return { ok: false, status: 403 }
  }

  const stepId = crypto.randomUUID()
  const existing = steps.get(params.runId) ?? []
  existing.push({
    id: stepId,
    runId: params.runId,
    stepNumber: params.stepNumber,
    credits: params.credits,
    childRunIds: params.childRunIds,
    messageId: params.messageId,
    status: params.status ?? 'completed',
    errorMessage: params.errorMessage,
    createdAt: params.startTime ?? new Date().toISOString(),
    completedAt: new Date().toISOString(),
  })
  steps.set(params.runId, existing)
  return { ok: true, stepId }
}
