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

const toolResult = (text: string) => ({
  content: [{ type: 'text' as const, text: truncate(text) }],
})

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
  return (effect: Effect.Effect<string, ToolError>, signal: AbortSignal) =>
    run(
      effect.pipe(
        Effect.match({ onSuccess: toolResult, onFailure: toolError }),
      ),
      { signal },
    )
})
