import type { ActiveOrganization } from '@/schemas/Auth'
import type {
  AppliedEntry,
  ConfigIssue,
  LoadedConfig,
  PlanResult,
} from '@/schemas/BillingConfig'
import { formatProblems, plural } from '@/utils/billing-config/problems'
import { formatTree } from '@/utils/billing-config/tree'
import * as ui from '@/utils/ui'

export const errors = (issues: ReadonlyArray<ConfigIssue>) =>
  issues.filter((issue) => issue.severity === 'error').length

const warnings = (issues: ReadonlyArray<ConfigIssue>) =>
  issues.filter((issue) => issue.severity === 'warning').length

export const summary = (issues: ReadonlyArray<ConfigIssue>) =>
  `${ui.INDENT}Found ${plural(errors(issues), 'error')} and ${plural(warnings(issues), 'warning')}.`

export const unchanged = (entries: ReadonlyArray<AppliedEntry>) =>
  entries.every((entry) => entry.action === 'unchanged')

export const target = (organization: ActiveOrganization) =>
  `${organization.name} (${organization.environment})`

export const changes = (config: LoadedConfig, result: PlanResult) => [
  ...(result.entries.length > 0
    ? [ui.blank, formatTree(config.input, result.entries)]
    : []),
  ...(result.issues.length > 0
    ? [ui.blank, formatProblems(config, result.issues)]
    : []),
]
