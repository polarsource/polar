import { frame } from '@/live'

const POLL_MS = 2000
const encoder = new TextEncoder()
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** Server-sent events: one frame of the whole organization every couple of seconds. */
export const GET = async (request: Request) => {
  const stream = new ReadableStream({
    async start(controller) {
      while (!request.signal.aborted) {
        try {
          const data = JSON.stringify(await frame())
          controller.enqueue(encoder.encode(`data: ${data}\n\n`))
        } catch (error) {
          console.error(error)
        }
        await sleep(POLL_MS)
      }
      controller.close()
    },
  })
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
    },
  })
}
