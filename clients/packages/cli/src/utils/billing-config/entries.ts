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

const lines = (input: unknown) => (describe(input) ?? 'unset').split('\n')

const isInline = (input: unknown) => lines(input).length === 1

const paint = (input: unknown, color: Color) =>
  input === undefined || input === null
    ? ui.dim('unset')
    : color(lines(input)[0] ?? '')

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

const block = (indent: string, input: unknown, prefix: string, color: Color) =>
  lines(input).map(
    (line, index) =>
      `${indent}${ui.INDENT}${color(`${index === 0 ? prefix : ' '.repeat(prefix.length)}${line}`)}`,
  )

const formatChange = (
  indent: string,
  change: Change,
  action: Action,
  width: number,
) => {
  if (action === 'created') {
    const [first = '', ...rest] = lines(change.after).map(ui.green)
    return row(indent, change.field, width, first, rest)
  }
  if (isInline(change.before) && isInline(change.after)) {
    return row(
      indent,
      change.field,
      width,
      `${paint(change.before, ui.red)} ${ui.dim('→')} ${paint(change.after, ui.green)}`,
    )
  }
  return [
    `${indent}${ui.dim(change.field)}`,
    ...block(indent, change.before, '- ', ui.red),
    ...block(indent, change.after, '+ ', ui.green),
  ]
}

const expand = (change: Change): Change[] => {
  const before = priceGroups(change.before)
  const after = priceGroups(change.after)
  if (before === undefined && after === undefined) return [change]
  const labels = [
    ...new Set([...(before ?? []), ...(after ?? [])].map(({ label }) => label)),
  ]
  return labels.map((label) => ({
    field: `${change.field} (${label})`,
    before: before?.find((group) => group.label === label)?.text,
    after: after?.find((group) => group.label === label)?.text,
  }))
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

export const formatRows = (
  indent: string,
  diff: ReadonlyArray<Change>,
  action: Action,
) => {
  const changes = mergeRecurrence(diff)
    .flatMap(expand)
    .map((change) => ({ ...change, field: name(change.field) }))
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

export const TO_DO: Labels = {
  created: 'to create',
  updated: 'to update',
  unchanged: 'unchanged',
}

const COLORS: Record<Action, Color> = {
  created: ui.green,
  updated: ui.yellow,
  unchanged: ui.dim,
}

export const tally = (
  entries: ReadonlyArray<AppliedEntry>,
  labels: Labels = DONE,
) =>
  (['created', 'updated', 'unchanged'] as const)
    .map((action) =>
      COLORS[action](
        `${entries.filter((entry) => entry.action === action).length} ${labels[action]}`,
      ),
    )
    .join(', ')
