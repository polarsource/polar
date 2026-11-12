import { Cause, Console, Duration, Effect, Exit, Stdio } from 'effect'
import yoctoSpinner from 'yocto-spinner'
import { isJson } from '@/utils/output'
import * as ui from '@/utils/ui'

export interface Progress {
  readonly open: (title: string) => Effect.Effect<void>
  readonly start: (text: string) => Effect.Effect<void>
  readonly finish: (detail?: string) => Effect.Effect<void>
  readonly fail: (detail?: string) => Effect.Effect<void>
  readonly close: Effect.Effect<void>
}

type Layout = 'checks' | 'columns'

const LABEL_WIDTH = 11

const column = (label: string) =>
  label.length < LABEL_WIDTH ? label.padEnd(LABEL_WIDTH) : `${label} `

const stepLine = (label: string, detail = '', failed = false) => {
  if (!ui.isHuman()) {
    return `${ui.INDENT}${(failed ? ui.red : ui.dim)(column(label))}${detail}`.trimEnd()
  }
  const name = failed ? ui.red(label) : label
  return `${ui.INDENT}${detail ? `${ui.leader(name)}${detail}` : name}`
}

const FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
const TURNS = ['|', '/', '-', '\\']
const TICK = 120

const formatDuration = (duration: Duration.Duration) =>
  `${Math.round(Duration.toMillis(duration) / 1000)}s`

const line = (mark: string, text: string, detail?: string) =>
  `${ui.INDENT}${mark} ${text}${detail ? `\n${ui.INDENT}${ui.INDENT}${ui.dim(detail)}` : ''}`

const boxedSpinnerText = (label: string, elapsed: string) => {
  const used =
    ui.INDENT.length + column(label).length + 2 + Bun.stringWidth(elapsed)
  return `${elapsed}${' '.repeat(Math.max(ui.boxInner() - used, 0))}${ui.dim('│')}\n${ui.boxBottom()}`
}

const animate = (draw: (tick: number) => string) => {
  let tick = 0
  let rows = 0
  const paint = (text = draw(tick)) => {
    const lines = text.split('\n')
    process.stdout.write(ui.repaint(lines, rows))
    rows = lines.length
  }
  process.stdout.write(ui.hideCursor)
  paint()
  const timer = setInterval(() => {
    tick += 1
    paint()
  }, TICK)
  return (settled?: string) => {
    clearInterval(timer)
    paint(settled)
    process.stdout.write(ui.showCursor)
  }
}

const make = (interactive: boolean, layout: Layout) => {
  const spinnerFor = (text: string) =>
    yoctoSpinner({
      stream: process.stdout,
      color: layout === 'columns' ? 'gray' : 'cyan',
      spinner: {
        frames: FRAMES.map((frame) =>
          layout === 'columns'
            ? `${ui.INDENT}│${ui.INDENT}${column(text)}${frame}`
            : `${ui.INDENT}${frame}`,
        ),
        interval: 80,
      },
    })
  let current: string | undefined
  let spinner: ReturnType<typeof yoctoSpinner> | undefined
  let timer: ReturnType<typeof setInterval> | undefined
  let repainting: ReturnType<typeof animate> | undefined

  const settle = (failed: boolean, detail?: string) =>
    Effect.gen(function* () {
      if (current === undefined) return
      const settled =
        layout === 'columns'
          ? ui.sectionRows(stepLine(current, detail, failed)).join('\n')
          : line(failed ? ui.cross() : ui.check(), current, detail)
      current = undefined
      if (repainting) {
        repainting(settled)
        repainting = undefined
        return
      }
      clearInterval(timer)
      spinner?.stop()
      spinner = undefined
      yield* Console.log(settled)
    })

  let opened = false

  const close = Effect.gen(function* () {
    yield* settle(false)
    if (!opened) return
    opened = false
    const bottom = ui.sectionClose()
    if (bottom.length > 0) yield* Console.log(bottom.join('\n'))
  })

  const open = (title: string) =>
    Effect.gen(function* () {
      yield* close
      if (layout !== 'columns') return
      opened = true
      yield* Console.log(ui.sectionOpen(title).join('\n'))
    })

  const begin = (text: string) =>
    Effect.sync(() => {
      current = text
      if (!interactive) return
      const startedAt = Date.now()
      const time = () =>
        ui.dim(formatDuration(Duration.millis(Date.now() - startedAt)))
      if (ui.isHuman()) {
        repainting = animate((tick) => {
          const turn = TURNS[tick % TURNS.length]
          return layout === 'columns'
            ? `${ui.INDENT}${ui.INDENT}${ui.INDENT}${ui.leader(text, tick)}${turn} ${time()}`
            : `${ui.INDENT}${turn} ${text} ${time()}`
        })
        return
      }
      const elapsed = () =>
        layout === 'columns'
          ? boxedSpinnerText(text, time())
          : `${text} ${time()}`
      const running = spinnerFor(text)
      spinner = running
      running.start(elapsed())
      timer = setInterval(() => {
        running.text = elapsed()
      }, 1000)
    })

  const progress: Progress = {
    open,
    start: (text) => Effect.andThen(settle(false), begin(text)),
    finish: (detail) => settle(false, detail),
    fail: (detail) => settle(true, detail),
    close,
  }
  return {
    progress,
    fail: (detail: string) => Effect.andThen(settle(true, detail), close),
  }
}

const silent: Progress = {
  open: () => Effect.void,
  start: () => Effect.void,
  finish: () => Effect.void,
  fail: () => Effect.void,
  close: Effect.void,
}

export const withProgress = <A, E, R>(
  run: (progress: Progress) => Effect.Effect<A, E, R>,
  layout: Layout = 'checks',
) =>
  Effect.gen(function* () {
    if (yield* isJson) return yield* run(silent)
    const stdio = yield* Stdio.Stdio
    const { progress, fail } = make(yield* stdio.stdoutIsTerminal, layout)
    return yield* run(progress).pipe(
      Effect.onExit((exit) =>
        Exit.isSuccess(exit)
          ? progress.close
          : fail(
              ui.dim(
                Cause.hasInterruptsOnly(exit.cause) ? 'cancelled' : 'failed',
              ),
            ),
      ),
    )
  })

export const atLeast = <A, E, R>(
  run: Effect.Effect<A, E, R>,
  milliseconds: number,
) =>
  Effect.gen(function* () {
    const stdio = yield* Stdio.Stdio
    const animated =
      ui.isHuman() && !(yield* isJson) && (yield* stdio.stdoutIsTerminal)
    if (!animated) return yield* run
    const [result] = yield* Effect.all([run, Effect.sleep(milliseconds)], {
      concurrency: 'unbounded',
    })
    return result
  })

interface CardOutcome {
  readonly label: string
  readonly detail?: string
  readonly failed?: boolean
  readonly instant?: boolean
}

interface Card<A, E, R> {
  readonly title: string
  readonly run: Effect.Effect<A, E, R>
}

const CARD_MINIMUM = 2000
const CARD_STAGGER = 500

export const withCards = <A, E, R>(
  title: string,
  running: string,
  cards: ReadonlyArray<Card<A, E, R>>,
  describe: (result: A) => CardOutcome,
) =>
  Effect.gen(function* () {
    const stdio = yield* Stdio.Stdio
    const inner = ui.cardInner(cards.length)
    const states: Array<'waiting' | 'running' | CardOutcome> = cards.map(
      () => 'waiting',
    )
    const status = (index: number, tick: number) => {
      const state = states[index] ?? 'waiting'
      if (state === 'waiting') return [ui.dim('○ waiting'), ui.track(inner)]
      if (state === 'running') {
        return [
          `${TURNS[tick % TURNS.length]} ${running}`,
          ui.track(inner, tick),
        ]
      }
      return [
        state.failed
          ? ui.red(`${ui.cross()} ${state.label}`)
          : `${ui.check()} ${state.label}`,
        state.detail ? ui.dim(state.detail) : ui.trackFull(inner),
      ]
    }
    const draw = (tick: number) =>
      ui.cardGrid(
        cards.map((card, index) => [
          ui.dim(String(index + 1).padStart(2, '0')),
          '',
          ...status(index, tick),
          '',
          ui.bold(card.title),
        ]),
      )
    yield* Console.log([...ui.sectionOpen(title), ui.blank].join('\n'))
    const animated = yield* stdio.stdoutIsTerminal
    const stop = animated ? animate(draw) : () => {}
    const results = yield* Effect.forEach(
      cards,
      (card, index) =>
        Effect.gen(function* () {
          states[index] = 'running'
          const startedAt = Date.now()
          const result = yield* card.run
          const outcome = describe(result)
          if (animated && !outcome.instant) {
            const shown = CARD_MINIMUM + index * CARD_STAGGER
            yield* Effect.sleep(Math.max(shown - (Date.now() - startedAt), 0))
          }
          states[index] = outcome
          return result
        }),
      { concurrency: 'unbounded' },
    ).pipe(Effect.ensuring(Effect.sync(stop)))
    if (!animated) yield* Console.log(draw(0))
    return results
  })

export const note = (line: string) =>
  Effect.gen(function* () {
    if (yield* isJson) return
    yield* Console.log(line)
  })

export const noteToStderr = (line: string) =>
  Effect.sync(() => {
    process.stderr.write(`${line}\n`)
  })
