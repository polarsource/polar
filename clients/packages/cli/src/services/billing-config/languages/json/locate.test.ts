import { describe, expect, test } from 'vitest'
import { locateInJson } from '@/services/billing-config/languages/json/locate'

const source = [
  '{',
  '  "meters": [',
  '    {',
  '      "external_id": "tool-calls",',
  '      "filter": { "conjunction": "qwe", "clauses": [] }',
  '    }',
  '  ]',
  '}',
].join('\n')

describe('locateInJson', () => {
  test('finds the line and column of a value', () => {
    expect(
      locateInJson(source, ['meters', 0, 'filter', 'conjunction']),
    ).toEqual({
      line: 5,
      column: 34,
      length: 5,
    })
  })

  test('falls back to the closest parent for a missing key, underlining only its first line', () => {
    expect(locateInJson(source, ['meters', 0, 'name'])).toEqual({
      line: 3,
      column: 5,
      length: 1,
    })
  })

  test('can point at the key instead of the value', () => {
    expect(locateInJson(source, ['meters', 0, 'external_id'], 'key')).toEqual({
      line: 4,
      column: 7,
      length: 13,
    })
  })

  test('skips union tags that are not keys in the file', () => {
    expect(
      locateInJson(source, ['meters', 0, 'filter', 'and', 'conjunction']),
    ).toEqual({ line: 5, column: 34, length: 5 })
  })
})
