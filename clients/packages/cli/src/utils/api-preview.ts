import type { PreviewField } from '@polar-sh/cli-commands'
import * as ui from '@/utils/ui'

const graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' })

const clean = (text: string) =>
  Bun.stripANSI(text)
    .replace(/[\p{Cc}\p{Cf}\s]+/gu, ' ')
    .trim()

const truncate = (text: string, width: number) => {
  if (width <= 0) return ''
  if (Bun.stringWidth(text) <= width) return text
  let result = ''
  let used = 0
  for (const { segment } of graphemes.segment(text)) {
    const size = Bun.stringWidth(segment)
    if (used + size > width - 1) break
    result += segment
    used += size
  }
  return `${result}…`
}

export const formatRecordPreview = (
  fields: ReadonlyArray<PreviewField>,
  columns: number,
  record?: unknown,
): string => {
  if (fields.length === 0) return ''
  const width = Math.max(0, columns - 1)
  if (width < 6) return fields.map(() => truncate('…', width)).join('\n')
  const labels = fields.map(({ label }) => truncate(clean(label), width - 5))
  const labelWidth = Math.max(...labels.map((label) => Bun.stringWidth(label)))
  const valueWidth = width - labelWidth - 4
  const values =
    record !== null && typeof record === 'object' && !Array.isArray(record)
      ? (record as Record<string, unknown>)
      : {}
  return ui.keyValue(
    fields.map(({ key }, index) => {
      if (record === undefined) return [labels[index]!, ui.dim('…')] as const
      const value = values[key]
      const text =
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean'
          ? clean(String(value))
          : ''
      return [
        labels[index]!,
        text ? truncate(text, valueWidth) : ui.dim('—'),
      ] as const
    }),
  )
}
