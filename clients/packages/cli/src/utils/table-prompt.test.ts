import { Effect, Option, type Terminal } from 'effect'
import { describe, expect, test } from 'vitest'
import { process, type State, type TableOptions } from '@/utils/table-prompt'

const key = (name: string, ctrl = false): Terminal.UserInput => ({
  key: { name, ctrl, meta: false, shift: false },
  input: Option.none(),
})

const char = (text: string): Terminal.UserInput => ({
  key: { name: text, ctrl: false, meta: false, shift: false },
  input: Option.some(text),
})

const options: TableOptions = {
  message: 'Edit external IDs',
  headers: ['Name'],
  column: 'External ID',
  rows: [
    { cells: ['Basic'], value: 'basic' },
    { cells: ['Pro'], value: 'pro_seats' },
    { cells: ['Team'], value: 'team_seats' },
  ],
  validate: (values) => values.map(() => undefined),
}

const initial: State = {
  values: options.rows.map((row) => row.value),
  pinned: undefined,
  cursor: 0,
  back: 0,
  top: 0,
  query: '',
  filtering: false,
  columns: 120,
  height: 10,
}

const run = (state: State, inputs: ReadonlyArray<Terminal.UserInput>) =>
  inputs.reduce((current, input) => {
    const action = Effect.runSync(process(options)(input, current))
    return action._tag === 'NextFrame' ? action.state : current
  }, state)

const filtered = run(initial, [
  key('f', true),
  char('s'),
  char('e'),
  key('return'),
])

describe('editTable', () => {
  test('keeps editing the same row after it stops matching the filter', () => {
    const state = run(filtered, [key('u', true), char('x')])
    expect(state.values).toEqual(['basic', 'x', 'team_seats'])
  })

  test('keeps the caret on the edited row after it stops matching', () => {
    const state = run(filtered, [
      key('down'),
      key('left'),
      key('left'),
      key('backspace'),
      key('backspace'),
      key('backspace'),
      key('backspace'),
      char('x'),
    ])
    expect(state.values).toEqual(['basic', 'pro_seats', 'teamxts'])
  })

  test('drops the pinned row once the filter changes', () => {
    const state = run(filtered, [key('u', true), key('return'), char('a')])
    expect(state.pinned).toBeUndefined()
    expect(state.values).toEqual(['basic', '', 'team_seats'])
  })
})
