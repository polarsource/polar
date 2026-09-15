import type { DeployEntry } from '../api/generated'
import { describePricePreview } from './preview'
import { aside, heavy, soft } from './style'

const MARKS: Record<DeployEntry['action'], string> = {
  create: '+',
  replace: '~',
  update: '~',
  unchanged: '=',
  orphan: '?',
}

const widthsOf = (rows: ReadonlyArray<ReadonlyArray<string>>) =>
  (rows[0] ?? []).map((_, column) =>
    Math.max(0, ...rows.map((row) => row[column]?.length ?? 0)),
  )

export const describeTarget = (
  name: string,
  slug: string,
  apiUrl: string,
  styled = false,
) => `${name} ${soft(`(${slug})`, styled)}  ${aside(apiUrl, styled)}`

export const describeSummary = (
  entries: ReadonlyArray<DeployEntry>,
  applied?: string,
  styled = false,
) => {
  const pending = entries.filter(
    (entry) => entry.action !== 'unchanged' && entry.action !== 'orphan',
  ).length
  const unchanged = entries.filter(
    (entry) => entry.action === 'unchanged',
  ).length
  const orphaned = entries.filter((entry) => entry.action === 'orphan').length
  const parts = [
    applied
      ? `applied ${pending} as deployment ${applied}`
      : pending
        ? `${pending} to apply`
        : 'nothing to apply',
  ]
  if (unchanged) parts.push(`${unchanged} unchanged`)
  if (orphaned) parts.push(`${orphaned} orphaned`)
  const text = parts.join(', ')
  if (!pending) return soft(text, styled)
  return applied ? text : heavy(text, styled)
}

/**
 * `origins` names the plugin behind a slug, so auto-added definitions read
 * as `via credits` rather than appearing from nowhere.
 */
export const describePlan = (
  entries: ReadonlyArray<DeployEntry>,
  styled = false,
  origins: ReadonlyMap<string, string> = new Map(),
): string => {
  const visible = entries.filter((entry) => entry.action !== 'unchanged')
  const rows = visible.map((entry) => {
    const origin = origins.get(entry.key)
    const reason = entry.reason?.replace(/ -> /g, ' → ') ?? ''
    return [
      MARKS[entry.action],
      entry.kind,
      entry.key,
      entry.action,
      origin ? [reason, `via ${origin}`].filter(Boolean).join('  ') : reason,
    ]
  })
  const widths = widthsOf(rows)
  const blocks = visible.map((entry, index) => {
    const [mark = '', kind = '', key = '', action = '', reason = ''] =
      rows[index] ?? []
    const orphan = entry.action === 'orphan'
    const line = [
      orphan ? aside(mark, styled) : heavy(mark, styled),
      soft(kind.padEnd(widths[1] ?? 0), styled),
      heavy(key.padEnd(widths[2] ?? 0), styled),
      soft(action.padEnd(widths[3] ?? 0), styled),
      aside(reason, styled),
    ]
      .join('  ')
      .trimEnd()
    const preview = entry.price_preview
      ? `\n${describePricePreview(entry.price_preview, styled)}\n`
      : ''
    return `${line}${preview}`
  })
  return blocks.join('\n')
}
