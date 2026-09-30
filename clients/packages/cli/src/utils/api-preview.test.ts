import { expect, test } from 'vitest'
import { formatRecordPreview } from './api-preview'
import { stripAnsi } from './test-utils/cli'

const fields = [
  { key: 'name', label: 'Name' },
  { key: 'enabled', label: 'Enabled' },
  { key: 'count', label: 'Count' },
  { key: 'description', label: 'Description' },
]

test('loading and loaded previews keep identical rows and labels', () => {
  const loading = stripAnsi(formatRecordPreview(fields, 80)).split('\n')
  const loaded = stripAnsi(
    formatRecordPreview(fields, 80, {
      name: 'Alice',
      enabled: false,
      count: 0,
      description: null,
      secret: 'do-not-display',
    }),
  ).split('\n')
  expect(loading).toHaveLength(fields.length)
  expect(loaded).toHaveLength(fields.length)
  for (const [index, field] of fields.entries()) {
    expect(loading[index]).toContain(field.label)
    expect(loaded[index]).toContain(field.label)
    expect(loading[index]).toContain('…')
  }
  expect(loaded.join('\n')).toContain('Alice')
  expect(loaded.join('\n')).toContain('false')
  expect(loaded.join('\n')).toContain('0')
  expect(loaded[3]).toContain('—')
  expect(loaded.join('\n')).not.toContain('do-not-display')
})

test('empty or unusable fields retain their slots', () => {
  for (const record of [
    null,
    [],
    'invalid',
    {},
    { name: ' ', enabled: [], count: {} },
  ]) {
    const rows = stripAnsi(formatRecordPreview(fields, 80, record)).split('\n')
    expect(rows).toHaveLength(fields.length)
    expect(rows.every((row) => row.endsWith('—'))).toBe(true)
  }
  expect(formatRecordPreview([], 80)).toBe('')
})

test('values and labels fit terminal columns without wrapping', () => {
  const labels = [{ key: 'name', label: '顧客 name with a long label' }]
  for (const columns of [3, 12, 40, 80]) {
    for (const record of [undefined, { name: '猫🙂'.repeat(100) }]) {
      const rows = formatRecordPreview(labels, columns, record).split('\n')
      expect(rows).toHaveLength(1)
      expect(Bun.stringWidth(rows[0]!)).toBeLessThan(columns)
    }
  }
})

test('record values cannot inject terminal controls or additional lines', () => {
  const preview = stripAnsi(
    formatRecordPreview(fields, 80, {
      name: '\x1b[31mAlice\x1b[0m\nSmith',
      description: 'x'.repeat(200),
    }),
  )
  expect(preview).toContain('Alice Smith')
  expect(preview).not.toContain('x'.repeat(80))
  expect(preview.split('\n')).toHaveLength(fields.length)
})
