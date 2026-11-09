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

const stepLine = (label: string, detail = '') =>
  `${ui.INDENT}${ui.dim(column(label))}${detail}`.trimEnd()

const FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']

const formatDuration = (duration: Duration.Duration) =>
  `${Math.round(Duration.toMillis(duration) / 1000)}s`

const line = (mark: string, text: string, detail?: string) =>
  `${ui.INDENT}${mark} ${text}${detail ? `\n${ui.INDENT}${ui.INDENT}${ui.dim(detail)}` : ''}`

const boxedSpinnerText = (label: string, elapsed: string) => {
  const used =
    ui.INDENT.length + column(label).length + 2 + Bun.stringWidth(elapsed)
  return `${elapsed}${' '.repeat(Math.max(ui.boxInner() - used, 0))}${ui.dim('│')}\n${ui.boxBottom()}`
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

  const stop = Effect.sync(() => {
    current = undefined
    clearInterval(timer)
    spinner?.stop()
    spinner = undefined
  })

  const settle = (failed: boolean, detail?: string) =>
    Effect.gen(function* () {
      if (current === undefined) return
      const text = current
      yield* stop
      yield* Console.log(
        layout === 'columns'
          ? ui
              .boxRows(
                failed
                  ? `${ui.INDENT}${ui.red(column(text))}${detail ?? ''}`.trimEnd()
                  : stepLine(text, detail),
              )
              .join('\n')
          : line(failed ? ui.red('✖') : ui.green('✔'), text, detail),
      )
    })

  let opened = false

  const close = Effect.gen(function* () {
    yield* settle(false)
    if (!opened) return
    opened = false
    yield* Console.log(ui.boxBottom())
  })

  const open = (title: string) =>
    Effect.gen(function* () {
      yield* close
      if (layout !== 'columns') return
      opened = true
      yield* Console.log([ui.blank, ui.heading(title), ui.boxTop()].join('\n'))
    })

  const begin = (text: string) =>
    Effect.sync(() => {
      current = text
      if (!interactive) return
      const startedAt = Date.now()
      const elapsed = () => {
        const time = ui.dim(
          formatDuration(Duration.millis(Date.now() - startedAt)),
        )
        return layout === 'columns'
          ? boxedSpinnerText(text, time)
          : `${text} ${time}`
      }
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

export const note = (line: string) =>
  Effect.gen(function* () {
    if (yield* isJson) return
    yield* Console.log(line)
  })

export const noteToStderr = (line: string) =>
  Effect.sync(() => {
    process.stderr.write(`${line}\n`)
  })
