import type { ActiveOrganization, PolarEnvironment } from '@/schemas/Auth'
import type {
  AppliedEntry,
  ConfigIssue,
  LoadedConfig,
  PlanResult,
} from '@/schemas/BillingConfig'
import { record } from '@/utils/billing-config/describe'
import { planTally } from '@/utils/billing-config/entries'
import { formatProblems, plural } from '@/utils/billing-config/problems'
import { formatTree } from '@/utils/billing-config/tree'
import * as ui from '@/utils/ui'

export const errors = (issues: ReadonlyArray<ConfigIssue>) =>
  issues.filter((issue) => issue.severity === 'error').length

const warnings = (issues: ReadonlyArray<ConfigIssue>) =>
  issues.filter((issue) => issue.severity === 'warning').length

const issueTally = (issues: ReadonlyArray<ConfigIssue>) => {
  const parts = [
    ...(errors(issues) > 0 ? [ui.red(plural(errors(issues), 'error'))] : []),
    ...(warnings(issues) > 0
      ? [ui.yellow(plural(warnings(issues), 'warning'))]
      : []),
  ]
  return parts.length === 0 ? ui.dim('none') : parts.join(', ')
}

export const fixErrors = (issues: ReadonlyArray<ConfigIssue>) =>
  `${ui.INDENT}Fix the ${errors(issues) === 1 ? 'error' : `${errors(issues)} errors`} above, then run ${ui.command('polar config plan')} again.`

export const runApply = `${ui.INDENT}Run ${ui.command('polar config apply')} to apply it.`

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

const ENVIRONMENT_COLORS: Record<PolarEnvironment, (text: string) => string> = {
  production: ui.red,
  sandbox: ui.cyan,
  local: ui.dim,
}

export const section = (title: string, text: string) => [
  ui.blank,
  ui.heading(title),
  ui.box(text),
]

export const sections = (config: LoadedConfig, result: PlanResult) => [
  ...(result.entries.length > 0
    ? section('Changes', formatTree(config.input, result.entries))
    : []),
  ...(result.issues.length > 0
    ? section('Issues', formatProblems(config, result.issues))
    : []),
]

export const overview = (
  config: LoadedConfig,
  organization: ActiveOrganization,
  result: PlanResult,
) =>
  section(
    'Summary',
    ui.keyValue([
      ['Organization', organization.name],
      [
        'Environment',
        ENVIRONMENT_COLORS[organization.environment](organization.environment),
      ],
      ['File', config.file],
      ['Changes', planTally(result.entries)],
      ['Issues', issueTally(result.issues)],
    ]),
  )

export const next = (text: string) => section('Next', text)

export const nextOpen = () => [ui.blank, ui.heading('Next'), ui.boxTop()]
