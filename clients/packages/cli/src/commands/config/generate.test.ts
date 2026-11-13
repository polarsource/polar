import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Cause, Effect, Exit } from 'effect'
import { generate } from '@/commands/config/generate'
import type { BillingConfigError } from '@/schemas/BillingConfig'
import { BillingConfig } from '@/services/billing-config/service'
import { runCli, stripAnsi } from '@/utils/test-utils/cli'

const CONFIG = { meters: [{ external_id: 'tool_call' }] }

let directory: string

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'polar-generate-'))
})

afterEach(async () => {
  await rm(directory, { recursive: true, force: true })
})

const run = async (
  args: ReadonlyArray<string> = [],
  input: unknown = CONFIG,
) => {
  const cli = runCli(generate, args)
  const exit = await Effect.runPromiseExit(
    cli.effect.pipe(
      Effect.provideService(
        BillingConfig,
        BillingConfig.of({
          load: () =>
            Effect.succeed({
              file: join(directory, 'polar.config.json'),
              source: '',
              input,
              generated: false,
            }),
          plan: () => Effect.die('unused'),
          apply: () => Effect.die('unused'),
          init: () => Effect.die('unused'),
          install: () => Effect.die('unused'),
          disable: () => Effect.die('unused'),
          deprecations: () => Effect.die('unused'),
          prune: () => Effect.die('unused'),
          catalogs: () => Effect.die('unused'),
          publish: () => Effect.die('unused'),
        }),
      ),
    ),
  )
  return { output: stripAnsi(cli.output()), exit }
}

const failure = (exit: Exit.Exit<unknown, unknown>) =>
  Exit.isFailure(exit)
    ? (Cause.squash(exit.cause) as BillingConfigError)
    : undefined

const at = (...path: ReadonlyArray<string>) => join(directory, ...path)

const read = (...path: ReadonlyArray<string>) => readFile(at(...path), 'utf8')

describe('polar config generate', () => {
  test('writes Python next to the config', async () => {
    const { output, exit } = await run()

    expect(Exit.isSuccess(exit)).toBe(true)
    expect(await read('polar_types.py')).toContain(
      'tool_call: typing.Final = "tool_call"',
    )
    expect(output).toContain(
      'polar_types.py written: 1 meter, 0 benefits, 0 products, 0 events',
    )
  })

  test('accepts python for the language', async () => {
    const { exit } = await run(['--language', 'python'])

    expect(Exit.isSuccess(exit)).toBe(true)
  })

  test('writes to --out, creating its directory', async () => {
    await run(['--out', at('src', 'billing', 'names.py')])

    expect(await read('src', 'billing', 'names.py')).toContain('class Meters:')
  })

  test('refuses an --out that is not a file of the language', async () => {
    const { exit } = await run(['--out', at('names.ts')])

    expect(failure(exit)?.hint).toBe('Give --out a path that ends in .py.')
  })

  test('never replaces a file it did not write', async () => {
    await writeFile(at('app.py'), 'print("mine")\n')

    const { exit } = await run(['--out', at('app.py')])

    expect(failure(exit)?.message).toContain(
      'exists and was not written by polar config generate',
    )
    expect(await read('app.py')).toBe('print("mine")\n')
  })

  test('replaces a file it wrote earlier', async () => {
    await run()

    const { output } = await run([], {
      meters: [{ external_id: 'api_call' }],
    })

    expect(output).toContain('polar_types.py written')
    expect(await read('polar_types.py')).toContain('api_call')
  })

  test('says so when the file is already up to date', async () => {
    await run()

    const { output } = await run()

    expect(output).toContain('polar_types.py is up to date')
  })

  test('refuses a config it cannot read names from', async () => {
    const { exit } = await run([], { meters: [{ external_Id: 'tool_call' }] })

    expect(failure(exit)?.hint).toBe(
      'meters[0] has no external_id. Run polar config plan to see what to fix.',
    )
    await expect(read('polar_types.py')).rejects.toThrow()
  })

  test('prints what it did as JSON', async () => {
    const { output } = await run(['--json'])

    expect(JSON.parse(output)).toEqual({
      file: at('polar_types.py'),
      language: 'py',
      status: 'written',
      command: 'polar config generate',
      events: 0,
      meters: 1,
      benefits: 0,
      products: 0,
    })
  })

  test('with --check, fails on a missing file and says how to create it there', async () => {
    const out = at('src', 'names.py')

    const { exit } = await run(['--out', out, '--check'])

    expect(failure(exit)).toMatchObject({
      message: `${out} has not been generated`,
      hint: `Run polar config generate --out ${out} and commit the result.`,
    })
    await expect(read('src', 'names.py')).rejects.toThrow()
  })

  test('with --check, fails on a stale file and leaves it alone', async () => {
    await writeFile(at('polar_types.py'), 'stale')

    const { exit } = await run(['--check'])

    expect(failure(exit)?.message).toContain('is out of date')
    expect(await read('polar_types.py')).toBe('stale')
  })

  test('with --check, passes on a file it would write the same way', async () => {
    await run()

    const { exit } = await run(['--check'])

    expect(Exit.isSuccess(exit)).toBe(true)
  })
})
