import { BunServices } from '@effect/platform-bun'
import {
  type Cause,
  Console,
  Effect,
  Layer,
  Option,
  Queue,
  Stdio,
  Terminal,
} from 'effect'
import { Command } from 'effect/unstable/cli'
import { Environment as ApiEnvironment } from '@/services/api'

export const stripAnsi = (text: string) => Bun.stripANSI(text)

const noop = () => {}

export const captureConsole = () => {
  const lines: string[] = []
  const console: Console.Console = {
    assert: noop,
    clear: noop,
    count: noop,
    countReset: noop,
    debug: noop,
    dir: noop,
    dirxml: noop,
    error: noop,
    group: noop,
    groupCollapsed: noop,
    groupEnd: noop,
    info: noop,
    log: (...args) => {
      lines.push(stripAnsi(args.map(String).join(' ')))
    },
    table: noop,
    time: noop,
    timeEnd: noop,
    timeLog: noop,
    trace: noop,
    warn: noop,
  }
  return { lines, console }
}

const key = (
  name: string,
  modifiers: Partial<Terminal.Key> = {},
): Terminal.UserInput => ({
  input: Option.none(),
  key: { name, ctrl: false, meta: false, shift: false, ...modifiers },
})

export const keys = {
  enter: key('enter'),
  up: key('up'),
  down: key('down'),
  escape: key('escape'),
  ctrlC: key('c', { ctrl: true }),
  type: (text: string): Terminal.UserInput[] =>
    [...text].map((character) => ({
      input: Option.some(character),
      key: { name: character, ctrl: false, meta: false, shift: false },
    })),
}

const scriptedTerminal = (
  inputs: ReadonlyArray<Terminal.UserInput>,
  frames: string[],
) =>
  Terminal.make({
    columns: Effect.succeed(80),
    rows: Effect.succeed(24),
    readInput: Effect.gen(function* () {
      const queue = yield* Queue.unbounded<Terminal.UserInput, Cause.Done>()
      yield* Queue.offerAll(queue, inputs)
      yield* Queue.end(queue)
      return queue
    }),
    readLine: Effect.die('readLine is not scripted, pass input to runCli'),
    display: (text) =>
      Effect.sync(() => {
        frames.push(text)
      }),
  })

export interface RunCliOptions {
  interactive?: boolean
  input?: ReadonlyArray<Terminal.UserInput>
}

export const runCli = <Name extends string, Input, E, R, ContextInput>(
  command: Command.Command<Name, Input, ContextInput, E, R>,
  args: ReadonlyArray<string>,
  options: RunCliOptions = {},
) => {
  const { lines, console } = captureConsole()
  const frames: string[] = []
  const interactive = options.interactive ?? false
  const effect = Command.runWith(command, {
    version: '0.0.0',
    renderErrors: false,
  })(args).pipe(
    Effect.provideService(
      Terminal.Terminal,
      scriptedTerminal(options.input ?? [], frames),
    ),
    Effect.provide(
      Layer.mergeAll(
        BunServices.layer,
        Stdio.layerTest({
          stdinIsTerminal: Effect.succeed(interactive),
          stdoutIsTerminal: Effect.succeed(interactive),
        }),
      ),
    ),
    Effect.provideService(Console.Console, console),
    Effect.provideService(ApiEnvironment, {}),
  )
  return {
    effect,
    lines,
    output: () => lines.join('\n'),
    terminal: () => stripAnsi(frames.join('')),
  }
}
