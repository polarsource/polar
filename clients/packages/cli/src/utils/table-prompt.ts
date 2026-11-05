import { Data, Effect, Option, Terminal } from 'effect'
import { Prompt } from 'effect/cli'
import * as ui from '@/utils/ui'

export interface TableRow {
  readonly cells: ReadonlyArray<string>
  readonly value: string
}

export interface TableOptions {
  readonly message: string
  readonly headers: ReadonlyArray<string>
  readonly column: string
  readonly rows: ReadonlyArray<TableRow>
  readonly validate: (
    values: ReadonlyArray<string>,
  ) => ReadonlyArray<string | undefined>
}

interface State {
  readonly values: ReadonlyArray<string>
  readonly cursor: number
  readonly top: number
  readonly query: string
  readonly filtering: boolean
  readonly columns: number
  readonly height: number
}

const Action = Data.taggedEnum<Prompt.ActionDefinition>()

const HINT =
  '↑↓ move · type to edit · esc reset row · ctrl+f filter · enter save'
const FILTER_HINT = 'type to filter · ↑↓ move · esc stop filtering'

const visibleRows = (options: TableOptions, state: State) => {
  const query = state.query.trim().toLowerCase()
  return options.rows.flatMap((row, index) =>
    query === '' ||
    [...row.cells, state.values[index]!].some((cell) =>
      cell.toLowerCase().includes(query),
    )
      ? [index]
      : [],
  )
}

const scrolled = (state: State, count: number): State => {
  const cursor = Math.min(Math.max(state.cursor, 0), Math.max(count - 1, 0))
  const top = Math.min(
    Math.max(state.top, cursor - state.height + 1, 0),
    cursor,
  )
  return { ...state, cursor, top }
}

const VALUE_WIDTH = 36

const widths = (options: TableOptions, state: State) => {
  const natural = options.headers.map((header, column) =>
    Math.max(
      Bun.stringWidth(header),
      ...options.rows.map((row) => Bun.stringWidth(row.cells[column] ?? '')),
    ),
  )
  const value = Math.min(
    Math.max(
      Bun.stringWidth(options.column),
      ...state.values.map((text) => Bun.stringWidth(text) + 1),
    ),
    VALUE_WIDTH,
  )
  const widest = natural.indexOf(Math.max(...natural))
  const others = natural.reduce(
    (sum, width, column) => (column === widest ? sum : sum + width),
    0,
  )
  const room = state.columns - 4 - natural.length * 2 - value - 4 - others
  return natural.map((width, column) =>
    column === widest ? Math.max(Math.min(width, room), 8) : width,
  )
}

const line = (text: string, columns: number) => ui.truncate(text, columns - 1)

const rowLine = (
  options: TableOptions,
  state: State,
  sizes: ReadonlyArray<number>,
  index: number,
  focused: boolean,
  error: string | undefined,
) => {
  const cells = options.rows[index]!.cells.map((cell, column) =>
    ui.pad(ui.truncate(cell, sizes[column]!), sizes[column]!),
  )
  const used = 4 + sizes.reduce((sum, size) => sum + size + 2, 0)
  const value = state.values[index]!
  const shown = ui.truncate(value, Math.max(state.columns - used - 4, 4))
  const editing = focused && !state.filtering
  const valueText = editing ? `${shown}${ui.inverse(' ')}` : shown
  const problem = error === undefined ? '' : ` ${ui.red('✗')}`
  const pointer = focused ? ui.cyan('❯') : ' '
  const label = cells.join('  ')
  return `${ui.INDENT}${pointer} ${focused ? label : ui.dim(label)}  ${valueText}${problem}`
}

const frame = (options: TableOptions, state: State) => {
  const visible = visibleRows(options, state)
  const errors = options.validate(state.values)
  const problems = errors.filter((error) => error !== undefined).length
  const sizes = widths(options, state)
  const header = `${ui.INDENT}  ${[...options.headers.map((header, column) => ui.pad(header, sizes[column]!)), options.column].join('  ')}`
  const page = visible.slice(state.top, state.top + state.height)
  const footer = [
    visible.length === 0
      ? 'No matches'
      : `${state.top + 1}–${state.top + page.length} of ${visible.length}`,
    ...(visible.length < options.rows.length
      ? [`filtered from ${options.rows.length}`]
      : []),
    ...(problems > 0 ? [ui.red(`${problems} to fix before saving`)] : []),
  ].join(ui.dim(' · '))
  const focusedError =
    visible[state.cursor] === undefined
      ? undefined
      : errors[visible[state.cursor]!]
  return [
    `${ui.INDENT}${ui.cyan('?')} ${ui.bold(options.message)}`,
    ui.step(state.filtering ? FILTER_HINT : HINT),
    state.filtering || state.query !== ''
      ? `${ui.INDENT}  ${ui.dim('filter')} ${state.query}${state.filtering ? ui.inverse(' ') : ''}`
      : '',
    ui.dim(header),
    ...page.map((index, position) =>
      rowLine(
        options,
        state,
        sizes,
        index,
        state.top + position === state.cursor,
        errors[index],
      ),
    ),
    `${ui.INDENT}  ${ui.dim(footer)}`,
    ...(focusedError === undefined
      ? []
      : [`${ui.INDENT}  ${ui.red(`✗ ${focusedError}`)}`]),
  ].map((text) => line(text, state.columns))
}

const typed = (input: Terminal.UserInput) =>
  input.key.ctrl || input.key.meta
    ? undefined
    : Option.getOrUndefined(input.input)

const edit = (text: string, input: Terminal.UserInput) => {
  if (input.key.name === 'backspace') return text.slice(0, -1)
  if (input.key.ctrl && input.key.name === 'u') return ''
  const character = typed(input)
  return character === undefined || /[\p{Cc}]/u.test(character)
    ? undefined
    : text + character
}

const process =
  (options: TableOptions) => (input: Terminal.UserInput, state: State) => {
    const count = visibleRows(options, state).length
    const next = (patch: Partial<State>) =>
      Effect.succeed(
        Action.NextFrame({
          state: scrolled(
            { ...state, ...patch },
            visibleRows(options, { ...state, ...patch }).length,
          ),
        }),
      )
    const beep = Effect.succeed(Action.Beep())
    switch (input.key.name) {
      case 'up':
        return next({ cursor: state.cursor - 1 })
      case 'down':
        return next({ cursor: state.cursor + 1 })
      case 'pageup':
        return next({ cursor: state.cursor - state.height })
      case 'pagedown':
        return next({ cursor: state.cursor + state.height })
      case 'return':
      case 'enter': {
        if (state.filtering) return next({ filtering: false })
        const valid = options
          .validate(state.values)
          .every((error) => error === undefined)
        return valid
          ? Effect.succeed(Action.Submit({ value: state.values }))
          : beep
      }
      case 'escape': {
        if (state.filtering) {
          return next({ filtering: false, query: '', cursor: 0, top: 0 })
        }
        if (count === 0) return beep
        const index = visibleRows(options, state)[state.cursor]!
        const values = [...state.values]
        values[index] = options.rows[index]!.value
        return next({ values })
      }
    }
    if (input.key.ctrl && input.key.name === 'f') {
      return next({ filtering: !state.filtering })
    }
    if (state.filtering) {
      const query = edit(state.query, input)
      return query === undefined ? beep : next({ query, cursor: 0, top: 0 })
    }
    if (count === 0) return beep
    const index = visibleRows(options, state)[state.cursor]!
    const value = edit(state.values[index]!, input)
    if (value === undefined) return beep
    const values = [...state.values]
    values[index] = value
    return next({ values })
  }

const initial = (options: TableOptions) =>
  Effect.gen(function* () {
    const terminal = yield* Terminal.Terminal
    const columns = yield* terminal.columns
    const rows = yield* terminal.rows
    return {
      values: options.rows.map((row) => row.value),
      cursor: 0,
      top: 0,
      query: '',
      filtering: false,
      columns: columns > 0 ? columns : 80,
      height: Math.max(Math.min((rows > 0 ? rows : 24) - 8, 20), 3),
    } satisfies State
  })

export const editTable = (options: TableOptions) =>
  Prompt.run(
    Prompt.Custom<State, ReadonlyArray<string>>(initial(options), {
      render: (state, action) =>
        Effect.succeed(
          action._tag === 'Submit'
            ? `${ui.success(options.message)}\n`
            : ui.hideCursor + frame(options, state).join('\n'),
        ),
      process: process(options),
      clear: (state) =>
        Effect.succeed(ui.clearLines(frame(options, state).length)),
    }),
  )
