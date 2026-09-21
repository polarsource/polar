import { subscribe } from '@/live'

export const dynamic = 'force-dynamic'

const encoder = new TextEncoder()
const HEARTBEAT_MS = 15_000

/**
 * Server-sent events. Each channel of the organization's state arrives as
 * its own named event when it changes; `live` events carry what this
 * process just saw happen. One loop feeds every connection.
 */
export const GET = (request: Request) => {
  let unsubscribe = () => {}
  let heartbeat: ReturnType<typeof setInterval> | undefined
  const stream = new ReadableStream({
    start(controller) {
      const send = (chunk: string) => {
        try {
          controller.enqueue(encoder.encode(chunk))
        } catch {
          // The client is gone; the abort handler below cleans up.
        }
      }
      unsubscribe = subscribe((name, json) =>
        send(`event: ${name}\ndata: ${json}\n\n`),
      )
      heartbeat = setInterval(() => send(': keep-alive\n\n'), HEARTBEAT_MS)
      request.signal.addEventListener(
        'abort',
        () => {
          unsubscribe()
          clearInterval(heartbeat)
          try {
            controller.close()
          } catch {
            // Already closed.
          }
        },
        { once: true },
      )
    },
    cancel() {
      unsubscribe()
      clearInterval(heartbeat)
    },
  })
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}
