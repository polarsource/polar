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

// Operation results are sent whole, with the text being the serialized JSON of
// the structured content as the MCP spec recommends; clients apply their own
// output limits. Code mode results come from model-written scripts and stay capped.
interface OperationResult {
  readonly text: string
  readonly structuredContent?: Record<string, unknown>
}

const toolResult = (result: string | OperationResult) =>
  typeof result === 'string'
    ? { content: [{ type: 'text' as const, text: truncate(result) }] }
    : {
        content: [{ type: 'text' as const, text: result.text }],
        ...(result.structuredContent && {
          structuredContent: result.structuredContent,
        }),
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
    effect: Effect.Effect<string | OperationResult, ToolError>,
    signal: AbortSignal,
  ) =>
    run(
      effect.pipe(
        Effect.match({ onSuccess: toolResult, onFailure: toolError }),
      ),
      { signal },
    )
})
