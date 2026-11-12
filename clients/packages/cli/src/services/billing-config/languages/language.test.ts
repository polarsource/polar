import { describe, expect, test } from 'vitest'
import type { SourcePositions } from '@/schemas/BillingConfig'
import { locateByPositions } from '@/services/billing-config/languages/language'

const name = { line: 9, column: 5, length: 5 }
const on = { line: 10, column: 9, length: 2 }
const event = { line: 10, column: 12, length: 11 }
const status = { line: 11, column: 18, length: 4 }
const meters = { line: 20, column: 17, length: 6 }

const positions: SourcePositions = {
  sections: { meters },
  entries: {
    meters: [
      null,
      {
        name,
        fields: {
          filter: {
            key: on,
            values: [
              { value: 'tool_call', span: event },
              { value: 'ok', span: status },
            ],
          },
        },
      },
    ],
  },
}

describe('locateByPositions', () => {
  test.each([
    ['the value an issue is about', ['meters', 1, 'filter'], 'ok', status],
    [
      'a value deeper in the field',
      ['meters', 1, 'filter', 'clauses', 0, 'value'],
      'tool_call',
      event,
    ],
    [
      'the argument when the value is not in the file',
      ['meters', 1, 'filter'],
      'other',
      on,
    ],
    [
      'the entry when the field is not in the file',
      ['meters', 1, 'unit'],
      'x',
      name,
    ],
    ['the entry itself', ['meters', 1], undefined, name],
    ['a section', ['meters'], undefined, meters],
  ])('finds %s', (_, path, got, expected) => {
    expect(locateByPositions(positions, path, got, 'value')).toEqual(expected)
  })

  test('underlines the argument instead of its value for an unknown argument', () => {
    expect(
      locateByPositions(positions, ['meters', 1, 'filter'], 'ok', 'key'),
    ).toEqual(on)
  })

  test.each([
    ['an entry declared in another file', positions, ['meters', 0, 'name']],
    ['an entry past the ones it knows', positions, ['meters', 5]],
    ['a section it does not know', positions, ['benefits', 0]],
    ['a config without positions', undefined, ['meters', 1]],
  ])('finds nothing for %s', (_, known, path) => {
    expect(locateByPositions(known, path, undefined, 'value')).toBeUndefined()
  })
})
