import { describe, expect, test } from 'vitest'
import { issues, locate } from '@/services/billing-config/issues'

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

describe('locate', () => {
  test('finds the line and column of a value', () => {
    expect(locate(source, ['meters', 0, 'filter', 'conjunction'])).toEqual({
      line: 5,
      column: 34,
      length: 5,
    })
  })

  test('falls back to the closest parent for a missing key, underlining only its first line', () => {
    expect(locate(source, ['meters', 0, 'name'])).toEqual({
      line: 3,
      column: 5,
      length: 1,
    })
  })

  test('can point at the key instead of the value', () => {
    expect(locate(source, ['meters', 0, 'external_id'], 'key')).toEqual({
      line: 4,
      column: 7,
      length: 13,
    })
  })

  test('skips union tags that are not keys in the file', () => {
    expect(
      locate(source, ['meters', 0, 'filter', 'and', 'conjunction']),
    ).toEqual({ line: 5, column: 34, length: 5 })
  })
})

describe('issues', () => {
  const config = {
    file: 'polar.json',
    source,
    input: JSON.parse(source) as unknown,
    generated: false,
  }

  test('maps server errors onto the file, defaulting to error severity', () => {
    expect(
      issues(config, [
        {
          type: 'missing',
          loc: ['body', 'meters', 0, 'name'],
          msg: 'Field required',
        },
        {
          severity: 'warning',
          type: 'unknown_event',
          loc: ['body', 'meters', 0, 'filter', 'conjunction'],
          msg: 'No events with this name have been received yet.',
          input: 'qwe',
        },
      ]),
    ).toEqual([
      {
        severity: 'error',
        code: 'missing',
        path: 'meters.tool-calls.name',
        message: 'Field required',
        got: undefined,
        location: { line: 3, column: 5, length: 1 },
      },
      {
        severity: 'warning',
        code: 'unknown_event',
        path: 'meters.tool-calls.filter.conjunction',
        message: 'No events with this name have been received yet.',
        got: '"qwe"',
        location: { line: 5, column: 34, length: 5 },
      },
    ])
  })

  test('keeps a null the file actually contains, drops a null meaning no value', () => {
    const nulls = {
      file: 'polar.json',
      source: '{\n  "meters": [\n    { "name": null }\n  ]\n}',
      input: { meters: [{ name: null }] },
      generated: false,
    }
    const [literal, irrelevant] = issues(nulls, [
      {
        type: 'string_type',
        loc: ['body', 'meters', 0, 'name'],
        msg: 'Input should be a valid string',
        input: null,
      },
      {
        type: 'meter_locked',
        loc: ['body', 'meters', 0, 'filter'],
        msg: 'Locked',
        input: null,
      },
    ])
    expect(literal?.got).toBe('null')
    expect(irrelevant?.got).toBeUndefined()
  })

  test('points a bad discriminator at the tag key with the allowed values', () => {
    expect(
      issues(config, [
        {
          type: 'union_tag_invalid',
          loc: ['body', 'meters', 0, 'filter'],
          msg: "Input tag 'qwe' found using 'conjunction' does not match any of the expected tags: <C.and: 'and'>, <C.or: 'or'>",
          input: { conjunction: 'qwe', clauses: [] },
          ctx: {
            discriminator: "'conjunction'",
            tag: 'qwe',
            expected_tags: "<C.and: 'and'>, <C.or: 'or'>",
          },
        },
      ]),
    ).toEqual([
      {
        severity: 'error',
        code: 'union_tag_invalid',
        path: 'meters.tool-calls.filter.conjunction',
        message: "Input should be 'and' or 'or'",
        got: '"qwe"',
        location: { line: 5, column: 34, length: 5 },
      },
    ])
  })
})
