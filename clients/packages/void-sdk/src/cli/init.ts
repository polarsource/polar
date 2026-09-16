import { resolve } from 'node:path'
import { Console, Effect, FileSystem, Option } from 'effect'
import { Command, Flag, Prompt } from 'effect/unstable/cli'
import { ConfigError } from './config'
import {
  STORAGES,
  TEMPLATES,
  voidTs,
  type Storage,
  type Template,
} from './init-source'
import { soft, styleEnabled } from './style'

export {
  STORAGES,
  TEMPLATES,
  voidTs,
  type Storage,
  type Template,
} from './init-source'

const fail = (message: string) =>
  new ConfigError({ path: process.cwd(), message })

const listed = <T extends string>(
  value: string,
  allowed: readonly T[],
): value is T => (allowed as readonly string[]).includes(value)

const inTerminal = () =>
  process.stdin.isTTY === true && process.stdout.isTTY === true

const labeled = <T>(
  rows: ReadonlyArray<readonly [string, string, T]>,
  styled: boolean,
) => {
  const width = Math.max(...rows.map(([name]) => name.length))
  return rows.map(([name, hint, value]) => ({
    title: `${name.padEnd(width + 2)}${soft(hint, styled)}`,
    value,
  }))
}

const templatePrompt = (styled: boolean) =>
  Prompt.select<Template>({
    message: 'Choose a template, or blank',
    choices: labeled(
      [
        ['Usage', 'event, meter, and a product', 'usage'],
        ['LLM', 'token billing with the llm plugin', 'llm'],
        ['Credits', 'prepaid credit wallet', 'credits'],
        ['Blank', 'empty defineConfig', 'blank'],
      ],
      styled,
    ),
  })

const storagePrompt = (styled: boolean) =>
  Prompt.select<Storage>({
    message: 'Event storage?',
    choices: labeled(
      [
        ['None', 'schema only', 'none'],
        ['SQLite', 'local file void.db', 'sqlite'],
      ],
      styled,
    ),
  })

export const init = Effect.fn('cli.init')(function* (options: {
  readonly force: boolean
  readonly template?: string
  readonly storage?: string
}) {
  let template: Template
  if (options.template !== undefined) {
    if (!listed(options.template, TEMPLATES))
      return yield* fail(`--template must be ${TEMPLATES.join(', ')}`)
    template = options.template
  } else if (!inTerminal())
    return yield* fail(
      'Init needs a terminal to choose a template, or pass --template.',
    )
  else template = yield* templatePrompt(styleEnabled())

  let storage: Storage
  if (options.storage !== undefined) {
    if (!listed(options.storage, STORAGES))
      return yield* fail(`--storage must be ${STORAGES.join(', ')}`)
    storage = options.storage
  } else if (!inTerminal())
    return yield* fail(
      'Init needs a terminal to choose event storage, or pass --storage.',
    )
  else storage = yield* storagePrompt(styleEnabled())

  const fs = yield* FileSystem.FileSystem
  const out = resolve('void.ts')
  if (!options.force && (yield* fs.exists(out))) {
    if (!inTerminal())
      return yield* fail('already exists; pass --force to overwrite it')
    const overwrite = yield* Prompt.confirm({
      message: 'void.ts already exists. Overwrite?',
    })
    if (!overwrite) {
      yield* Console.log('skipped')
      return
    }
  }
  yield* fs.writeFileString(out, voidTs(template, storage))
  yield* Console.log(`wrote ${out}`)
})

export const initCommand = Command.make(
  'init',
  {
    template: Flag.string('template').pipe(
      Flag.withDescription('Template: blank, usage, llm, or credits'),
      Flag.optional,
    ),
    storage: Flag.string('storage').pipe(
      Flag.withDescription('Event storage: none or sqlite'),
      Flag.optional,
    ),
    force: Flag.boolean('force').pipe(
      Flag.withDescription('Overwrite void.ts if it exists'),
    ),
  },
  ({ force, template, storage }) =>
    init({
      force,
      template: Option.getOrUndefined(template),
      storage: Option.getOrUndefined(storage),
    }),
).pipe(
  Command.withDescription(
    'Create a void.ts config; asks for a template and event storage',
  ),
)
