import { getAuthenticatedUser } from '@/utils/user'
import * as Sentry from '@sentry/nextjs'
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
    return new Response('Unauthorized', { status: 401 })
  }

  if (!process.env.PYDANTIC_AI_GATEWAY_API_KEY) {
    return new Response('AI gateway not configured', { status: 503 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }

  const parsed = requestSchema.safeParse(body)
  if (!parsed.success) {
    return new Response('Invalid request', { status: 400 })
  }

  try {
    const status = await validateFeedbackQuestion(parsed.data.message.trim(), {
      userId: user.id,
      conversationId: parsed.data.conversationId,
      organizationId: parsed.data.organizationId,
    })
    return Response.json({ status })
  } catch (error) {
    console.error('[feedback/question/validate] threw:', error)
    Sentry.captureException(error)
    return new Response('Validation failed', { status: 502 })
  }
}
