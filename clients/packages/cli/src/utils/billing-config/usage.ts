import { extname } from 'node:path'
import type {
  ApplyResult,
  ConfigIssue,
  InitOutput,
  LoadedConfig,
  PlanCatalogs,
  PlanResult,
} from '@/schemas/BillingConfig'
import type { UsageDetails } from '@/utils/usage'

const ISSUE_CODE_LIMIT = 10

const formatOf = (file: string) => extname(file).slice(1) || 'json'

const issueCodes = (issues: ReadonlyArray<ConfigIssue>) =>
  [...new Set(issues.map(({ code }) => code))].sort().slice(0, ISSUE_CODE_LIMIT)

export const validateUsage = ({
  config,
  result,
  catalogs,
}: {
  config: LoadedConfig
  result: PlanResult
  catalogs: PlanCatalogs | undefined
}): UsageDetails => ({
  config_format: formatOf(config.file),
  config_status: result.issues.some(({ severity }) => severity === 'error')
    ? 'invalid'
    : 'valid',
  config_issue_codes: issueCodes(result.issues),
  config_conflicts: catalogs?.draft?.conflicts.length ?? 0,
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
  config_format: formatOf(config.file),
  config_status: draftStatus(result, revertedDraft),
  config_issue_codes: issueCodes(
    result.status === 'conflict' ? [] : (result.issues ?? []),
  ),
  config_conflicts: conflicts,
})

export const publishUsage = ({
  published,
}: {
  published: boolean
}): UsageDetails => ({
  config_status: published ? 'published' : 'no_draft',
})

export const fileStatusUsage = (
  file: string,
  status: string,
): UsageDetails => ({
  config_format: formatOf(file),
  config_status: status,
})

export const initUsage = (result: InitOutput): UsageDetails =>
  result.status === 'written'
    ? { config_format: result.format, config_status: result.status }
    : { config_status: result.status }
