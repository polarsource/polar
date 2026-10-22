import { Effect, Schema } from 'effect'
import { RequestLog } from './log'

const ToolErrorKind = Schema.Literals([
  'api',
  'script',
  'sandbox',
  'internal',
  'cancelled',
])
export type ToolErrorKind = typeof ToolErrorKind.Type

export class ToolError extends Schema.TaggedError<ToolError>()('ToolError', {
  message: Schema.String,
  kind: Schema.optionalKey(ToolErrorKind),
  status: Schema.optionalKey(Schema.Number),
  fields: Schema.optionalKey(Schema.Array(Schema.String)),
  cause: Schema.optionalKey(Schema.Defect()),
}) {
  static fromCause(this: void, cause: unknown, kind?: ToolErrorKind) {
    return new ToolError({
      message: cause instanceof Error ? cause.message : String(cause),
      ...(kind && { kind }),
      cause,
    })
  }
}

const MAX_RESULT_CHARS = 24_000

const EMPTY_RESULTS = new Set(['', 'null', 'undefined', '[]', '{}', '""'])

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
  const log = yield* RequestLog
  const run = Effect.runPromiseWith(yield* Effect.context<never>())
  const onSuccess = (result: string | OperationResult) => {
    const text = typeof result === 'string' ? result : result.text
    log.isError = false
    log.resultChars = text.length
    log.truncated = typeof result === 'string' && text.length > MAX_RESULT_CHARS
    log.emptyResult = EMPTY_RESULTS.has(text.trim())
    return toolResult(result)
  }
  const onFailure = (error: ToolError) => {
    log.isError = true
    log.errorKind = error.kind
    log.apiStatus = error.status
    if (error.fields) {
      log.apiErrorFields = error.fields
    }
    // Sandbox errors come from the runtime, such as an exceeded CPU limit.
    // Script and API errors can quote customer data, so they stay out.
    if (error.kind === 'sandbox') {
      log.errorMessage = error.message
    }
    return toolError(error)
  }
  return (
    effect: Effect.Effect<string | OperationResult, ToolError, RequestLog>,
    signal: AbortSignal,
  ) =>
    run(
      effect.pipe(
        Effect.provideService(RequestLog, log),
        Effect.match({ onSuccess, onFailure }),
      ),
      { signal },
    ).catch((cause: unknown) => {
      log.isError = true
      log.errorKind = signal.aborted ? 'cancelled' : 'internal'
      throw cause
    })
})
