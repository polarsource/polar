import type { AppliedEntry, RemovalReason } from '@/schemas/BillingConfig'
import { entryKey, name, record } from '@/utils/billing-config/describe'
import { MARKS, formatRows, updatedIds } from '@/utils/billing-config/entries'
import {
  type MeterUse,
  benefitSentence,
  customFieldSentence,
  meterSentence,
  meterUnit,
  productMeters,
  productSentence,
  shownDiff,
  usedMeters,
} from '@/utils/billing-config/sentences'
import * as ui from '@/utils/ui'

type Section = 'meters' | 'custom_fields' | 'benefits' | 'products'

const SECTIONS: ReadonlyArray<Section> = [
  'meters',
  'custom_fields',
  'benefits',
  'products',
]

type Sentence = ReadonlyArray<string>

const isSection = (section: string): section is Section =>
  (SECTIONS as ReadonlyArray<string>).includes(section)

const SENTENCES: Record<Section, (input: unknown) => Sentence | undefined> = {
  meters: meterSentence,
  custom_fields: customFieldSentence,
  benefits: benefitSentence,
  products: productSentence,
}

const COVERED: Record<Section, ReadonlySet<string>> = {
  meters: new Set(['name', 'filter', 'aggregation', 'unit', 'custom_label']),
  custom_fields: new Set(['type', 'name', 'properties']),
  benefits: new Set(['description', 'type', 'properties', 'visibility']),
  products: new Set([
    'name',
    'visibility',
    'recurring_interval',
    'recurring_interval_count',
    'meter_interval',
    'meter_interval_count',
    'prices',
    'benefits',
    'custom_fields',
  ]),
}

const TOP = ui.INDENT
const NESTED = ui.INDENT.repeat(3)

const ids = (input: unknown): string[] =>
  Array.isArray(input) ? input.map((id) => name(id)) : []

export const documents = (input: unknown, section: Section) => {
  const items = record(input)?.[section]
  const byId = new Map<string, unknown>()
  for (const item of Array.isArray(items) ? items : []) {
    const id = entryKey(item)
    if (id !== undefined) byId.set(name(id), item)
  }
  return byId
}

// A benefit, meter or custom field that a product points at
type Reference = {
  id: string
  status: 'kept' | 'added' | 'removed' | 'updated'
  required?: boolean
}

type Listed = Omit<Reference, 'status'>

const listed = (ids: ReadonlyArray<string>): Listed[] =>
  ids.map((id) => ({ id }))

const compared = (
  before: ReadonlyArray<Listed>,
  after: ReadonlyArray<Listed>,
  updated: ReadonlySet<string>,
): Reference[] => {
  const previous = new Map(before.map((item) => [item.id, item]))
  const kept = new Set(after.map(({ id }) => id))
  return [
    ...after.map((item): Reference => {
      const old = previous.get(item.id)
      return {
        ...item,
        status:
          old === undefined
            ? 'added'
            : updated.has(item.id) || old.required !== item.required
              ? 'updated'
              : 'kept',
      }
    }),
    ...before
      .filter(({ id }) => !kept.has(id))
      .map((item): Reference => ({ ...item, status: 'removed' })),
  ]
}

const grants = (
  entry: AppliedEntry,
  product: unknown,
  updated: ReadonlySet<string>,
): Reference[] => {
  const change = entry.diff.find(({ field }) => field === 'benefits')
  if (change === undefined) {
    return ids(record(product)?.['benefits']).map((id) => ({
      id,
      status: entry.action === 'created' ? 'added' : 'kept',
    }))
  }
  return compared(
    listed(ids(change.before)),
    listed(ids(change.after)),
    updated,
  )
}

const attachments = (input: unknown): Listed[] =>
  (Array.isArray(input) ? input : []).map((item) => ({
    id: name(record(item)?.['field']),
    required: record(item)?.['required'] === true,
  }))

const attachedFields = (
  entry: AppliedEntry,
  updated: ReadonlySet<string>,
): Reference[] => {
  const change = entry.diff.find(({ field }) => field === 'custom_fields')
  return change === undefined
    ? []
    : compared(attachments(change.before), attachments(change.after), updated)
}

// The config may leave out a price's currency, the planned prices carry it
const withPlannedPrices = (document: unknown, entry: AppliedEntry) => {
  const prices = entry.diff.find(({ field }) => field === 'prices')
  return prices === undefined
    ? document
    : { ...record(document), prices: prices.after }
}

type Block = { readonly head: string; readonly body: ReadonlyArray<string> }

const REASONS: Record<RemovalReason, string> = {
  missing: 'not in config',
  deprecated: 'deprecated',
}

// Facts describe what is new; an update is told by its diff rows alone.
const describe = (
  mark: string,
  id: string,
  sentence: Sentence | undefined,
  fresh: boolean,
): Block => ({
  head: `${mark} ${ui.bold(id)}`,
  body: fresh ? (sentence ?? []) : [],
})

const branches = (blocks: ReadonlyArray<Block>) =>
  blocks.flatMap(({ head, body }, index) => {
    const last = index === blocks.length - 1
    const trunk = `${NESTED}${last ? ' ' : ui.dim('│')}${ui.INDENT.repeat(2)} `
    return [
      `${NESTED}${ui.dim(last ? '└' : '├')} ${head}`,
      ...body.map((line) => `${trunk}${line}`),
    ]
  })

const meterUse = ({ id, facts }: MeterUse): Block => ({
  head: `${ui.green('+')} ${ui.dim('meter')} ${ui.bold(id)}`,
  body: facts,
})

const rows = (
  indent: string,
  entry: AppliedEntry,
  section: string,
  document: unknown,
) =>
  formatRows(
    indent,
    shownDiff(
      section,
      entry.diff.filter(({ field }) =>
        entry.action === 'created'
          ? !(isSection(section) && COVERED[section].has(field))
          : field !== 'benefits' && field !== 'custom_fields',
      ),
      document,
    ),
    entry.action,
    section,
  )

const REFERENCE_MARKS: Record<Reference['status'], string> = {
  added: ui.green('+'),
  removed: ui.red('-'),
  kept: ui.dim('='),
  updated: ui.yellow('~'),
}

const reference =
  (kind: string) =>
  ({ id, status, required }: Reference): Block => ({
    head: [
      REFERENCE_MARKS[status],
      ui.dim(kind),
      status === 'kept' ? ui.dim(id) : ui.bold(id),
      ...(required === false ? [ui.dim('optional')] : []),
    ].join(' '),
    body: [],
  })

export const formatTree = (
  input: unknown,
  raw: ReadonlyArray<AppliedEntry>,
) => {
  const entries = raw.map((entry) => ({ ...entry, id: name(entry.id) }))
  const bySection = (section: string) =>
    entries.filter((entry) => entry.section === section)
  const docs = {
    meters: documents(input, 'meters'),
    custom_fields: documents(input, 'custom_fields'),
    benefits: documents(input, 'benefits'),
    products: documents(input, 'products'),
  }

  const updatedBenefits = updatedIds(entries, 'benefits')
  const updatedMeters = updatedIds(entries, 'meters')
  const updatedCustomFields = updatedIds(entries, 'custom_fields')
  const meterUses = (entry: AppliedEntry) => {
    const before = usedMeters(entry, 'before')
    const after = usedMeters(entry, 'after')
    if (!after.some((id) => updatedMeters.has(id))) return []
    return compared(listed(before), listed(after), updatedMeters).map(
      reference('meter'),
    )
  }

  const width = Math.max(
    0,
    ...entries
      .filter(({ action }) => action === 'unchanged' || action === 'removed')
      .map((entry) => entry.id.length),
  )

  const removal = ({ id, reason }: AppliedEntry) => [
    `${TOP}${MARKS.removed} ${ui.bold(id.padEnd(width))}  ${reason ? ui.dim(REASONS[reason]) : ''}`,
  ]

  const product = (entry: AppliedEntry) => {
    if (entry.action === 'removed') return removal(entry)
    const document = docs.products.get(entry.id)
    const granted = grants(entry, document, updatedBenefits)
    const regranted = granted.some(({ status }) => status !== 'kept')
    const fields = attachedFields(entry, updatedCustomFields)
    const fieldsChanged = fields.some(({ status }) => status !== 'kept')
    if (entry.action === 'unchanged' && !regranted) return undefined
    const fresh = entry.action === 'created'
    const planned = withPlannedPrices(document, entry)
    const own = describe(
      MARKS[entry.action],
      entry.id,
      productSentence(planned),
      fresh,
    )
    const children = [
      ...(fresh
        ? productMeters(planned, (id) => meterUnit(docs.meters.get(id))).map(
            meterUse,
          )
        : []),
      ...meterUses(entry),
      ...(fresh || regranted ? granted.map(reference('benefit')) : []),
      ...(fieldsChanged ? fields.map(reference('custom field')) : []),
    ]
    return [
      `${TOP}${own.head}`,
      ...own.body.map((line) => `${NESTED}${line}`),
      ...rows(NESTED, entry, 'products', document),
      ...branches(children),
    ]
  }

  const plain = (entry: AppliedEntry, section: string) => {
    if (entry.action === 'unchanged') return undefined
    if (entry.action === 'removed') return removal(entry)
    const document = isSection(section)
      ? docs[section].get(entry.id)
      : undefined
    const own = describe(
      MARKS[entry.action],
      entry.id,
      isSection(section) ? SENTENCES[section](document) : undefined,
      entry.action === 'created',
    )
    return [
      `${TOP}${own.head}`,
      ...own.body.map((line) => `${NESTED}${line}`),
      ...rows(NESTED, entry, section, document),
      ...branches(meterUses(entry)),
    ]
  }

  return [
    ...new Set([
      'settings',
      ...SECTIONS,
      ...entries.map(({ section }) => section),
    ]),
  ]
    .flatMap((section) => {
      const own = bySection(section)
      if (own.length === 0) return []
      const rendered = own.map((entry) => ({
        entry,
        lines: section === 'products' ? product(entry) : plain(entry, section),
      }))
      const lines = [
        ...rendered.flatMap(({ lines }) => lines ?? []),
        ...rendered
          .filter(({ lines }) => lines === undefined)
          .map(
            ({ entry }) =>
              `${TOP}${MARKS.unchanged} ${ui.dim(entry.id.padEnd(width))}  ${ui.dim('unchanged')}`,
          ),
      ]
      return [[`${TOP}${ui.bold(section)}`, ...lines].join('\n')]
    })
    .join('\n\n')
}
