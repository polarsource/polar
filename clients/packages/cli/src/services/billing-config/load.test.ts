import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { BunServices } from '@effect/platform-bun'
import { Effect, FileSystem } from 'effect'
import { loadFailure, loader } from '@/services/billing-config/load'

const source = [
  '{',
  '  "meters": [',
  '    {',
  '      "external_id": "tool-calls",',
  '      "filter": { "conjunction": "qwe", "clauses": [] }',
  '    }',
  '  ]',
  '}',
].join('\n')

const load = (file?: string) =>
  Effect.runPromise(
    Effect.gen(function* () {
      return yield* loader(yield* FileSystem.FileSystem)(file)
    }).pipe(Effect.provide(BunServices.layer)),
  )

let directory: string

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'polar-config-'))
})

afterEach(async () => {
  await rm(directory, { recursive: true, force: true })
})

const write = async (content: string, name = 'polar.json') => {
  const file = join(directory, name)
  await writeFile(file, content)
  return file
}

const failure = (promise: Promise<unknown>) =>
  promise.then(
    () => {
      throw new Error('expected failure')
    },
    (error: unknown) =>
      error as { _tag: string; message: string; hint?: string },
  )

describe('load', () => {
  test('keeps the source text next to the parsed JSON', async () => {
    const config = await load(await write(source))
    expect(config.source).toBe(source)
    expect(config.input).toEqual(JSON.parse(source))
    expect(config.generated).toBe(false)
  })

  test('evaluates the default export of a TypeScript file and keeps its source', async () => {
    const file = await write(
      [
        "const meter = { external_id: 'tool-calls' as const }",
        'export default { meters: [meter] }',
      ].join('\n'),
      'polar.config.ts',
    )
    const config = await load(file)
    expect(config.generated).toBe(true)
    expect(config.input).toEqual({ meters: [{ external_id: 'tool-calls' }] })
    expect(config.source).toContain("external_id: 'tool-calls' as const")
  })

  test('calls a default exported function, sync or async', async () => {
    const sync = await load(
      await write("export default () => ({ meters: ['sync'] })", 'sync.ts'),
    )
    const async = await load(
      await write(
        "export default async () => ({ meters: ['async'] })",
        'async.ts',
      ),
    )
    expect(sync.input).toEqual({ meters: ['sync'] })
    expect(async.input).toEqual({ meters: ['async'] })
  })

  test('reports a default exported function that throws', async () => {
    const error = await failure(
      load(
        await write(
          'export default () => { throw new Error("boom") }',
          'throws.ts',
        ),
      ),
    )
    expect(error.message).toContain('Could not load')
    expect(error.hint).toContain('boom')
  })

  test('requires a default exported object from a script', async () => {
    const error = await failure(
      load(await write('export const config = {}', 'polar.config.ts')),
    )
    expect(error.message).toContain('does not default export')
  })

  test('reports scripts that fail to load', async () => {
    const error = await failure(
      load(await write('throw new Error("boom")', 'polar.config.js')),
    )
    expect(error.message).toContain('Could not load')
    expect(error.hint).toContain('boom')
  })

  test('rejects unsupported file types', async () => {
    const error = await failure(load(await write('config = {}', 'polar.py')))
    expect(error.message).toContain('is not a supported config file')
    expect(error.hint).toContain('.json, .ts or .js')
  })

  test('reports invalid JSON', async () => {
    const error = await failure(load(await write('{ "meters": [')))
    expect(error._tag).toBe('BillingConfigError')
    expect(error.message).toContain('is not valid JSON')
  })

  test('says when the file does not exist', async () => {
    const error = await failure(load(join(directory, 'missing.ts')))
    expect(error.message).toBe(
      `${join(directory, 'missing.ts')} does not exist`,
    )
    expect(error.hint).toBeUndefined()
  })

  test('points at the line of a syntax error', () => {
    const bunBuildMessage = Object.assign(new Error('Unexpected end of file'), {
      position: { line: 2, column: 12, lineText: '  meters: (' },
    })
    const error = loadFailure('broken.ts', bunBuildMessage)
    expect(error.message).toBe('Could not parse broken.ts:2:12')
    expect(error.hint).toBe('Unexpected end of file')
  })

  test('tells you to install a package the script imports', async () => {
    const error = await failure(
      load(
        await write(
          "import { defineConfig } from '@polar-sh/nope'\nexport default defineConfig({})",
          'polar.config.ts',
        ),
      ),
    )
    expect(error.message).toContain('Could not load')
    expect(error.hint).toBe(
      'It imports @polar-sh/nope, which is not installed. Run npm install @polar-sh/nope.',
    )
  })
})

describe('load without a file', () => {
  const cwd = process.cwd()

  beforeEach(() => process.chdir(directory))
  afterEach(() => process.chdir(cwd))

  test('picks the first default file name that exists', async () => {
    await write(source)
    await write("export default { meters: ['ts'] }", 'polar.config.ts')
    const config = await load()
    expect(config.file).toBe('polar.config.ts')
    expect(config.input).toEqual({ meters: ['ts'] })
  })

  test('falls back to polar.json', async () => {
    await write(source)
    expect((await load()).file).toBe('polar.json')
  })

  test('fails when no default file exists', async () => {
    const error = await failure(load())
    expect(error.message).toContain('No billing config file found')
    expect(error.hint).toContain('polar.config.ts')
  })
})
