import { describeValue } from '@/utils/billing-config/describe'
import type { AppliedEntry } from '@/schemas/BillingConfig'
import * as ui from '@/utils/ui'

const MARKS: Record<AppliedEntry['action'], string> = {
  created: ui.green('+'),
  updated: ui.yellow('~'),
  unchanged: ui.dim('='),
}

const bySection = (entries: ReadonlyArray<AppliedEntry>) =>
  [...new Set(entries.map((entry) => entry.section))].map((section) => ({
    section,
    entries: entries.filter((entry) => entry.section === section),
  }))

type Labels = Record<AppliedEntry['action'], string>

export const DONE: Labels = {
  created: 'created',
  updated: 'updated',
  unchanged: 'unchanged',
}

export const PLANNED: Labels = {
  created: 'will be created',
  updated: 'will be updated',
  unchanged: 'unchanged',
}

const DIFF_INDENT = ui.INDENT.repeat(4)
const INLINE_LIMIT = 40

type Color = (text: string) => string

const describe = (input: unknown) => {
  if (input === undefined || input === null) return undefined
  const readable = describeValue(input)
  if (readable !== undefined) return readable
  if (typeof input !== 'object') return JSON.stringify(input)
  const inline = JSON.stringify(input)
  return inline.length <= INLINE_LIMIT ? inline : JSON.stringify(input, null, 2)
}

const lines = (input: unknown) => (describe(input) ?? 'unset').split('\n')

const isInline = (input: unknown) => lines(input).length === 1

const paint = (input: unknown, color: Color) =>
  input === undefined || input === null
    ? ui.dim('unset')
    : color(lines(input)[0] ?? '')

const row = (
  label: string,
  width: number,
  first: string,
  rest: string[] = [],
) => [
  `${DIFF_INDENT}${ui.dim(label.padEnd(width))}  ${first}`,
  ...rest.map((line) => `${DIFF_INDENT}${' '.repeat(width + 2)}${line}`),
]

const block = (input: unknown, prefix: string, color: Color) =>
  lines(input).map(
    (line, index) =>
      `${DIFF_INDENT}${ui.INDENT}${color(`${index === 0 ? prefix : ' '.repeat(prefix.length)}${line}`)}`,
  )

const formatChange = (
  change: AppliedEntry['diff'][number],
  action: AppliedEntry['action'],
  width: number,
) => {
  if (action === 'created') {
    const [first = '', ...rest] = lines(change.after).map(ui.green)
    return row(change.field, width, first, rest)
  }
  if (isInline(change.before) && isInline(change.after)) {
    return row(
      change.field,
      width,
      `${paint(change.before, ui.red)} ${ui.dim('→')} ${paint(change.after, ui.green)}`,
    )
  }
  return [
    `${DIFF_INDENT}${ui.dim(change.field)}`,
    ...block(change.before, '- ', ui.red),
    ...block(change.after, '+ ', ui.green),
  ]
}

const formatDiff = (entry: AppliedEntry, width: number) =>
  entry.diff.flatMap((change) => formatChange(change, entry.action, width))

const name = (input: string) => ui.printable(input).replace(/\s+/g, ' ').trim()

const sanitize = (entry: AppliedEntry): AppliedEntry => ({
  ...entry,
  id: name(entry.id),
  diff: entry.diff.map((change) => ({ ...change, field: name(change.field) })),
})

export const formatEntries = (
  raw: ReadonlyArray<AppliedEntry>,
  labels: Labels = DONE,
) => {
  const entries = raw.map(sanitize)
  const width = Math.max(...entries.map((entry) => entry.id.length))
  const fieldWidth = Math.max(
    width - ui.INDENT.length,
    ...entries.flatMap((entry) =>
      entry.diff.map((change) => change.field.length),
    ),
  )
  return bySection(entries)
    .map(({ section, entries }) =>
      [
        `${ui.INDENT}${ui.bold(section)}`,
        ...entries.flatMap((entry) => [
          `${ui.INDENT}${ui.INDENT}${MARKS[entry.action]} ${entry.id.padEnd(width)}  ${ui.dim(labels[entry.action])}`,
          ...formatDiff(entry, fieldWidth),
        ]),
      ].join('\n'),
    )
    .join('\n\n')
}

export const tally = (entries: ReadonlyArray<AppliedEntry>) =>
  (['created', 'updated', 'unchanged'] as const)
    .map(
      (action) =>
        `${entries.filter((entry) => entry.action === action).length} ${action}`,
    )
    .join(', ')
