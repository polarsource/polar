import { Data, Schema } from 'effect'

export const IssueSeverity = Schema.Literals(['error', 'warning'])

const ServerPath = Schema.Array(Schema.Union([Schema.String, Schema.Finite]))

export const ServerError = Schema.Struct({
  severity: Schema.optionalKey(IssueSeverity),
  type: Schema.String,
  loc: ServerPath,
  msg: Schema.String,
  input: Schema.optional(Schema.Unknown),
  ctx: Schema.optionalKey(Schema.Record(Schema.String, Schema.Unknown)),
})

export const ApiError = Schema.Struct({ error: Schema.String })

export const ValidationErrors = Schema.Struct({
  detail: Schema.Array(ServerError),
})

export const EntryAction = Schema.Literals(['created', 'updated', 'unchanged'])

export const FieldChange = Schema.Struct({
  field: Schema.String,
  before: Schema.optional(Schema.Unknown),
  after: Schema.optional(Schema.Unknown),
})

export const EntryResult = Schema.Struct({
  external_id: Schema.optional(Schema.String),
  action: EntryAction,
  diff: Schema.optional(Schema.Array(FieldChange)),
})

export const ApplyResponse = Schema.Record(
  Schema.String,
  Schema.Union([EntryResult, Schema.Array(EntryResult)]),
)

export interface AppliedEntry {
  readonly section: string
  readonly id: string
  readonly action: typeof EntryAction.Type
  readonly diff: ReadonlyArray<typeof FieldChange.Type>
}

export const PlanResponse = Schema.Struct({
  changes: Schema.Array(EntryResult),
  issues: Schema.Array(ServerError),
})

export interface PlanResult {
  readonly entries: ReadonlyArray<AppliedEntry>
  readonly issues: ReadonlyArray<ConfigIssue>
}

export type ApplyResult =
  | {
      readonly status: 'applied'
      readonly entries: ReadonlyArray<AppliedEntry>
    }
  | { readonly status: 'rejected'; readonly issues: ReadonlyArray<ConfigIssue> }

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

export class BillingConfigError extends Data.TaggedError('BillingConfigError')<{
  message: string
  hint?: string | undefined
}> {}
