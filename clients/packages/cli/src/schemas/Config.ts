import { Data, Schema } from 'effect'
import { ValidationIssue } from '@/schemas/Validation'

export const IssueSeverity = Schema.Literals(['error', 'warning'])

export const RequestValidationIssue = Schema.Struct({
  ...ValidationIssue.fields,
  type: Schema.String,
  input: Schema.optional(Schema.Unknown),
})

export const ServerIssue = Schema.Struct({
  ...RequestValidationIssue.fields,
  severity: IssueSeverity,
})

export const ApiError = Schema.Struct({ error: Schema.String })

export const ConfigValidation = Schema.Struct({
  issues: Schema.Array(ServerIssue),
})

export const RequestValidationError = Schema.Struct({
  detail: Schema.Array(RequestValidationIssue),
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
