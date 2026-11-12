import { describe, expect, test } from 'vitest'
import { locateInPython } from '@/services/billing-config/languages/python/locate'

const source = [
  'from polar.config import Config, Flag, BenefitSet, Meter, MeterSet, Sum, eq',
  '',
  '',
  'class Benefits(BenefitSet):',
  '    tool_call = Flag("Tool calls")',
  '',
  '',
  'class Meters(MeterSet):',
  '    tool_call = Meter("Tool calls", on="tool_call", unit="custom")',
  '    tokens = Meter(',
  '        "",',
  '        on="llm.completion",',
  '        where=eq("status", "ok"),',
  '        aggregate=Sum("output_tokens"),',
  '    )',
  '',
  '',
  'config = Config(meters=Meters, benefits=Benefits)',
].join('\n')

const input = {
  meters: [{ external_id: 'tool_call' }, { external_id: 'tokens' }],
  benefits: [{ external_id: 'tool_call' }],
}

describe('locateInPython', () => {
  test.each([
    [
      'an entry by its attribute, in the class of its section',
      ['meters', 0],
      { external_id: 'tool_call' },
      { line: 9, column: 5, length: 9 },
    ],
    [
      'the same attribute name in another section',
      ['benefits', 0],
      undefined,
      { line: 5, column: 5, length: 9 },
    ],
    [
      'the value of a keyword argument',
      ['meters', 0, 'unit'],
      'custom',
      { line: 9, column: 58, length: 8 },
    ],
    [
      'the name, which has no keyword',
      ['meters', 1, 'name'],
      '',
      { line: 11, column: 9, length: 2 },
    ],
    [
      'a value inside the filter',
      ['meters', 1, 'filter', 'clauses', 1, 'value'],
      'ok',
      { line: 13, column: 28, length: 4 },
    ],
    [
      'a value inside the aggregation',
      ['meters', 1, 'aggregation', 'property'],
      'output_tokens',
      { line: 14, column: 23, length: 15 },
    ],
    [
      'the entry when the field is not in the file',
      ['meters', 0, 'custom_label'],
      undefined,
      { line: 9, column: 5, length: 9 },
    ],
    [
      'a section where it is passed to Config',
      ['meters'],
      undefined,
      { line: 18, column: 17, length: 6 },
    ],
  ])('finds %s', (_, path, got, expected) => {
    expect(locateInPython(source, input, path, got)).toEqual(expected)
  })

  test('underlines the keyword instead of its value for an unknown argument', () => {
    expect(
      locateInPython(source, input, ['meters', 0, 'unit'], 'custom', 'key'),
    ).toEqual({ line: 9, column: 53, length: 4 })
  })

  test('points at the last declaration of a name, the one Python keeps', () => {
    const twice = [
      'class Meters(MeterSet):',
      '    calls = Meter("Old", on="call")',
      '    calls = Meter("New", on="call")',
    ].join('\n')
    const declared = { meters: [{ external_id: 'calls' }] }

    expect(locateInPython(twice, declared, ['meters', 0], undefined)).toEqual({
      line: 3,
      column: 5,
      length: 5,
    })
  })

  test('finds nothing for an entry the file does not declare', () => {
    const undeclared = { meters: [{ external_id: 'requests' }] }

    expect(
      locateInPython(source, undeclared, ['meters', 0], undefined),
    ).toBeUndefined()
  })
})
