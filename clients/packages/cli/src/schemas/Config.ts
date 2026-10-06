import { Data, Schema } from 'effect'

export const IssueSeverity = Schema.Literals(['error', 'warning'])

const Loc = Schema.Array(Schema.Union([Schema.String, Schema.Number]))

export const ServerIssue = Schema.Struct({
  severity: IssueSeverity,
  type: Schema.String,
  loc: Loc,
  msg: Schema.String,
  input: Schema.optional(Schema.Unknown),
})

export const ApiError = Schema.Struct({ error: Schema.String })

export const ConfigValidation = Schema.Struct({
  issues: Schema.Array(ServerIssue),
})

export const RequestValidationError = Schema.Struct({
  detail: Schema.Array(
    Schema.Struct({
      type: Schema.String,
      loc: Loc,
      msg: Schema.String,
      input: Schema.optional(Schema.Unknown),
    }),
  ),
})

export interface SourceLocation {
  readonly line: number
  readonly column: number
  readonly length: number
}

export interface ConfigIssue {
  readonly severity: typeof IssueSeverity.Type
  readonly code: string
  readonly path: string
  readonly message: string
  readonly got?: string | undefined
  readonly location?: SourceLocation | undefined
}

export interface LoadedConfig {
  readonly file: string
  readonly source: string
  readonly input: unknown
  readonly generated: boolean
}

export class ConfigError extends Data.TaggedError('ConfigError')<{
  message: string
  hint?: string | undefined
}> {}
