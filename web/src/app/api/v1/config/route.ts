import { NextRequest, NextResponse } from 'next/server'
import type { LocalCliConfig } from '@codebuff/common/config/local-config.types'

import { getCurrentConfig, setCurrentConfig } from './store'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    setCurrentConfig(body.config as LocalCliConfig | null)
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid JSON in request body' },
      { status: 400 }
    )
  }
}

export async function GET() {
  return NextResponse.json({ config: getCurrentConfig() })
}
