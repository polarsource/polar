import { Console, Duration, Effect, Terminal } from 'effect'
import * as ui from '@/utils/ui'

const LOGOMARK = [
  '       ██',
  '  ██▄  ██   ▄█',
  '   ▀██▄██  ██▀',
  '▄▄▄▄▄████  ██',
  '▀▀▀▀▀████  ██',
  '   ▄██▀██  ██▄',
  '  ▀█▀  ██   ▀█',
  '       ██',
]

const WIDTH = Math.max(...LOGOMARK.map((row) => row.length))

export const banner = (captions: ReadonlyArray<string>) => {
  const start = Math.floor((LOGOMARK.length - captions.length) / 2)
  return LOGOMARK.map((row, index) => {
    const caption = captions[index - start]
    return caption === undefined
      ? `${ui.INDENT}${row}`
      : `${ui.INDENT}${row.padEnd(WIDTH)}${ui.INDENT}${ui.INDENT}${caption}`
  })
}

type Caption = readonly [text: string, style: (text: string) => string]

const KEYSTROKE = Duration.millis(14)
const LINE_PAUSE = Duration.millis(160)
const CAPTION_COLUMN = ui.INDENT.length * 3 + WIDTH + 1

const FRAME = Duration.millis(14)

const revealed = (step: number) =>
  LOGOMARK.map(
    (row, index) => `${ui.INDENT}${row.slice(0, Math.max(step - index, 0))}`,
  ).join('\n')

const typed = (captions: ReadonlyArray<Caption>) =>
  Effect.gen(function* () {
    const terminal = yield* Terminal.Terminal
    const start = Math.floor((LOGOMARK.length - captions.length) / 2)
    yield* terminal.display(`${ui.hideCursor}\n${'\n'.repeat(LOGOMARK.length)}`)
    for (let step = 1; step <= WIDTH + LOGOMARK.length; step += 1) {
      yield* terminal.display(
        `${ui.cursorUp(LOGOMARK.length)}\r${revealed(step)}\n`,
      )
      yield* Effect.sleep(FRAME)
    }
    yield* terminal.display(ui.showCursor)
    for (const [index, [text, style]] of captions.entries()) {
      const up = LOGOMARK.length - start - index
      yield* terminal.display(
        `${ui.cursorUp(up)}${ui.cursorColumn(CAPTION_COLUMN)}`,
      )
      for (const character of text) {
        yield* terminal.display(style(character))
        yield* Effect.sleep(KEYSTROKE)
      }
      yield* Effect.sleep(LINE_PAUSE)
      yield* terminal.display(`${ui.cursorDown(up)}\r`)
    }
  }).pipe(
    Effect.ensuring(
      Effect.sync(() => {
        process.stdout.write(ui.showCursor)
      }),
    ),
    Effect.ignore,
  )

export const typeBanner = (captions: ReadonlyArray<Caption>) =>
  process.stdout.isTTY
    ? typed(captions)
    : Console.log(
        [
          ui.blank,
          ...banner(captions.map(([text, style]) => style(text))),
        ].join('\n'),
      )
