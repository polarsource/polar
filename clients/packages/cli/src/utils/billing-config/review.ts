import type { ActiveOrganization, PolarEnvironment } from '@/schemas/Auth'
import type {
  AppliedEntry,
  CatalogPlan,
  ConfigIssue,
  LoadedConfig,
  PlanDraft,
  PlanResult,
} from '@/schemas/BillingConfig'
import {
  conflictActions,
  conflictWarning,
} from '@/utils/billing-config/conflicts'
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

export const catalogChange = (
  { before, name }: CatalogPlan,
  dim: (text: string) => string = ui.dim,
) =>
  `${before === null ? dim('no live catalog') : `${before.name ?? dim('unnamed')} ${dim('(live)')}`} ${dim('→')} ${name} ${dim('(draft)')}`

export const fixErrors = (issues: ReadonlyArray<ConfigIssue>) =>
  `${ui.INDENT}Fix the ${errors(issues) === 1 ? 'error' : `${errors(issues)} errors`} above, then run ${ui.command('polar config validate')} again.`

export const runDraft = `${ui.INDENT}Run ${ui.command('polar config draft')} to save it to the draft.`

export const draftedChanges = (entries: ReadonlyArray<AppliedEntry>) =>
  entries.filter((entry) => entry.action !== 'unchanged')

const draftFact = (
  file: string,
  draft: PlanDraft,
  entries: ReadonlyArray<AppliedEntry>,
) => {
  const changes = draftedChanges(entries).length > 0
  if (draft.drift === null) return "There's an unpublished draft."
  if (draft.drift.length > 0)
    return 'The draft is missing some of these changes.'
  return changes
    ? 'These changes are saved in a draft.'
    : `The draft matches ${file}.`
}

export const draftNote = (
  file: string,
  draft: PlanDraft,
  entries: ReadonlyArray<AppliedEntry>,
) => [draftFact(file, draft, entries)]

const draftAction = (
  file: string,
  draft: PlanDraft,
  entries: ReadonlyArray<AppliedEntry>,
) => {
  const save = ui.command('polar config draft')
  const publish = ui.command('polar config publish')
  if (draft.conflicts.length > 0) return conflictActions(file)
  if (draft.drift?.length === 0) {
    return [
      `Run ${publish} to make ${draftedChanges(entries).length > 0 ? 'them' : 'it'} live.`,
    ]
  }
  if (draftedChanges(entries).length > 0) {
    return [`Run ${save}, then ${publish}.`]
  }
  return []
}

const indented = (lines: ReadonlyArray<string>) =>
  lines.map((line) => `${ui.INDENT}${line}`).join('\n')

export const draftNext = (
  file: string,
  draft: PlanDraft,
  entries: ReadonlyArray<AppliedEntry>,
) =>
  indented([
    ...(draft.conflicts.length > 0 ? [] : draftNote(file, draft, entries)),
    ...draftAction(file, draft, entries),
  ])

export const unchanged = (entries: ReadonlyArray<AppliedEntry>) =>
  entries.every((entry) => entry.action === 'unchanged')

export const target = (organization: ActiveOrganization) =>
  `${organization.name} (${organization.environment})`

export const NOUNS = [
  ['meters', 'meter'],
  ['custom_fields', 'custom field'],
  ['benefits', 'benefit'],
  ['products', 'product'],
] as const

export const counts = (input: unknown) => {
  const sections = record(input) ?? {}
  return NOUNS.flatMap(([section, noun]) => {
    const items = sections[section]
    return Array.isArray(items) && items.length > 0
      ? [plural(items.length, noun)]
      : []
  })
}

export const found = (config: LoadedConfig) => {
  const settings = record(record(config.input)?.['settings'])
  const all = [
    ...(settings && Object.keys(settings).length > 0 ? ['settings'] : []),
    ...counts(config.input),
  ]
  return all.length === 0 ? 'nothing to change' : all.join(', ')
}

const ENVIRONMENT_COLORS: Record<PolarEnvironment, (text: string) => string> = {
  production: ui.red,
  sandbox: ui.cyan,
  local: ui.dim,
}

export const section = (
  title: string,
  text: string,
  tint?: (text: string) => string,
) => [ui.blank, ui.heading(tint ? tint(title) : title), ui.box(text, tint)]

export const conflictSection = (
  config: LoadedConfig,
  conflicts: ReadonlyArray<AppliedEntry>,
  title = 'Conflict with the draft on Polar',
) => section(title, conflictWarning(config, conflicts), ui.yellow)

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
      ...(result.catalog
        ? [['Catalog', catalogChange(result.catalog)] as const]
        : []),
      ['Issues', issueTally(result.issues)],
    ]),
  )

export const next = (text: string) => section('Next', text)

export const conflictNext = (file: string) =>
  next(indented(conflictActions(file)))

export const nextOpen = () => [ui.blank, ui.heading('Next'), ui.boxTop()]
