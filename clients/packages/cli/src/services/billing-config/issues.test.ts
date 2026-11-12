import { describe, expect, test } from 'vitest'
import { issues } from '@/services/billing-config/issues'

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

  test('locates an issue in the language the config is written in', () => {
    const python = {
      file: 'polar_config.py',
      source: 'class Meters(MeterSet):\n    calls = Meter("", on="call")\n',
      input: { meters: [{ external_id: 'calls', name: '' }] },
      generated: true,
    }

    const [issue] = issues(python, [
      {
        type: 'string_too_short',
        loc: ['body', 'meters', 0, 'name'],
        msg: 'String should have at least 3 characters',
        input: '',
      },
    ])

    expect(issue?.location).toEqual({ line: 2, column: 19, length: 2 })
  })
})
