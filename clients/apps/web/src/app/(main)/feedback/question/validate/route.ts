import { getServerSideAPI } from '@/utils/client/serverside'
import { getAuthenticatedUser, getUserOrganizations } from '@/utils/user'
import * as Sentry from '@sentry/nextjs'
import { NextResponse } from 'next/server'
import { z } from 'zod'

import { validateFeedbackQuestion } from '../validation'

const MAX_MESSAGE_LENGTH = 5000

const requestSchema = z.object({
  message: z.string().min(1).max(MAX_MESSAGE_LENGTH),
  conversationId: z.string().min(1).max(64).optional(),
  organizationId: z.string().min(1).max(64).optional(),
})

export async function POST(req: Request) {
  const user = await getAuthenticatedUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!process.env.PYDANTIC_AI_GATEWAY_API_KEY) {
    return NextResponse.json(
      { error: 'Assistant not configured' },
      { status: 503 },
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = requestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  let trustedOrganizationId: string | undefined
  if (parsed.data.organizationId) {
    const api = await getServerSideAPI()
    const userOrganizations = await getUserOrganizations(api)
    if (
      userOrganizations.some((org) => org.id === parsed.data.organizationId)
    ) {
      trustedOrganizationId = parsed.data.organizationId
    }
  }

  try {
    const status = await validateFeedbackQuestion(parsed.data.message.trim(), {
      userId: user.id,
      conversationId: parsed.data.conversationId,
      organizationId: trustedOrganizationId,
    })
    return NextResponse.json({ status })
  } catch (error) {
    Sentry.captureException(error)
    return NextResponse.json({ error: 'Validation failed' }, { status: 502 })
  }
}
