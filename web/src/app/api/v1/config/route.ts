import { NextRequest, NextResponse } from 'next/server'
import type { LocalCliConfig } from '@codebuff/common/config/local-config.types'

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
