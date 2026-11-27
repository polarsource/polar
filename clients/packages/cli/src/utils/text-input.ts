import { Option, type Terminal } from 'effect'
import * as ui from '@/utils/ui'

export interface Field {
  readonly text: string
  readonly back: number
}

const GRAPHEMES = new Intl.Segmenter(undefined, { granularity: 'grapheme' })

const graphemes = (text: string) =>
  Array.from(GRAPHEMES.segment(text), ({ segment }) => segment)

const split = (field: Field) => {
  const chars = graphemes(field.text)
  return { chars, caret: chars.length - Math.min(field.back, chars.length) }
}

const at = (chars: ReadonlyArray<string>, caret: number): Field => ({
  text: chars.join(''),
  back: chars.length - caret,
})

const typed = (input: Terminal.UserInput) =>
  input.key.ctrl || input.key.meta
    ? undefined
    : Option.getOrUndefined(input.input)

interface Editing {
  readonly chars: ReadonlyArray<string>
  readonly caret: number
  readonly before: ReadonlyArray<string>
  readonly after: ReadonlyArray<string>
}

type Edit = (editing: Editing) => Field | undefined

const toStart: Edit = ({ chars }) => at(chars, 0)

const toEnd: Edit = ({ chars }) => at(chars, chars.length)

const KEYS = new Map<string, Edit>([
  [
    'left',
    ({ chars, caret }) => (caret === 0 ? undefined : at(chars, caret - 1)),
  ],
  [
    'right',
    ({ chars, caret }) =>
      caret === chars.length ? undefined : at(chars, caret + 1),
  ],
  ['home', toStart],
  ['end', toEnd],
  [
    'backspace',
    ({ before, after, caret }) =>
      caret === 0
        ? undefined
        : at([...before.slice(0, -1), ...after], caret - 1),
  ],
  [
    'delete',
    ({ chars, before, after, caret }) =>
      caret === chars.length
        ? undefined
        : at([...before, ...after.slice(1)], caret),
  ],
])

const CTRL_KEYS = new Map<string, Edit>([
  ['a', toStart],
  ['e', toEnd],
  ['u', ({ after }) => at(after, 0)],
  ['k', ({ before, caret }) => at(before, caret)],
])

export const editField = (
  field: Field,
  input: Terminal.UserInput,
  accept: (text: string) => string | undefined = (text) => text,
): Field | undefined => {
  const { chars, caret } = split(field)
  const before = chars.slice(0, caret)
  const after = chars.slice(caret)
  const { name, ctrl } = input.key
  const edit = (ctrl ? CTRL_KEYS.get(name) : undefined) ?? KEYS.get(name)
  if (edit) return edit({ chars, caret, before, after })
  const character = typed(input)
  if (character === undefined || /[\p{Cc}]/u.test(character)) return undefined
  const accepted = accept(character)
  if (accepted === undefined) return undefined
  const inserted = graphemes(accepted)
  return at([...before, ...inserted, ...after], caret + inserted.length)
}

export const renderField = (field: Field, width: number) => {
  const { chars, caret } = split(field)
  const cursor = chars[caret] ?? ' '
  let used = Bun.stringWidth(cursor)
  let start = caret
  while (start > 0 && used + Bun.stringWidth(chars[start - 1]!) <= width) {
    used += Bun.stringWidth(chars[--start]!)
  }
  let end = caret + 1
  while (end < chars.length && used + Bun.stringWidth(chars[end]!) <= width) {
    used += Bun.stringWidth(chars[end++]!)
  }
  return `${chars.slice(start, caret).join('')}${ui.inverse(cursor)}${chars.slice(caret + 1, end).join('')}`
}
