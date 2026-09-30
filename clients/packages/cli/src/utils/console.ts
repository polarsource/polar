import { format } from 'node:util'
import type { Console } from 'effect'

export const stdoutConsole: Console.Console = Object.assign(
  Object.create(globalThis.console) as Console.Console,
  {
    log: (...args: ReadonlyArray<unknown>) => {
      process.stdout.write(`${format(...args)}\n`)
    },
  },
)
