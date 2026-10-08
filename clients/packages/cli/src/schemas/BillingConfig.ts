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

export const AppliedEntry = Schema.Struct({
  section: Schema.String,
  id: Schema.String,
  action: EntryAction,
  diff: Schema.Array(FieldChange),
})
export type AppliedEntry = typeof AppliedEntry.Type

export const PlanResponse = Schema.Struct({
  changes: Schema.Array(EntryResult),
  issues: Schema.Array(ServerError),
})

export const SourceLocation = Schema.Struct({
  line: Schema.Finite,
  column: Schema.Finite,
  length: Schema.Finite,
})
export type SourceLocation = typeof SourceLocation.Type

export const ConfigIssue = Schema.Struct({
  severity: IssueSeverity,
  code: Schema.String,
  path: Schema.String,
  message: Schema.String,
  got: Schema.optional(Schema.String),
  location: Schema.optional(SourceLocation),
})
export type ConfigIssue = typeof ConfigIssue.Type

export const PlanResult = Schema.Struct({
  entries: Schema.Array(AppliedEntry),
  issues: Schema.Array(ConfigIssue),
})
export type PlanResult = typeof PlanResult.Type

export const ApplyResult = Schema.Union([
  Schema.Struct({
    status: Schema.Literal('applied'),
    entries: Schema.Array(AppliedEntry),
  }),
  Schema.Struct({
    status: Schema.Literal('rejected'),
    issues: Schema.Array(ConfigIssue),
  }),
])
export type ApplyResult = typeof ApplyResult.Type

export const PlanOutput = Schema.Struct({
  file: Schema.String,
  ...PlanResult.fields,
})

export const ApplyOutput = Schema.Union(
  ApplyResult.members.map((member) =>
    Schema.Struct({ file: Schema.String, ...member.fields }),
  ),
)

export const SkippedMeter = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  reason: Schema.String,
})
export type SkippedMeter = typeof SkippedMeter.Type

export const PulledConfig = Schema.Struct({
  meters: Schema.Array(Schema.Record(Schema.String, Schema.Unknown)),
})
export type PulledConfig = typeof PulledConfig.Type

export const PullResponse = Schema.Struct({
  config: PulledConfig,
  skipped: Schema.Array(SkippedMeter),
})
export type PullResponse = typeof PullResponse.Type

export const SaveStatus = Schema.Literals(['written', 'unchanged'])
export type SaveStatus = typeof SaveStatus.Type

export const PullOutput = Schema.Struct({
  file: Schema.String,
  status: SaveStatus,
  ...PullResponse.fields,
})

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
