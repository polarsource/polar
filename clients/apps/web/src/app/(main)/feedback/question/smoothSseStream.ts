const DEFAULT_DELAY_MS = 18

const splitDelta = (delta: string): string[] => {
  const tokens = delta.match(/\S+\s*|\s+/g)
  return tokens && tokens.length > 0 ? tokens : [delta]
}

export const smoothSseStream = (
  delayMs: number = DEFAULT_DELAY_MS,
): TransformStream<Uint8Array, Uint8Array> => {
  const encoder = new TextEncoder()
  const decoder = new TextDecoder()
  let buffer = ''

  const sleep = (ms: number) =>
    new Promise<void>((resolve) => setTimeout(resolve, ms))

  return new TransformStream<Uint8Array, Uint8Array>({
    async transform(chunk, controller) {
      buffer += decoder.decode(chunk, { stream: true })

      let separator = buffer.indexOf('\n\n')
      while (separator !== -1) {
        const event = buffer.slice(0, separator + 2)
        buffer = buffer.slice(separator + 2)
        separator = buffer.indexOf('\n\n')

        const dataMatch = event.match(/^data:\s?(.+)\n\n$/s)
        if (!dataMatch) {
          controller.enqueue(encoder.encode(event))
          continue
        }

        const payload = dataMatch[1]
        if (payload === '[DONE]') {
          controller.enqueue(encoder.encode(event))
          continue
        }

        let parsed: Record<string, unknown>
        try {
          parsed = JSON.parse(payload)
        } catch {
          controller.enqueue(encoder.encode(event))
          continue
        }

        const isTextDelta =
          parsed.type === 'text-delta' || parsed.type === 'text'
        const deltaField = (parsed.delta ?? parsed.textDelta) as
          | string
          | undefined

        if (!isTextDelta || typeof deltaField !== 'string') {
          controller.enqueue(encoder.encode(event))
          continue
        }

        const pieces = splitDelta(deltaField)
        for (let i = 0; i < pieces.length; i++) {
          const piece = pieces[i]
          const out = {
            ...parsed,
            ...(parsed.delta !== undefined ? { delta: piece } : {}),
            ...(parsed.textDelta !== undefined ? { textDelta: piece } : {}),
          }
          // Only one of delta/textDelta will be present; if neither was, fall
          // back to delta to preserve a single field shape.
          if (
            parsed.delta === undefined &&
            parsed.textDelta === undefined
          ) {
            ;(out as { delta: string }).delta = piece
          }
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(out)}\n\n`))
          if (i < pieces.length - 1) {
            await sleep(delayMs)
          }
        }
      }
    },
    flush(controller) {
      if (buffer.length > 0) {
        controller.enqueue(encoder.encode(buffer))
      }
    },
  })
}
