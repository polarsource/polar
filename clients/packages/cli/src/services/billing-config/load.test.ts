import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { BunServices } from '@effect/platform-bun'
import { Effect, FileSystem } from 'effect'
import { loader } from '@/services/billing-config/load'
import { loadFailure } from '@/utils/billing-config/languages/typescript'
import type { Ran, Run } from '@/utils/run'

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

const load = (file?: string, run?: Run) =>
  Effect.runPromise(
    Effect.gen(function* () {
      return yield* loader(yield* FileSystem.FileSystem, run)(file)
    }).pipe(Effect.provide(BunServices.layer)),
  )

let directory: string

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'polar-sdk-'))
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
    const error = await failure(load(await write('meters: []', 'polar.yaml')))
    expect(error.message).toContain('is not a supported config file')
    expect(error.hint).toBe('Use a .ts, .py, .json or .js file.')
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

describe('load a Python file', () => {
  const python = 'from polar.config import Config\nconfig = Config()\n'

  const runner = (ran: Partial<Ran>) => {
    const calls: Array<{ command: ReadonlyArray<string>; cwd: string }> = []
    const run: Run = (command, cwd) => {
      calls.push({ command, cwd })
      return Effect.succeed({ ok: true, stdout: '', stderr: '', ...ran })
    }
    return { run, calls }
  }

  test('runs the file through python -m polar.config and keeps its source', async () => {
    const file = await write(python, 'polarfile.py')
    const { run, calls } = runner({ stdout: '{"meters": []}\n' })

    const config = await load(file, run)

    expect(calls).toEqual([
      {
        command: ['python3', '-m', 'polar.config', file],
        cwd: directory,
      },
    ])
    expect(config).toEqual({
      file,
      source: python,
      input: { meters: [] },
      generated: true,
    })
  })

  test('prefers uv, then a virtualenv, next to the file', async () => {
    const file = await write(python, 'polarfile.py')
    await writeFile(join(directory, 'uv.lock'), '')
    const uv = runner({ stdout: '{}' })
    await load(file, uv.run)
    expect(uv.calls[0]!.command.slice(0, 3)).toEqual(['uv', 'run', 'python'])

    await rm(join(directory, 'uv.lock'))
    await mkdir(join(directory, '.venv/bin'), { recursive: true })
    await writeFile(join(directory, '.venv/bin/python'), '')
    const venv = runner({ stdout: '{}' })
    await load(file, venv.run)
    expect(venv.calls[0]!.command[0]).toBe(join(directory, '.venv/bin/python'))
  })

  test('tells you to install polar.config', async () => {
    const file = await write(python, 'polarfile.py')
    const { run } = runner({
      ok: false,
      stderr: '/usr/bin/python3: No module named polar\n',
    })

    const error = await failure(load(file, run))

    expect(error.message).toBe(`Could not load ${file}`)
    expect(error.hint).toBe(
      'It imports polar.config, which is not installed. Run pip install polar-sdk.',
    )
  })

  test('keeps the error and drops the traceback when the file fails', async () => {
    const file = await write(python, 'polarfile.py')
    const { run } = runner({
      ok: false,
      stderr: [
        'Traceback (most recent call last):',
        '  File "<frozen runpy>", line 198, in _run_module_as_main',
        '    return _run_code(code, main_globals, None,',
        '  File "polarfile.py", line 2, in <module>',
        '    config = Config(products=[Product(external_id="p", name="x", prices=[])])',
        'pydantic_core._pydantic_core.ValidationError: 2 validation errors for Product',
        'name',
        '  String should have at least 3 characters [type=string_too_short]',
        'prices',
        '  List should have at least 1 item after validation [type=too_short]',
        '',
      ].join('\n'),
    })

    const error = await failure(load(file, run))

    expect(error.hint).toBe(
      [
        `python3 -m polar.config ${file} failed. pydantic_core._pydantic_core.ValidationError: 2 validation errors for Product`,
        'name',
        '  String should have at least 3 characters [type=string_too_short]',
        'prices',
        '  List should have at least 1 item after validation [type=too_short]',
      ].join('\n'),
    )
  })

  test('says when python is missing', async () => {
    const file = await write(python, 'polarfile.py')
    const { run } = runner({ ok: false, stderr: 'Could not run python3' })

    const error = await failure(load(file, run))

    expect(error.hint).toBe(
      'Could not run python3. Install Python 3.11 or newer, or run from a project with a uv.lock or .venv.',
    )
  })

  test('complains when the file prints something else', async () => {
    const file = await write(python, 'polarfile.py')
    const { run } = runner({ stdout: 'hello\n{}' })

    const error = await failure(load(file, run))

    expect(error.message).toBe(`${file} did not produce a billing config`)
    expect(error.hint).toContain('Make sure the file does not print anything')
  })

  test.skipIf(Bun.which('python3') === null)(
    'really runs python with the module found next to the file',
    async () => {
      await mkdir(join(directory, 'polar'))
      await writeFile(join(directory, 'polar/__init__.py'), '')
      await writeFile(
        join(directory, 'polar/config.py'),
        [
          'import json, runpy, sys',
          'ns = runpy.run_path(sys.argv[1])',
          'print(json.dumps(ns["config"]))',
        ].join('\n'),
      )
      const file = await write('config = {"meters": ["py"]}\n', 'polarfile.py')

      expect((await load(file)).input).toEqual({ meters: ['py'] })
    },
  )
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
