import { getHealthz } from './_get'
import { getCurrentConfig } from '../v1/config/store'

export const GET = async () => {
  const getAgentCount = async () => {
    if (process.env.NODE_ENV !== 'production') {
      return 0
    }

    const config = getCurrentConfig()
    const dbUrl = process.env.DATABASE_URL
    const isPlaceholderDbUrl =
      dbUrl === 'postgres://user:pass@localhost:5432/db'
    if (config?.mode === 'local' || isPlaceholderDbUrl) {
      return 0
    }

    try {
      const mod = await import('@/server/agents-data')
      return mod.getAgentCount()
    } catch {
      return 0
    }
  }
  return getHealthz({ getAgentCount })
}
