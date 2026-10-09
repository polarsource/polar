import type { AppliedEntry } from '@/schemas/BillingConfig'
import { name, record } from '@/utils/billing-config/describe'
import { MARKS, formatRows } from '@/utils/billing-config/entries'
import {
  type MeterUse,
  benefitSentence,
  meterSentence,
  meterUnit,
  productMeters,
  productSentence,
} from '@/utils/billing-config/sentences'
import * as ui from '@/utils/ui'

type Section = 'meters' | 'benefits' | 'products'

const SECTIONS: ReadonlyArray<Section> = ['meters', 'benefits', 'products']

type Sentence = ReadonlyArray<string>

const SENTENCES: Record<Section, (input: unknown) => Sentence | undefined> = {
  meters: meterSentence,
  benefits: benefitSentence,
  products: productSentence,
}

const COVERED: Record<Section, ReadonlySet<string>> = {
  meters: new Set(['name', 'filter', 'aggregation', 'unit', 'custom_label']),
  benefits: new Set(['description', 'type', 'properties']),
  products: new Set([
    'name',
    'visibility',
    'recurring_interval',
    'recurring_interval_count',
    'prices',
    'benefits',
  ]),
}

const TOP = ui.INDENT
const NESTED = ui.INDENT.repeat(3)

const ids = (input: unknown): string[] =>
  Array.isArray(input) ? input.map((id) => name(id)) : []

const documents = (input: unknown, section: Section) => {
  const items = record(input)?.[section]
  const byId = new Map<string, unknown>()
  for (const item of Array.isArray(items) ? items : []) {
    const id = record(item)?.['external_id']
    if (typeof id === 'string') byId.set(name(id), item)
  }
  return byId
}

type Grant = { id: string; status: 'kept' | 'added' | 'removed' }

const grants = (entry: AppliedEntry, product: unknown): Grant[] => {
  const change = entry.diff.find(({ field }) => field === 'benefits')
  if (change === undefined) {
    return ids(record(product)?.['benefits']).map((id) => ({
      id,
      status: entry.action === 'created' ? 'added' : 'kept',
    }))
  }
  const before = ids(change.before)
  const after = ids(change.after)
  return [
    ...after.map(
      (id): Grant => ({ id, status: before.includes(id) ? 'kept' : 'added' }),
    ),
    ...before
      .filter((id) => !after.includes(id))
      .map((id): Grant => ({ id, status: 'removed' })),
  ]
}

type Block = { readonly head: string; readonly body: ReadonlyArray<string> }

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

const rows = (indent: string, entry: AppliedEntry, section: Section) =>
  formatRows(
    indent,
    entry.diff.filter(({ field }) =>
      entry.action === 'created'
        ? !COVERED[section].has(field)
        : field !== 'benefits',
    ),
    entry.action,
  )

const GRANT_MARKS: Record<Grant['status'], string> = {
  added: ui.green('+'),
  removed: ui.red('-'),
  kept: ui.dim('='),
}

const reference = ({ id, status }: Grant): Block => ({
  head: `${GRANT_MARKS[status]} ${ui.dim('benefit')} ${status === 'kept' ? ui.dim(id) : ui.bold(id)}`,
  body: [],
})

export const formatTree = (
  input: unknown,
  raw: ReadonlyArray<AppliedEntry>,
) => {
  const entries = raw.map((entry) => ({ ...entry, id: name(entry.id) }))
  const bySection = (section: Section) =>
    entries.filter((entry) => entry.section === section)
  const docs = {
    meters: documents(input, 'meters'),
    benefits: documents(input, 'benefits'),
    products: documents(input, 'products'),
  }

  const product = (entry: AppliedEntry) => {
    const document = docs.products.get(entry.id)
    const granted = grants(entry, document)
    const regranted = granted.some(({ status }) => status !== 'kept')
    if (entry.action === 'unchanged' && !regranted) return undefined
    const fresh = entry.action === 'created'
    const own = describe(
      MARKS[entry.action],
      entry.id,
      productSentence(document),
      fresh,
    )
    const children = [
      ...(fresh
        ? productMeters(document, (id) => meterUnit(docs.meters.get(id))).map(
            meterUse,
          )
        : []),
      ...(fresh || regranted ? granted.map(reference) : []),
    ]
    return [
      `${TOP}${own.head}`,
      ...own.body.map((line) => `${NESTED}${line}`),
      ...rows(NESTED, entry, 'products'),
      ...branches(children),
    ]
  }

  const plain = (entry: AppliedEntry, section: Section) => {
    if (entry.action === 'unchanged') return undefined
    const own = describe(
      MARKS[entry.action],
      entry.id,
      SENTENCES[section](docs[section].get(entry.id)),
      entry.action === 'created',
    )
    return [
      `${TOP}${own.head}`,
      ...own.body.map((line) => `${NESTED}${line}`),
      ...rows(NESTED, entry, section),
    ]
  }

  return SECTIONS.flatMap((section) => {
    const own = bySection(section)
    if (own.length === 0) return []
    const width = Math.max(
      0,
      ...own
        .filter((entry) => entry.action === 'unchanged')
        .map((entry) => entry.id.length),
    )
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
  }).join('\n\n')
}
