export type Fetch = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>

// The openai and @anthropic-ai/sdk clients share this much of their generated core
export type FetchClient = { withOptions(options: { fetch: Fetch }): unknown }

type Meter = {
  generates: (input: string | URL | Request, init?: RequestInit) => boolean
  request?: (
    input: string | URL | Request,
    init?: RequestInit,
  ) => RequestInit | undefined
  // One reader per response, given its JSON body or each event of its stream
  read: (init?: RequestInit) => (text: string) => Promise<void>
}

export const postedPath = (
  input: string | URL | Request,
  init?: RequestInit,
) => {
  const url = input instanceof Request ? input.url : String(input)
  const method =
    init?.method ?? (input instanceof Request ? input.method : 'GET')

  return method.toUpperCase() === 'POST' ? new URL(url).pathname : undefined
}

const meterEvents = (read: (text: string) => Promise<void>) => {
  const decoder = new TextDecoder()
  let buffer = ''

  return new TransformStream<Uint8Array, Uint8Array>({
    transform: async (chunk, controller) => {
      const text = buffer + decoder.decode(chunk, { stream: true })
      const lines = text.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        if (line.startsWith('data:')) {
          await read(line.slice(5))
        }
      }

      controller.enqueue(chunk)
    },
  })
}

// The SDK's helpers (parse, stream, runTools) bypass a wrapped create(), so meter at fetch
export const meteredClient = (client: FetchClient, meter: Meter) => {
  // Private in the SDK's types, but it holds the app's own fetch
  const fetch: Fetch = Reflect.get(client, 'fetch') ?? globalThis.fetch

  return client.withOptions({
    fetch: async (input, init) => {
      const response = await fetch(
        input,
        meter.request ? meter.request(input, init) : init,
      )
      const type = response.headers.get('content-type') ?? ''

      if (!response.ok || !response.body || !meter.generates(input, init)) {
        return response
      }

      const read = meter.read(init)

      if (type.includes('text/event-stream')) {
        return new Response(response.body.pipeThrough(meterEvents(read)), {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
        })
      }

      if (type.includes('application/json')) {
        await read(
          await response
            .clone()
            .text()
            .catch(() => ''),
        )
      }

      return response
    },
  })
}
