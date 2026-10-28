import type { ActiveOrganization } from '@/schemas/Auth'
import type {
  AppliedEntry,
  ConfigIssue,
  LoadedConfig,
  PlanResult,
} from '@/schemas/BillingConfig'
import { record } from '@/utils/billing-config/describe'
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

export const NOUNS = [
  ['meters', 'meter'],
  ['benefits', 'benefit'],
  ['products', 'product'],
  ['webhooks', 'webhook'],
] as const

export const found = (config: LoadedConfig) => {
  const sections = record(config.input) ?? {}
  const counts = NOUNS.flatMap(([section, noun]) => {
    const items = sections[section]
    return Array.isArray(items) && items.length > 0
      ? [plural(items.length, noun)]
      : []
  })
  const settings = record(sections['settings'])
  const all = [
    ...(settings && Object.keys(settings).length > 0 ? ['settings'] : []),
    ...counts,
  ]
  return all.length === 0 ? 'nothing to apply' : all.join(', ')
}

const gutter = (text: string) =>
  text
    .split('\n')
    .map((line) =>
      line === ''
        ? `${ui.INDENT}${ui.dim('│')}`
        : `${ui.INDENT}${ui.dim('│')} ${line.slice(ui.INDENT.length)}`,
    )
    .join('\n')

export const box = (title: string, text: string) =>
  [
    `${ui.INDENT}${ui.dim('╭─')} ${title}`,
    `${ui.INDENT}${ui.dim('│')}`,
    gutter(text),
    `${ui.INDENT}${ui.dim('│')}`,
    `${ui.INDENT}${ui.dim('╰─')}`,
  ].join('\n')

export const changes = (
  config: LoadedConfig,
  organization: ActiveOrganization,
  result: PlanResult,
) => [
  ...(result.entries.length > 0
    ? [
        ui.blank,
        box(
          `Changes ${ui.dim(target(organization))}`,
          formatTree(config.input, result.entries),
        ),
      ]
    : []),
  ...(result.issues.length > 0
    ? [ui.blank, formatProblems(config, result.issues)]
    : []),
]
