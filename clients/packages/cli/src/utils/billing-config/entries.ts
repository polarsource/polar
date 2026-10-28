import type { AppliedEntry } from '@/schemas/BillingConfig'
import {
  Rendered,
  describeValue,
  name,
  priceGroups,
} from '@/utils/billing-config/describe'
import { recurrence } from '@/utils/billing-config/sentences'
import * as ui from '@/utils/ui'

type Action = AppliedEntry['action']
type Change = AppliedEntry['diff'][number]
type Color = (text: string) => string

export const MARKS: Record<Action, string> = {
  created: ui.green('+'),
  updated: ui.yellow('~'),
  unchanged: ui.dim('='),
}

const INLINE_LIMIT = 40

const describe = (input: unknown) => {
  if (input === undefined || input === null) return undefined
  const readable = describeValue(input)
  if (readable !== undefined) return readable
  if (typeof input !== 'object') return JSON.stringify(input)
  const inline = JSON.stringify(input)
  return inline.length <= INLINE_LIMIT ? inline : JSON.stringify(input, null, 2)
}

export const valueLines = (input: unknown) =>
  (describe(input) ?? 'unset').split('\n')

const isInline = (input: unknown) => valueLines(input).length === 1

const paint = (input: unknown, color: Color) =>
  input === undefined || input === null
    ? ui.dim('unset')
    : color(valueLines(input)[0] ?? '')

const row = (
  indent: string,
  label: string,
  width: number,
  first: string,
  rest: string[] = [],
) => [
  `${indent}${ui.dim(label.padEnd(width))}  ${first}`,
  ...rest.map((line) => `${indent}${' '.repeat(width + 2)}${line}`),
]

export type Mark = ' ' | '-' | '+'

const sharedPrefix = (
  before: ReadonlyArray<string>,
  after: ReadonlyArray<string>,
) => {
  const index = before.findIndex((line, i) => line !== after[i])
  return Math.min(index === -1 ? before.length : index, after.length)
}

const marked = (mark: Mark, lines: ReadonlyArray<string>) =>
  lines.map((line) => ({ mark, line }))

export const lineDiff = (
  before: ReadonlyArray<string>,
  after: ReadonlyArray<string>,
) => {
  const start = sharedPrefix(before, after)
  const end = sharedPrefix(
    before.slice(start).toReversed(),
    after.slice(start).toReversed(),
  )
  return [
    ...marked(' ', before.slice(0, start)),
    ...marked('-', before.slice(start, before.length - end)),
    ...marked('+', after.slice(start, after.length - end)),
    ...marked(' ', before.slice(before.length - end)),
  ]
}

const MARK_COLORS: Record<Mark, Color> = {
  ' ': (text) => text,
  '-': ui.red,
  '+': ui.green,
}

const formatChange = (
  indent: string,
  change: Change,
  action: Action,
  width: number,
) => {
  if (action === 'created') {
    const [first = '', ...rest] = valueLines(change.after).map(ui.green)
    return row(indent, change.field, width, first, rest)
  }
  const inline = `${paint(change.before, ui.red)} ${ui.dim('→')} ${paint(change.after, ui.green)}`
  const fits =
    indent.length + width + 2 + Bun.stringWidth(inline) <= ui.boxInner()
  if (isInline(change.before) && isInline(change.after) && fits) {
    return row(indent, change.field, width, inline)
  }
  return [
    `${indent}${ui.dim(change.field)}`,
    ...lineDiff(valueLines(change.before), valueLines(change.after)).map(
      ({ mark, line }) =>
        `${indent}${ui.INDENT}${MARK_COLORS[mark](`${mark} ${line}`)}`,
    ),
  ]
}

const expand = (change: Change): Change[] => {
  const before = priceGroups(change.before)
  const after = priceGroups(change.after)
  if (before === undefined && after === undefined) return [change]
  const labels = [
    ...new Set([...(before ?? []), ...(after ?? [])].map(({ label }) => label)),
  ]
  return labels.flatMap((label) => {
    const was = before?.find((group) => group.label === label)?.text
    const is = after?.find((group) => group.label === label)?.text
    return was?.text === is?.text
      ? []
      : [{ field: `${change.field} (${label})`, before: was, after: is }]
  })
}

const mergeRecurrence = (diff: ReadonlyArray<Change>): Change[] => {
  const interval = diff.find((change) => change.field === 'recurring_interval')
  const count = diff.find(
    (change) => change.field === 'recurring_interval_count',
  )
  if (interval === undefined || count === undefined) return [...diff]
  const merged: Change = {
    field: 'recurrence',
    before: new Rendered(recurrence(interval.before, count.before)),
    after: new Rendered(recurrence(interval.after, count.after)),
  }
  return diff.flatMap((change) =>
    change === interval ? [merged] : change === count ? [] : [change],
  )
}

const SETTING_VALUES: Record<string, (value: string) => string> = {
  currency: (value) => value.toUpperCase(),
  tax: (value) => value,
}

const settingValue = (field: string, value: unknown) =>
  typeof value === 'string' && SETTING_VALUES[field]
    ? new Rendered(SETTING_VALUES[field](value))
    : value

const renderSetting = (change: Change): Change => ({
  ...change,
  before: settingValue(change.field, change.before),
  after: settingValue(change.field, change.after),
})

export const fieldChanges = (diff: ReadonlyArray<Change>, section?: string) =>
  mergeRecurrence(diff)
    .map((change) => (section === 'settings' ? renderSetting(change) : change))
    .flatMap(expand)
    .map((change) => ({ ...change, field: name(change.field) }))

export const formatRows = (
  indent: string,
  diff: ReadonlyArray<Change>,
  action: Action,
  section?: string,
) => {
  const changes = fieldChanges(diff, section)
  const width = Math.max(0, ...changes.map((change) => change.field.length))
  return changes.flatMap((change) =>
    formatChange(indent, change, action, width),
  )
}

type Labels = Record<Action, string>

const DONE: Labels = {
  created: 'created',
  updated: 'updated',
  unchanged: 'unchanged',
}

const COLORS: Record<Action, Color> = {
  created: ui.green,
  updated: ui.yellow,
  unchanged: ui.dim,
}

const count = (entries: ReadonlyArray<AppliedEntry>, action: Action) =>
  entries.filter((entry) => entry.action === action).length

const counted = (
  entries: ReadonlyArray<AppliedEntry>,
  action: Action,
  label: string,
) => {
  const total = count(entries, action)
  return (total === 0 ? ui.dim : COLORS[action])(`${total} ${label}`)
}

export const tally = (entries: ReadonlyArray<AppliedEntry>) =>
  (['created', 'updated', 'unchanged'] as const)
    .map((action) => counted(entries, action, DONE[action]))
    .join(', ')

export const changeCount = (entries: ReadonlyArray<AppliedEntry>) =>
  count(entries, 'created') + count(entries, 'updated')

export const planTally = (entries: ReadonlyArray<AppliedEntry>) =>
  [
    counted(entries, 'updated', 'to change'),
    counted(entries, 'created', 'to add'),
    counted(entries, 'unchanged', 'unchanged'),
  ].join(', ')

export const planSummary = (entries: ReadonlyArray<AppliedEntry>) =>
  `${ui.INDENT}${ui.dim('Plan:')} ${planTally(entries)}`
