import type { ActiveOrganization } from '@/schemas/Auth'
import type {
  AnalyzedResult,
  ChurnAssumptions,
  SimulationResult,
} from '@/schemas/Simulation'
import { money } from '@/utils/billing-config/describe'
import { plural } from '@/utils/billing-config/problems'
import { box, target } from '@/utils/billing-config/review'
import { formatWindow } from '@/utils/simulation-window'
import * as ui from '@/utils/ui'

interface Cell {
  readonly text: string
  readonly right?: boolean
  readonly style?: (text: string) => string
}

type Cohort = AnalyzedResult['cohorts'][number]

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

const header = (churn: boolean): Cell[] =>
  [
    '',
    'subscribers',
    'billed → proposed',
    'change',
    '',
    ...(churn ? ['churn risk'] : []),
    '',
  ].map((text, column) => ({ text, right: column > 0, style: ui.dim }))

const percent = (pct: number | null): Cell => ({
  text: pct === null ? '' : `${pct > 0 ? '+' : ''}${Math.round(pct)}%`,
  right: true,
  style: ui.dim,
})

const risk = (pct: number | null): Cell[] =>
  pct === null
    ? []
    : [
        {
          text: pct > 0 ? `${Math.round(pct)}%` : '',
          right: true,
          style: ui.yellow,
        },
      ]

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
    cohort.partial && 'other charges not simulated',
  ]
    .filter(Boolean)
    .join(' · ')

const cohortRows = ({ currency, cohorts }: AnalyzedResult): Cell[][] => {
  const products = new Map<string, Cohort[]>()
  for (const cohort of cohorts) {
    const group = products.get(cohort.product_external_id) ?? []
    products.set(cohort.product_external_id, [...group, cohort])
  }
  return [...products].flatMap(([product, group]) =>
    group.map((cohort, index): Cell[] => {
      const delta = cohort.proposed - cohort.baseline
      return [
        { text: index === 0 ? `${ui.INDENT}${product}` : '', style: ui.bold },
        { text: String(cohort.subscribers), right: true },
        {
          text: `${money(cohort.baseline, currency)} → ${money(cohort.proposed, currency)}`,
          right: true,
        },
        { text: signed(delta, currency), right: true, style: tone(delta) },
        percent(cohort.change_pct),
        ...risk(cohort.churn_risk_pct),
        { text: notes(cohort), style: ui.dim },
      ]
    }),
  )
}

const total = (delta: number, currency: string) =>
  `${currency.toUpperCase()} ${tone(delta)(`${signed(delta, currency)}/mo`)}`

const windowTotal = ({
  currency,
  baseline,
  proposed,
  monthly_delta,
}: SimulationResult) =>
  `${currency.toUpperCase()} ${tone(proposed - baseline)(signed(proposed - baseline, currency))} ${ui.dim(`(≈ ${signed(monthly_delta, currency)}/mo)`)}`

const heading = (
  { currency, baseline, proposed, change_pct }: AnalyzedResult,
  churn: boolean,
): Cell[] => [
  { text: currency, style: ui.bold },
  { text: '' },
  { text: '' },
  {
    text: signed(proposed - baseline, currency),
    right: true,
    style: (text) => ui.bold(tone(proposed - baseline)(text)),
  },
  percent(change_pct),
  ...(churn ? [{ text: '' }] : []),
  { text: '' },
]

const expected = (
  results: ReadonlyArray<AnalyzedResult>,
  { churn_tolerance_pct, churn_elasticity_pct }: ChurnAssumptions,
) => {
  const atRisk = results.reduce(
    (sum, result) => sum + (result.subscribers_at_risk ?? 0),
    0,
  )
  return [
    `${ui.INDENT}${ui.dim('Expected after churn:')} ${results.map((result) => total(result.expected_monthly_delta ?? 0, result.currency)).join(', ')} ${ui.dim(`(${plural(atRisk, 'subscriber')} at risk)`)}`,
    ui.step(
      `Assumes subscribers accept up to ${churn_tolerance_pct}% more, then ${churn_elasticity_pct}% churn for every further 10%.`,
    ),
  ]
}

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
  results: ReadonlyArray<AnalyzedResult>,
  assumptions: ChurnAssumptions | null,
) => {
  if (results.length === 0) {
    return [ui.success(`No subscribers in ${target(organization)} to simulate`)]
  }
  const churn = assumptions !== null
  const window = formatWindow(results[0]!.window)
  const sections = results.map((result) => [
    heading(result, churn),
    ...cohortRows(result),
  ])
  const widths = widthsOf([header(churn), ...sections.flat()])
  const indented = (rows: ReadonlyArray<ReadonlyArray<Cell>>) =>
    table(rows, widths).map((line) => `${ui.INDENT}${line}`)
  const body = [
    ...indented([header(churn)]),
    ...sections.flatMap((rows, index) => [
      ...(index > 0 ? [ui.blank] : []),
      ...indented(rows),
    ]),
  ]
  const warnings = caveats(results)
  return [
    ui.blank,
    box(
      `Simulation ${ui.dim(`${target(organization)} · ${window}`)}`,
      body.join('\n'),
    ),
    ...(warnings.length > 0 ? [ui.blank, ...warnings] : []),
    ui.blank,
    `${ui.INDENT}${ui.dim('Simulation:')} ${results.map(windowTotal).join(', ')}`,
    ui.step(
      `${counts(results)}. Replays subscription orders billed ${window} at the proposed prices.`,
    ),
    ...(assumptions === null
      ? []
      : [ui.blank, ...expected(results, assumptions)]),
  ]
}
