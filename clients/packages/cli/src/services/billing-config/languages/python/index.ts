import { dirname, resolve } from 'node:path'
import { Effect, type FileSystem, Schema } from 'effect'
import {
  BillingConfigError,
  CONFIG_FILES,
  SourcePositions,
} from '@/schemas/BillingConfig'
import {
  findUp,
  type Language,
  locateByPositions,
  readSource,
  unwritable,
} from '@/services/billing-config/languages/language'

const PYTHON = process.platform === 'win32' ? 'python' : 'python3'

const MISSING_SDK = /No module named '?polar(?:\.config)?'?\)?$/
const FRAME = /File "([^"]+)", line (\d+)/g

const Loaded = Schema.Struct({
  config: Schema.Unknown,
  positions: SourcePositions,
})

const lastLine = (stderr: string) => stderr.trim().split('\n').at(-1)!

const polarConfig = (
  fs: FileSystem.FileSystem,
  directory: string,
  command: ReadonlyArray<string>,
) =>
  Effect.gen(function* () {
    const uv = yield* findUp(fs, directory, ['uv.lock'])
    const interpreter =
      uv === undefined
        ? [PYTHON]
        : ['uv', 'run', '--project', directory, 'python']
    return [...interpreter, '-m', 'polar.config', ...command]
  })

const loadFailure = (file: string, script: string, stderr: string) => {
  const reason = lastLine(stderr).replaceAll(script, file)
  if (MISSING_SDK.test(reason)) {
    return new BillingConfigError({
      message: `Could not load ${file}`,
      hint: 'It needs polar.config, which is not installed. Install or upgrade polar-sdk.',
    })
  }
  const line = [...stderr.matchAll(FRAME)].findLast(
    ([, path]) => path === script,
  )?.[2]
  return new BillingConfigError({
    message:
      line === undefined
        ? `Could not load ${file}`
        : `Could not load ${file}:${line}`,
    hint: reason,
  })
}

const renderFailure = (stderr: string) => {
  const reason = lastLine(stderr)
  return MISSING_SDK.test(reason)
    ? new BillingConfigError({
        message:
          'A Python config is written by polar.config, which is not installed',
        hint: 'Install or upgrade polar-sdk and run polar config init again, or pass --format json.',
      })
    : unwritable('Python')(new Error(reason))
}

export const python: Language = {
  title: 'Python',
  format: 'py',
  extension: '.py',
  extensions: ['.py'],
  defaultFiles: CONFIG_FILES.py,
  manifest: 'pyproject.toml',
  installer: undefined,
  load: (fs, run, file) =>
    Effect.gen(function* () {
      const source = yield* readSource(fs, file)
      const script = resolve(file)
      const ran = yield* run(
        yield* polarConfig(fs, dirname(script), ['load', script]),
        process.cwd(),
      )
      if (!ran.ok) return yield* loadFailure(file, script, ran.stderr)
      const { config, positions } = yield* Effect.try(
        () => JSON.parse(ran.stdout) as unknown,
      ).pipe(
        Effect.flatMap(Schema.decodeUnknownEffect(Loaded)),
        Effect.mapError(
          () =>
            new BillingConfigError({
              message: `${file} did not produce a billing config`,
              hint: 'Assign a Config to a variable named `config`, let the file run to its end, and keep polar-sdk up to date.',
            }),
        ),
      )
      return { file, source, input: config, generated: true, positions }
    }),
  render: (document, { fs, run, path }) =>
    Effect.gen(function* () {
      const ran = yield* run(
        yield* polarConfig(fs, dirname(resolve(path)), ['render']),
        process.cwd(),
        JSON.stringify(document),
      )
      return ran.ok ? ran.stdout : yield* renderFailure(ran.stderr)
    }),
  locate: ({ positions }, path, got, target) =>
    locateByPositions(positions, path, got, target),
  remove: undefined,
}
