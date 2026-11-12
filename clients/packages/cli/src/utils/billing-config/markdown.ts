import type { ActiveOrganization } from '@/schemas/Auth'
import type {
  AppliedEntry,
  LoadedConfig,
  PlanResult,
} from '@/schemas/BillingConfig'
import { isSet, name } from '@/utils/billing-config/describe'
import {
  type Mark,
  fieldChanges,
  lineDiff,
  updatedIds,
  valueLines,
} from '@/utils/billing-config/entries'
import { formatProblems } from '@/utils/billing-config/problems'
import { catalogChange, errors, unchanged } from '@/utils/billing-config/review'
import { shownDiff, usedMeters } from '@/utils/billing-config/sentences'
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

const ids = (input: unknown): string[] =>
  Array.isArray(input) ? input.map((id) => name(id)) : []

const entryLines = (
  entry: AppliedEntry,
  document: unknown,
  updated: { benefits: ReadonlySet<string>; meters: ReadonlySet<string> },
) => {
  const { section, id, action, diff } = entry
  const created = action === 'created'
  const benefits = diff.find(({ field }) => field === 'benefits')
  const grantedBefore = ids(benefits?.before)
  const granted = ids(benefits?.after)
  const regranted = granted.filter(
    (id) => grantedBefore.includes(id) && updated.benefits.has(id),
  )
  // A product granting an updated benefit lists the same ids before and after
  const sameIds =
    grantedBefore.length === granted.length &&
    granted.every((id) => grantedBefore.includes(id))
  const changes = fieldChanges(
    shownDiff(
      section,
      sameIds ? diff.filter(({ field }) => field !== 'benefits') : diff,
      document,
    ),
    section,
  )
  const width = Math.max(
    0,
    ...changes
      .filter(({ before, after }) => single(before) && single(after))
      .map(({ field }) => field.length),
  )
  return [
    `${created ? '+' : action === 'removed' ? '-' : ' '} ${name(id)}`,
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
    ...usedMeters(entry, 'after')
      .filter((id) => updated.meters.has(id))
      .map((id) => `    meter  ${id} (updated)`),
    ...regranted.map((id) => `    benefits  ${id} (updated)`),
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
  { entries, catalog }: PlanResult,
) => {
  const count = (action: AppliedEntry['action']) =>
    entries.filter((entry) => entry.action === action).length
  const columns = [
    ['Organization', escape(organization.name)],
    ['Environment', organization.environment],
    ['Config', `\`${config.file}\``],
    [
      'Changes',
      `${count('updated')} to change, ${count('created')} to add, ${count('removed') > 0 ? `${count('removed')} to remove, ` : ''}${count('unchanged')} unchanged`,
    ],
    ...(catalog
      ? [['Catalog', escape(catalogChange(catalog, (text) => text))]]
      : []),
  ]
  return [
    `| ${columns.map(([label]) => label).join(' | ')} |`,
    `| ${columns.map(() => '---').join(' | ')} |`,
    `| ${columns.map(([, value]) => value).join(' | ')} |`,
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
                        entryLines(entry, webhooks.get(name(entry.id)), {
                          benefits: updatedIds(result.entries, 'benefits'),
                          meters: updatedIds(result.entries, 'meters'),
                        }),
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
