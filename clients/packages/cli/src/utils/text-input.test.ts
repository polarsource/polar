import { Option, type Terminal } from 'effect'
import { describe, expect, test } from 'vitest'
import { editField, type Field } from '@/utils/text-input'

const key = (name: string, ctrl = false): Terminal.UserInput => ({
  key: { name, ctrl, meta: false, shift: false },
  input: Option.none(),
})

const char = (text: string): Terminal.UserInput => ({
  key: { name: text, ctrl: false, meta: false, shift: false },
  input: Option.some(text),
})

const apply = (field: Field, inputs: ReadonlyArray<Terminal.UserInput>) =>
  inputs.reduce<Field | undefined>(
    (current, input) => (current ? editField(current, input) : undefined),
    field,
  )

describe('editField', () => {
  test('inserts at the caret after moving left', () => {
    expect(
      apply({ text: 'pro_plan', back: 0 }, [
        key('left'),
        key('left'),
        key('left'),
        key('left'),
        char('x'),
      ]),
    ).toEqual({ text: 'pro_xplan', back: 4 })
  })

  test('backspace and delete remove around the caret', () => {
    expect(
      apply({ text: 'abcd', back: 2 }, [key('backspace'), key('delete')]),
    ).toEqual({ text: 'ad', back: 1 })
  })

  test('home and end jump to the edges', () => {
    expect(editField({ text: 'abc', back: 1 }, key('home'))).toEqual({
      text: 'abc',
      back: 3,
    })
    expect(editField({ text: 'abc', back: 3 }, key('e', true))).toEqual({
      text: 'abc',
      back: 0,
    })
  })

  test('ctrl+u and ctrl+k cut before and after the caret', () => {
    expect(editField({ text: 'abcd', back: 2 }, key('u', true))).toEqual({
      text: 'cd',
      back: 2,
    })
    expect(editField({ text: 'abcd', back: 2 }, key('k', true))).toEqual({
      text: 'ab',
      back: 0,
    })
  })

  test('refuses to move past the edges', () => {
    expect(editField({ text: 'ab', back: 2 }, key('left'))).toBeUndefined()
    expect(editField({ text: 'ab', back: 0 }, key('right'))).toBeUndefined()
  })

  test('inserts what accept returns and refuses what it rejects', () => {
    const accept = (text: string) =>
      /^[a-z ]+$/.test(text) ? text.replace(/ /g, '_') : undefined
    expect(editField({ text: 'a', back: 0 }, char(' '), accept)).toEqual({
      text: 'a_',
      back: 0,
    })
    expect(editField({ text: 'a', back: 0 }, char('.'), accept)).toBeUndefined()
  })

  test('moves over a whole emoji', () => {
    expect(
      apply({ text: 'a👍🏽', back: 0 }, [key('left'), key('backspace')]),
    ).toEqual({ text: '👍🏽', back: 1 })
  })
})
