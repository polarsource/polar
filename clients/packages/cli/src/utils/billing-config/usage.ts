import { extname } from 'node:path'
import type {
  AppliedEntry,
  ApplyResult,
  ConfigIssue,
  InitOutput,
  LoadedConfig,
  PlanCatalogs,
  PlanResult,
} from '@/schemas/BillingConfig'
import { record } from '@/utils/billing-config/describe'
import type { UsageDetails } from '@/utils/usage'

const ISSUE_CODE_LIMIT = 10

const sectionSize = (input: unknown, section: string) => {
  const entries = record(input)?.[section]
  return Array.isArray(entries) ? entries.length : 0
}

const countOf = (
  entries: ReadonlyArray<AppliedEntry>,
  action: AppliedEntry['action'],
) => entries.filter((entry) => entry.action === action).length

const formatOf = (file: string) => extname(file).slice(1) || 'json'

const fileUsage = ({ file, input }: LoadedConfig): UsageDetails => ({
  config_format: formatOf(file),
  config_meters: sectionSize(input, 'meters'),
  config_benefits: sectionSize(input, 'benefits'),
  config_products: sectionSize(input, 'products'),
})

const changeUsage = (entries: ReadonlyArray<AppliedEntry>): UsageDetails => ({
  config_created: countOf(entries, 'created'),
  config_updated: countOf(entries, 'updated'),
  config_removed: countOf(entries, 'removed'),
})

const issueUsage = (issues: ReadonlyArray<ConfigIssue>): UsageDetails => ({
  config_errors: issues.filter(({ severity }) => severity === 'error').length,
  config_warnings: issues.filter(({ severity }) => severity === 'warning')
    .length,
  config_issue_codes: [...new Set(issues.map(({ code }) => code))]
    .sort()
    .slice(0, ISSUE_CODE_LIMIT),
})

const draftState = (catalogs: PlanCatalogs | undefined) => {
  if (catalogs === undefined) return 'unknown'
  if (catalogs.draft === null) return 'none'
  if (catalogs.draft.drift === null) return 'uncompared'
  if (catalogs.draft.conflicts.length > 0) return 'conflict'
  return catalogs.draft.drift.length > 0 ? 'behind' : 'in_sync'
}

export const validateUsage = ({
  config,
  result,
  catalogs,
}: {
  config: LoadedConfig
  result: PlanResult
  catalogs: PlanCatalogs | undefined
}): UsageDetails => ({
  ...fileUsage(config),
  ...changeUsage(result.entries),
  ...issueUsage(result.issues),
  config_status: result.issues.some(({ severity }) => severity === 'error')
    ? 'invalid'
    : 'valid',
  config_draft: draftState(catalogs),
  config_conflicts: catalogs?.draft?.conflicts.length ?? 0,
  config_has_live: catalogs === undefined ? null : catalogs.live !== null,
})

const draftStatus = (result: ApplyResult, revertedDraft: boolean) => {
  if (result.status !== 'applied') return result.status
  if (revertedDraft) return 'reverted'
  const unchanged = result.entries.every(({ action }) => action === 'unchanged')
  return unchanged ? 'unchanged' : 'saved'
}

export const draftUsage = ({
  config,
  result,
  revertedDraft,
  conflicts,
}: {
  config: LoadedConfig
  result: ApplyResult
  revertedDraft: boolean
  conflicts: number
}): UsageDetails => ({
  ...fileUsage(config),
  ...changeUsage(result.status === 'applied' ? result.entries : []),
  ...issueUsage(result.status === 'conflict' ? [] : (result.issues ?? [])),
  config_status: draftStatus(result, revertedDraft),
  config_conflicts: conflicts,
})

export const publishUsage = ({
  published,
  drift,
}: {
  published: boolean
  drift: { entries: ReadonlyArray<AppliedEntry> } | null
}): UsageDetails => ({
  config_status: published ? 'published' : 'no_draft',
  config_unsaved_changes: drift === null ? null : drift.entries.length,
})

export const resetUsage = ({
  result,
}: {
  result: { file: string; source: string; status: string }
}): UsageDetails => ({
  config_format: formatOf(result.file),
  config_status: result.status,
  config_source: result.source,
})

export const generateUsage = (result: {
  config: string
  language: string
  status: string
}): UsageDetails => ({
  config_format: formatOf(result.config),
  config_status: result.status,
  config_language: result.language,
})

export const initUsage = (result: InitOutput): UsageDetails => {
  if (result.status === 'external_ids_required') {
    return {
      config_status: result.status,
      config_missing_external_ids: result.external_ids.length,
    }
  }
  return {
    config_format: result.format,
    config_meters: result.imported.meters,
    config_benefits: result.imported.benefits,
    config_products: result.imported.products,
    config_status: result.status,
    config_missing_external_ids: result.keyed.length,
    config_skipped: result.skipped.length,
    config_already_enabled: result.already_enabled,
    config_install: result.install?.status ?? 'none',
  }
}

export const pruneUsage = ({
  config,
  entries,
  removed,
}: {
  config: LoadedConfig
  entries: ReadonlyArray<unknown>
  removed: boolean
}): UsageDetails => ({
  ...fileUsage(config),
  config_status: removed ? 'removed' : 'nothing_removed',
  config_deprecated: entries.length,
})
