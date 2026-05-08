import { getAuthenticatedUser } from '@/utils/user'
import * as Sentry from '@sentry/nextjs'
import { z } from 'zod'

import { smoothSseStream } from './smoothSseStream'

const MAX_MESSAGE_LENGTH = 5000
const MAX_MESSAGES = 20

const partSchema = z.object({
  type: z.string(),
  text: z.string().max(MAX_MESSAGE_LENGTH).optional(),
})

const messageSchema = z.object({
  id: z.string().min(1).max(64),
  role: z.enum(['system', 'assistant', 'user']),
  parts: z.array(partSchema).min(1),
})

const requestSchema = z.object({
  messages: z.array(messageSchema).min(1).max(MAX_MESSAGES),
})

const MINTLIFY_DOMAIN =
  process.env.MINTLIFY_ASSISTANT_DOMAIN ?? 'polar.mintlify.app'

export async function POST(req: Request) {
  const user = await getAuthenticatedUser()
  if (!user) {
    return new Response('Unauthorized', { status: 401 })
  }

  if (!process.env.MINTLIFY_ASSISTANT_API_KEY) {
    return new Response('Mintlify assistant not configured', { status: 503 })
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
    const upstream = await fetch(
      `https://api.mintlify.com/discovery/v2/assistant/${MINTLIFY_DOMAIN}/message`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.MINTLIFY_ASSISTANT_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fp: user.id,
          messages: parsed.data.messages,
        }),
      },
    )

    if (!upstream.ok || !upstream.body) {
      const text = await upstream.text().catch(() => '')
      const detail = `Mintlify assistant returned ${upstream.status} for domain "${MINTLIFY_DOMAIN}": ${text.slice(0, 500)}`
      console.error('[feedback/question]', detail)
      Sentry.captureMessage(detail)
      return new Response(detail, { status: 502 })
    }

    return new Response(upstream.body.pipeThrough(smoothSseStream()), {
      headers: {
        'Content-Type':
          upstream.headers.get('Content-Type') ?? 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
      },
    })
  } catch (error) {
    console.error('[feedback/question] fetch threw:', error)
    Sentry.captureException(error)
    return new Response(
      `Mintlify assistant fetch failed: ${(error as Error).message}`,
      { status: 502 },
    )
  }
}
