import { Data, Schema } from 'effect'

export const DEFAULT_CONFIG_FILES = [
  'polar.config.ts',
  'polar.config.mts',
  'polar.config.cts',
  'polar.config.js',
  'polar.config.mjs',
  'polar.config.cjs',
  'polar.config.json',
  'polar.json',
] as const

const IssueSeverity = Schema.Literals(['error', 'warning'])

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

const EntryAction = Schema.Literals(['created', 'updated', 'unchanged'])

const FieldChange = Schema.Struct({
  field: Schema.String,
  before: Schema.optional(Schema.Unknown),
  after: Schema.optional(Schema.Unknown),
})
type FieldChange = typeof FieldChange.Type

export const ConfigResource = Schema.Literals([
  'meter',
  'benefit',
  'product',
  'webhook',
])

export const EntryResult = Schema.Struct({
  resource: ConfigResource,
  external_id: Schema.String,
  action: EntryAction,
  diff: Schema.optional(Schema.Array(FieldChange)),
})

export const SettingsResult = Schema.Struct({
  action: EntryAction,
  diff: Schema.optional(Schema.Array(FieldChange)),
})

export const ApplyResponse = Schema.Struct({
  changes: Schema.Array(EntryResult),
  settings: Schema.optional(Schema.NullOr(SettingsResult)),
})

export const AppliedEntry = Schema.Struct({
  section: Schema.String,
  id: Schema.String,
  action: EntryAction,
  diff: Schema.Array(FieldChange),
})
export type AppliedEntry = typeof AppliedEntry.Type

export const CatalogPlan = Schema.Struct({
  before: Schema.NullOr(Schema.Struct({ name: Schema.NullOr(Schema.String) })),
  name: Schema.String,
})
export type CatalogPlan = typeof CatalogPlan.Type

export const PlanResponse = Schema.Struct({
  changes: Schema.Array(EntryResult),
  catalog: Schema.optional(Schema.NullOr(CatalogPlan)),
  settings: Schema.optional(Schema.NullOr(SettingsResult)),
  issues: Schema.Array(ServerError),
})

export const PruneEntry = Schema.Struct({
  resource: ConfigResource,
  external_id: Schema.String,
  in_use: Schema.Boolean,
  referenced_by: Schema.Array(Schema.String),
})
export type PruneEntry = typeof PruneEntry.Type

export const PruneResponse = Schema.Struct({
  entries: Schema.Array(PruneEntry),
})

export const PruneOutput = Schema.Struct({
  file: Schema.String,
  entries: Schema.Array(PruneEntry),
  removed: Schema.Boolean,
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
  catalog: Schema.optionalKey(CatalogPlan),
  issues: Schema.Array(ConfigIssue),
})
export type PlanResult = typeof PlanResult.Type

export const ApplyResult = Schema.Union([
  Schema.Struct({
    status: Schema.Literal('applied'),
    entries: Schema.Array(AppliedEntry),
    issues: Schema.optionalKey(Schema.Array(ConfigIssue)),
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
