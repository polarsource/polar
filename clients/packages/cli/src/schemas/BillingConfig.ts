import { Data, Schema } from 'effect'
import { ActiveOrganization } from '@/schemas/Auth'

export const NO_CONFIG_FILE =
  'No billing config file found in the current directory'

export const FORMATS = ['ts', 'json'] as const
export const Format = Schema.Literals(FORMATS)
export type Format = typeof Format.Type

export const CONFIG_FILES: Record<Format, ReadonlyArray<string>> = {
  ts: [
    'polar.config.ts',
    'polar.config.mts',
    'polar.config.cts',
    'polar.config.js',
    'polar.config.mjs',
    'polar.config.cjs',
  ],
  json: ['polar.config.json', 'polar.json'],
}

export const DEFAULT_CONFIG_FILES: ReadonlyArray<string> = FORMATS.flatMap(
  (format) => CONFIG_FILES[format],
)

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

const RemovalReason = Schema.Literals(['missing', 'deprecated'])
export type RemovalReason = typeof RemovalReason.Type

export const Removal = Schema.Struct({
  resource: ConfigResource,
  external_id: Schema.String,
  reason: RemovalReason,
})

export const Catalog = Schema.Struct({
  id: Schema.String,
  name: Schema.NullOr(Schema.String),
})
export type Catalog = typeof Catalog.Type

export const ApplyResponse = Schema.Struct({
  changes: Schema.Array(EntryResult),
  removed: Schema.optional(Schema.Array(Removal)),
  catalog: Schema.optional(Schema.NullOr(Schema.Struct({ after: Catalog }))),
  settings: Schema.optional(Schema.NullOr(SettingsResult)),
})

export const CatalogList = Schema.Struct({
  items: Schema.Array(
    Schema.Struct({
      ...Catalog.fields,
      status: Schema.Literals(['draft', 'live', 'archived']),
    }),
  ),
})

export const AppliedEntry = Schema.Struct({
  section: Schema.String,
  id: Schema.String,
  action: Schema.Literals([...EntryAction.literals, 'removed']),
  reason: Schema.optionalKey(RemovalReason),
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
  removed: Schema.optional(Schema.Array(Removal)),
  catalog: Schema.optional(Schema.NullOr(CatalogPlan)),
  settings: Schema.optional(Schema.NullOr(SettingsResult)),
  issues: Schema.Array(ServerError),
})

export const PruneEntry = Schema.Struct({
  resource: ConfigResource,
  external_id: Schema.String,
  customers_count: Schema.Number,
  referenced_by: Schema.Array(
    Schema.Struct({ resource: ConfigResource, external_id: Schema.String }),
  ),
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
  suggestion: Schema.optional(Schema.String),
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
    draft: Schema.optionalKey(Catalog),
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

export const Catalogs = Schema.Struct({
  live: Schema.NullOr(Catalog),
  draft: Schema.NullOr(Catalog),
})
export type Catalogs = typeof Catalogs.Type

export const PublishOutput = Schema.Struct({
  ...Catalogs.fields,
  published: Schema.Boolean,
  drift: Schema.NullOr(Schema.Array(AppliedEntry)),
})

export const ConfigDocument = Schema.Record(
  Schema.String,
  Schema.Union([
    Schema.Array(Schema.Unknown),
    Schema.Record(Schema.String, Schema.Unknown),
  ]),
)
export type ConfigDocument = typeof ConfigDocument.Type

export const KeyedResource = Schema.Literals(['meter', 'benefit', 'product'])
export type KeyedResource = typeof KeyedResource.Type

export const SkippedResource = Schema.Struct({
  resource: Schema.String,
  id: Schema.String,
  name: Schema.String,
  reason: Schema.String,
  recurring_interval: Schema.optionalKey(Schema.NullOr(Schema.String)),
  recurring_interval_count: Schema.optionalKey(Schema.NullOr(Schema.Number)),
})
export type SkippedResource = typeof SkippedResource.Type

export const ConfigExport = Schema.Struct({
  enabled: Schema.Boolean,
  config: ConfigDocument,
  skipped: Schema.Array(SkippedResource),
})
export type ConfigExport = typeof ConfigExport.Type

export const ExternalIdAssignment = Schema.Struct({
  resource: KeyedResource,
  id: Schema.String,
  name: Schema.String,
  external_id: Schema.String,
})
export type ExternalIdAssignment = typeof ExternalIdAssignment.Type

export const InitResult = Schema.Struct({
  file: Schema.String,
  format: Format,
  imported: Schema.Struct({
    meters: Schema.Finite,
    benefits: Schema.Finite,
    products: Schema.Finite,
  }),
  keyed: Schema.Array(ExternalIdAssignment),
  skipped: Schema.Array(SkippedResource),
  already_enabled: Schema.Boolean,
  install: Schema.optionalKey(
    Schema.Struct({
      command: Schema.String,
      status: Schema.Literals(['installed', 'failed', 'skipped']),
    }),
  ),
})
export type InitResult = typeof InitResult.Type

export const InitWritten = Schema.Struct({
  status: Schema.Literal('written'),
  ...InitResult.fields,
  organization: ActiveOrganization,
  org: Schema.optionalKey(Schema.String),
  caller: Schema.optionalKey(Schema.String),
  agents: Schema.optionalKey(
    Schema.Struct({
      names: Schema.Array(Schema.String),
      ready: Schema.Boolean,
    }),
  ),
  next: Schema.Array(Schema.String),
})
export type InitWritten = typeof InitWritten.Type

export const InitRequired = Schema.Struct({
  status: Schema.Literal('external_ids_required'),
  organization: ActiveOrganization,
  external_ids: Schema.Array(ExternalIdAssignment),
  next: Schema.Array(Schema.String),
})
export type InitRequired = typeof InitRequired.Type

export const InitOutput = Schema.Union([InitWritten, InitRequired])
export type InitOutput = typeof InitOutput.Type

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
