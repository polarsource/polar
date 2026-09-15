import { Effect, Schema } from 'effect'
import type {
  MeterPricePreview,
  PricePreviewCustomer,
  PricePreviewWindow,
} from '../api/generated'
import { aside, heavy, rule, soft } from './style'

export class PreviewError extends Schema.TaggedError<PreviewError>()(
  'PreviewError',
  { message: Schema.String },
) {}

export const previewWindow = Effect.fn('cli.previewWindow')(function* (
  from: string | undefined,
  to: string | undefined,
  now = new Date(),
) {
  if ((from === undefined) !== (to === undefined))
    return yield* new PreviewError({ message: 'Supply both --from and --to.' })
  const end = now.toISOString().slice(0, 10)
  const previous = new Date(`${end}T00:00:00Z`)
  previous.setUTCDate(previous.getUTCDate() - 30)
  const window: PricePreviewWindow = {
    start: from ?? previous.toISOString().slice(0, 10),
    end: to ?? end,
  }
  for (const date of [window.start, window.end]) {
    const parsed = new Date(`${date}T00:00:00Z`)
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !Number.isFinite(parsed.getTime()) ||
      parsed.toISOString().slice(0, 10) !== date
    )
      return yield* new PreviewError({
        message: 'Preview dates must be valid UTC dates in YYYY-MM-DD format.',
      })
  }
  if (window.start >= window.end)
    return yield* new PreviewError({ message: '--from must be before --to.' })
  if (window.end > end)
    return yield* new PreviewError({
      message:
        '--to must be today or earlier; the preview uses completed UTC days.',
    })
  return window
})

// oxlint-disable-next-line no-control-regex -- Remove terminal control characters from server-supplied text.
const control = /[\u0000-\u001f\u007f-\u009f]/g

const idle = (customer: PricePreviewCustomer) =>
  [
    customer.billable_units,
    customer.current_amount,
    customer.proposed_amount,
    customer.difference,
  ].every((value) => Number(value) === 0)

const amountVoice = (value: string, text: string, styled: boolean) =>
  Number(value) === 0 ? soft(text, styled) : heavy(text, styled)

export function describePricePreview(
  preview: MeterPricePreview,
  styled = false,
): string {
  if (preview.unavailable)
    return aside(
      `    Price preview unavailable: ${preview.unavailable}`,
      styled,
    )
  const amount = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: preview.currency,
  })
  const unitPrice = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: preview.currency,
    maximumFractionDigits: 12,
  })
  const units = new Intl.NumberFormat('en-US', { maximumFractionDigits: 12 })
  const money = (value: string) => amount.format(Number(value))
  const signed = (value: string) =>
    `${Number(value) > 0 ? '+' : ''}${money(value)}`
  const label = (customer: PricePreviewCustomer) =>
    (customer.name || customer.external_id).replace(control, '')
  const customers = preview.customers ?? []
  const active = customers.filter((customer) => !idle(customer))
  const hidden = customers.length - active.length
  const headings = ['Customer', 'Units', 'Current', 'Proposed', 'Difference']
  const rows = active.map((customer) => [
    label(customer),
    units.format(Number(customer.billable_units)),
    money(customer.current_amount),
    money(customer.proposed_amount),
    signed(customer.difference),
  ])
  const total = [
    preview.excluded_customers?.length ? 'Total (included customers)' : 'Total',
    units.format(Number(preview.billable_units ?? '0')),
    money(preview.current_amount ?? '0'),
    money(preview.proposed_amount ?? '0'),
    signed(preview.difference ?? '0'),
  ]
  const widths = headings.map((heading, column) =>
    Math.max(
      heading.length,
      ...[...rows, total].map((row) => row[column]?.length ?? 0),
    ),
  )
  const cells = (row: ReadonlyArray<string>) =>
    row.map((cell, column) =>
      column === 0
        ? cell.padEnd((widths[column] ?? 0) + 2)
        : cell.padStart(widths[column] ?? 0),
    )
  const tableWidth = cells(headings).join('  ').length
  const hairline = `    ${rule(tableWidth, styled)}`
  const line = (
    row: ReadonlyArray<string>,
    voice: ReadonlyArray<((text: string) => string) | undefined> = [],
  ) =>
    '    ' +
    cells(row)
      .map((cell, column) => voice[column]?.(cell) ?? cell)
      .join('  ')
  const current = unitPrice.format(Number(preview.current_unit_amount))
  const proposed = unitPrice.format(Number(preview.proposed_unit_amount))
  const period = `${preview.window.start} – ${preview.window.end} UTC`
  const unitDelta = `${Number(preview.proposed_unit_amount) - Number(preview.current_unit_amount)}`
  const lines = [
    `    ${soft(current, styled)} → ${amountVoice(unitDelta, proposed, styled)}    ${aside(period, styled)}`,
  ]
  if (rows.length) {
    lines.push(
      '',
      line(
        headings,
        headings.map(() => (cell) => soft(cell, styled)),
      ),
      hairline,
      ...active.map((customer, index) =>
        line(rows[index] ?? [], [
          undefined,
          undefined,
          (cell) => soft(cell, styled),
          (cell) => amountVoice(customer.proposed_amount, cell, styled),
          (cell) => amountVoice(customer.difference, cell, styled),
        ]),
      ),
      hairline,
      line(total, [
        (cell) => heavy(cell, styled),
        (cell) => heavy(cell, styled),
        (cell) => soft(cell, styled),
        (cell) => amountVoice(preview.proposed_amount ?? '0', cell, styled),
        (cell) => amountVoice(preview.difference ?? '0', cell, styled),
      ]),
    )
  } else if (!customers.length) {
    lines.push(aside('    No eligible customer usage in this period.', styled))
  }
  if (hidden)
    lines.push(
      aside(
        `    ${hidden} customer${hidden === 1 ? '' : 's'} with no usage in this period`,
        styled,
      ),
    )
  for (const excluded of preview.excluded_customers ?? [])
    lines.push(aside(`    Excluded: ${excluded.replace(control, '')}`, styled))
  return lines.join('\n')
}
