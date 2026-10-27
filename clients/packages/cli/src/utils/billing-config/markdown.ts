import type { ActiveOrganization } from '@/schemas/Auth'
import type {
  AppliedEntry,
  LoadedConfig,
  PlanResult,
} from '@/schemas/BillingConfig'
import { name } from '@/utils/billing-config/describe'
import {
  type Mark,
  fieldChanges,
  lineDiff,
  valueLines,
} from '@/utils/billing-config/entries'
import { formatProblems } from '@/utils/billing-config/problems'
import { errors, unchanged } from '@/utils/billing-config/review'
import { shownDiff } from '@/utils/billing-config/sentences'
import { documents } from '@/utils/billing-config/tree'

const HEADINGS: Record<string, string> = {
  settings: 'Settings',
  meters: 'Meters',
  benefits: 'Benefits',
  products: 'Products',
}

const heading = (section: string) => {
  const words = name(section).replaceAll('_', ' ')
  return (
    HEADINGS[section] ?? `${words.charAt(0).toUpperCase()}${words.slice(1)}`
  )
}

const isSet = (value: unknown) => value !== null && value !== undefined

const escape = (text: string) => text.replace(/[\\`*_[\]|<>]/g, '\\$&')

const plain = (text: string) =>
  Bun.stripANSI(text).replace(/^\n+/, '').trimEnd()

const codeBlock = (text: string, language = '') => {
  const fence = '`'.repeat(
    Math.max(3, ...Array.from(text.matchAll(/`+/g), ([run]) => run.length + 1)),
  )
  return `${fence}${language}\n${text}\n${fence}`
}

const single = (value: unknown) => valueLines(value).length === 1

const valueRows = (
  mark: Mark,
  width: number,
  field: string,
  value: unknown,
) => {
  const lines = valueLines(value)
  return lines.length === 1
    ? [`${mark}   ${field.padEnd(width)}  ${lines[0]}`]
    : [`${mark}   ${field}`, ...lines.map((line) => `${mark}     ${line}`)]
}

const entryLines = (
  { section, id, action, diff }: AppliedEntry,
  document: unknown,
) => {
  const created = action === 'created'
  const changes = fieldChanges(shownDiff(section, diff, document), section)
  const width = Math.max(
    0,
    ...changes
      .filter(({ before, after }) => single(before) && single(after))
      .map(({ field }) => field.length),
  )
  return [
    `${created ? '+' : ' '} ${name(id)}`,
    ...changes.flatMap(({ field, before, after }) =>
      created ||
      !isSet(before) ||
      !isSet(after) ||
      (single(before) && single(after))
        ? [
            ...(!created && isSet(before)
              ? valueRows('-', width, field, before)
              : []),
            ...(isSet(after) ? valueRows('+', width, field, after) : []),
          ]
        : [
            `    ${field}`,
            ...lineDiff(valueLines(before), valueLines(after)).map(
              ({ mark, line }) => `${mark}     ${line}`,
            ),
          ],
    ),
  ]
}

const callout = (
  config: LoadedConfig,
  organization: ActiveOrganization,
  result: PlanResult,
) => {
  const where = `**${escape(organization.name)}** in ${organization.environment}`
  if (errors(result.issues) > 0) {
    return `> [!CAUTION]\n> \`${config.file}\` can't be applied to ${where}. Fix the errors below first.`
  }
  return `> [!NOTE]\n> Applying the config in this pull request changes billing for ${where}. Review every change below before it's applied.`
}

const metadata = (
  config: LoadedConfig,
  organization: ActiveOrganization,
  { entries }: PlanResult,
) => {
  const count = (action: AppliedEntry['action']) =>
    entries.filter((entry) => entry.action === action).length
  return [
    '| Organization | Environment | Config | Changes |',
    '| --- | --- | --- | --- |',
    `| ${escape(organization.name)} | ${organization.environment} | \`${config.file}\` | ${count('updated')} to change, ${count('created')} to add, ${count('unchanged')} unchanged |`,
  ].join('\n')
}

export const planMarkdown = (
  config: LoadedConfig,
  organization: ActiveOrganization,
  result: PlanResult,
) =>
  unchanged(result.entries) && errors(result.issues) === 0
    ? undefined
    : [
        '## Polar billing plan updated',
        callout(config, organization, result),
        metadata(config, organization, result),
        ...[
          ...new Set([
            ...Object.keys(HEADINGS),
            ...result.entries.map(({ section }) => section),
          ]),
        ].flatMap((section) => {
          const webhooks = documents(config.input, 'webhooks')
          const changed = result.entries.filter(
            (entry) =>
              entry.section === section && entry.action !== 'unchanged',
          )
          return changed.length === 0
            ? []
            : [
                `#### ${escape(heading(section))}`,
                codeBlock(
                  plain(
                    changed
                      .flatMap((entry) =>
                        entryLines(entry, webhooks.get(name(entry.id))),
                      )
                      .join('\n'),
                  ),
                  'diff',
                ),
              ]
        }),
        ...(result.issues.length > 0
          ? [
              '#### Problems',
              codeBlock(plain(formatProblems(config, result.issues))),
            ]
          : []),
      ].join('\n\n')
