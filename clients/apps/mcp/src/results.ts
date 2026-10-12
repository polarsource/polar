import { Effect, Schema } from 'effect'

export class ToolError extends Schema.TaggedError<ToolError>()('ToolError', {
  message: Schema.String,
  cause: Schema.optionalKey(Schema.Defect()),
}) {
  static fromCause(this: void, cause: unknown) {
    return new ToolError({
      message: cause instanceof Error ? cause.message : String(cause),
      cause,
    })
  }
}

const MAX_RESULT_CHARS = 24_000

const truncate = (text: string) =>
  text.length <= MAX_RESULT_CHARS
    ? text
    : `${text.slice(0, MAX_RESULT_CHARS)}\n\n--- TRUNCATED ---\nThe result was ${text.length} characters (limit ${MAX_RESULT_CHARS}). Return fewer fields or items.`

// Clients with their own code mode read structured content in their scripts,
// so it is never truncated; the text is what other clients show the model.
export interface StructuredResult {
  readonly text: string
  readonly structuredContent: Record<string, unknown>
}

const toolResult = (result: string | StructuredResult) =>
  typeof result === 'string'
    ? { content: [{ type: 'text' as const, text: truncate(result) }] }
    : {
        content: [{ type: 'text' as const, text: truncate(result.text) }],
        structuredContent: result.structuredContent,
      }

const toolError = (error: ToolError) => ({
  content: [
    {
      type: 'text' as const,
      text: truncate(`Error: ${error.message}`),
    },
  ],
  isError: true,
})

export const makeToolRunner = Effect.gen(function* () {
  const run = Effect.runPromiseWith(yield* Effect.context<never>())
  return (
    effect: Effect.Effect<string | StructuredResult, ToolError>,
    signal: AbortSignal,
  ) =>
    run(
      effect.pipe(
        Effect.match({ onSuccess: toolResult, onFailure: toolError }),
      ),
      { signal },
    )
})
