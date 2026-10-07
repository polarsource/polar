import { Console, Duration, Effect, Exit, Stdio } from 'effect'
import yoctoSpinner from 'yocto-spinner'
import * as ui from '@/utils/ui'

export interface Progress {
  readonly start: (text: string) => Effect.Effect<void>
  readonly finish: (detail?: string) => Effect.Effect<void>
}

const FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']

export const formatDuration = (duration: Duration.Duration) =>
  `${Math.round(Duration.toMillis(duration) / 1000)}s`

const line = (mark: string, text: string, detail?: string) =>
  `${ui.INDENT}${mark} ${text}${detail ? ` ${ui.dim(detail)}` : ''}`

const make = (interactive: boolean) => {
  const spinner = yoctoSpinner({
    stream: process.stdout,
    spinner: {
      frames: FRAMES.map((frame) => `${ui.INDENT}${frame}`),
      interval: 80,
    },
  })
  let current: string | undefined
  let timer: ReturnType<typeof setInterval> | undefined

  const settle = (mark: string, detail?: string) =>
    Effect.gen(function* () {
      if (current === undefined) return
      const text = current
      current = undefined
      yield* Effect.sync(() => {
        clearInterval(timer)
        spinner.stop()
      })
      yield* Console.log(line(mark, text, detail))
    })

  const begin = (text: string) =>
    Effect.sync(() => {
      current = text
      if (!interactive) return
      const startedAt = Date.now()
      const elapsed = () =>
        `${text} ${ui.dim(formatDuration(Duration.millis(Date.now() - startedAt)))}`
      spinner.start(elapsed())
      timer = setInterval(() => {
        spinner.text = elapsed()
      }, 1000)
    })

  const progress: Progress = {
    start: (text) => Effect.andThen(settle(ui.green('✔')), begin(text)),
    finish: (detail) => settle(ui.green('✔'), detail),
  }
  return { progress, fail: settle(ui.red('✖')) }
}

export const withProgress = <A, E, R>(
  run: (progress: Progress) => Effect.Effect<A, E, R>,
) =>
  Effect.gen(function* () {
    const stdio = yield* Stdio.Stdio
    const { progress, fail } = make(yield* stdio.stdoutIsTerminal)
    return yield* run(progress).pipe(
      Effect.onExit((exit) =>
        Exit.isSuccess(exit) ? progress.finish() : fail,
      ),
    )
  })
