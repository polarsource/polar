import type { ActiveOrganization } from '@/schemas/Auth'
import type { SimulationResult } from '@/schemas/Simulation'
import { money } from '@/utils/billing-config/describe'
import { plural } from '@/utils/billing-config/problems'
import { box, target } from '@/utils/billing-config/review'
import * as ui from '@/utils/ui'

interface Cell {
  readonly text: string
  readonly right?: boolean
  readonly style?: (text: string) => string
}

type Cohort = SimulationResult['cohorts'][number]

const signed = (minor: number, currency: string) =>
  `${minor < 0 ? '-' : '+'}${money(Math.abs(minor), currency)}`

const tone = (minor: number) =>
  minor > 0 ? ui.green : minor < 0 ? ui.red : ui.dim

const widthsOf = (rows: ReadonlyArray<ReadonlyArray<Cell>>) =>
  (rows[0] ?? []).map((_, column) =>
    Math.max(...rows.map((row) => Bun.stringWidth(row[column]?.text ?? ''))),
  )

const table = (
  rows: ReadonlyArray<ReadonlyArray<Cell>>,
  widths: ReadonlyArray<number>,
) =>
  rows.map((row) =>
    row
      .map((cell, column) => {
        const pad = ' '.repeat(
          (widths[column] ?? 0) - Bun.stringWidth(cell.text),
        )
        const text = cell.style ? cell.style(cell.text) : cell.text
        return cell.right ? pad + text : text + pad
      })
      .join('   ')
      .trimEnd(),
  )

const HEADER: Cell[] = [
  '',
  'subscribers',
  'per subscriber /mo',
  'change /mo',
  '',
].map((text, column) => ({ text, right: column > 0, style: ui.dim }))

const counts = (results: ReadonlyArray<SimulationResult>) => {
  const sum = (count: (counts: SimulationResult['counts']) => number) =>
    results.reduce((total, result) => total + count(result.counts), 0)
  return [
    [sum((n) => n.more), 'pay more'],
    [sum((n) => n.less), 'pay less'],
    [sum((n) => n.same), 'unchanged'],
    [sum((n) => n.no_history + n.not_simulated), 'not simulated'],
  ]
    .filter(([count]) => count !== 0)
    .map(([count, label]) => `${count} ${label}`)
    .join(', ')
}

const BILLED = {
  day: 'daily',
  week: 'weekly',
  month: 'monthly',
  year: 'yearly',
}

const billed = ({
  recurring_interval: interval,
  recurring_interval_count: count,
}: Cohort) => {
  if (count > 1) return `billed every ${count} ${interval}s`
  return interval === 'month' ? undefined : `billed ${BILLED[interval]}`
}

const notes = (cohort: Cohort) =>
  [
    cohort.archived && 'archived price',
    billed(cohort),
    cohort.partial && 'fixed fee only',
  ]
    .filter(Boolean)
    .join(' · ')

const cohortRows = ({ currency, cohorts }: SimulationResult): Cell[][] => {
  const products = new Map<string, Cohort[]>()
  for (const cohort of cohorts) {
    const group = products.get(cohort.product_external_id) ?? []
    products.set(cohort.product_external_id, [...group, cohort])
  }
  return [...products].flatMap(([product, group]) =>
    group.map((cohort, index): Cell[] => {
      const delta = cohort.proposed_monthly - cohort.baseline_monthly
      const each = (total: number) =>
        money(Math.round(total / cohort.subscribers), currency)
      return [
        { text: index === 0 ? `${ui.INDENT}${product}` : '', style: ui.bold },
        { text: String(cohort.subscribers), right: true },
        {
          text: `${each(cohort.baseline_monthly)} → ${each(cohort.proposed_monthly)}`,
          right: true,
        },
        { text: signed(delta, currency), right: true, style: tone(delta) },
        { text: notes(cohort), style: ui.dim },
      ]
    }),
  )
}

const total = ({ monthly_delta, currency }: SimulationResult) =>
  tone(monthly_delta)(`${signed(monthly_delta, currency)}/mo`)

const heading = ({ currency, monthly_delta }: SimulationResult): Cell[] => [
  { text: currency, style: ui.bold },
  { text: '' },
  { text: '' },
  {
    text: signed(monthly_delta, currency),
    right: true,
    style: (text) => ui.bold(tone(monthly_delta)(text)),
  },
  { text: '' },
]

const caveats = (results: ReadonlyArray<SimulationResult>) => {
  const reasons = new Map<string, { products: string[]; subscribers: number }>()
  for (const item of results.flatMap((result) => result.not_simulated)) {
    const group = reasons.get(item.reason) ?? { products: [], subscribers: 0 }
    reasons.set(item.reason, {
      products: group.products.includes(item.external_id)
        ? group.products
        : [...group.products, item.external_id],
      subscribers: group.subscribers + item.subscribers,
    })
  }
  return [...reasons].map(([reason, { products, subscribers }]) =>
    ui.warning(
      `Not simulated for ${ui.bold(products.join(', '))} ${ui.dim(`(${plural(subscribers, 'subscriber')})`)}: ${reason}`,
    ),
  )
}

export const renderSimulation = (
  organization: ActiveOrganization,
  results: ReadonlyArray<SimulationResult>,
) => {
  if (results.length === 0) {
    return [ui.success(`No subscribers in ${target(organization)} to simulate`)]
  }
  const sections = results.map((result) => [
    heading(result),
    ...cohortRows(result),
  ])
  const widths = widthsOf([HEADER, ...sections.flat()])
  const indented = (rows: ReadonlyArray<ReadonlyArray<Cell>>) =>
    table(rows, widths).map((line) => `${ui.INDENT}${line}`)
  const body = [
    ...indented([HEADER]),
    ...sections.flatMap((rows, index) => [
      ...(index > 0 ? [ui.blank] : []),
      ...indented(rows),
    ]),
  ]
  const warnings = caveats(results)
  return [
    ui.blank,
    box(`Simulation ${ui.dim(target(organization))}`, body.join('\n')),
    ...(warnings.length > 0 ? [ui.blank, ...warnings] : []),
    ui.blank,
    `${ui.INDENT}${ui.dim('Simulation:')} ${results.map((result) => `${result.currency.toUpperCase()} ${total(result)}`).join(', ')}`,
    ui.step(
      `${counts(results)}, based on each subscriber's last billing period.`,
    ),
  ]
}
