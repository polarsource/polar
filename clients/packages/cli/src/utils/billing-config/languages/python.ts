import { dirname, join, resolve } from 'node:path'
import { Effect, type FileSystem } from 'effect'
import { BillingConfigError } from '@/schemas/BillingConfig'
import {
  ancestors,
  exists,
  findUp,
  type Installer,
  isEmpty,
  type Language,
  readSource,
  unwritable,
} from '@/utils/billing-config/languages/language'

export const PYTHON_MODULE = 'polar.config'
const PACKAGE = 'polar-sdk'
const MANIFEST = 'pyproject.toml'
const MISSING_MODULE = 'No module named polar'
const DETAIL_LINES = 12
const VENV_PYTHONS = ['.venv/bin/python', '.venv/Scripts/python.exe']
const DEPENDENCY = /["']polar-sdk\b/

const usesUv = (fs: FileSystem.FileSystem, directory: string) =>
  Effect.map(findUp(fs, directory, ['uv.lock']), (root) => root !== undefined)

const pythonCommand = (fs: FileSystem.FileSystem, directory: string) =>
  Effect.gen(function* () {
    if (yield* usesUv(fs, directory)) return ['uv', 'run', 'python']
    for (const root of ancestors(directory)) {
      for (const python of VENV_PYTHONS) {
        if (yield* exists(fs, join(root, python))) return [join(root, python)]
      }
    }
    return [process.platform === 'win32' ? 'python' : 'python3']
  })

const installer: Installer = {
  command: (fs, root) =>
    Effect.map(usesUv(fs, root), (uv) =>
      uv ? ['uv', 'add', PACKAGE] : ['pip', 'install', PACKAGE],
    ),
  installed: (fs, root) =>
    fs.readFileString(join(root, MANIFEST)).pipe(
      Effect.map((source) => DEPENDENCY.test(source)),
      Effect.orElseSucceed(() => false),
    ),
}

const detail = (stderr: string) => {
  const lines = stderr.trim().split('\n')
  const traceback = lines.findIndex((line) => line.startsWith('Traceback'))
  const kept =
    traceback === -1
      ? lines
      : lines
          .slice(traceback + 1)
          .filter((line) => /^\S/.test(line) || /^ {2}\S/.test(line))
          .filter((line) => !line.startsWith('  File '))
  return kept.slice(-DETAIL_LINES).join('\n')
}

const failure = (
  fs: FileSystem.FileSystem,
  file: string,
  directory: string,
  command: ReadonlyArray<string>,
  stderr: string,
) =>
  Effect.gen(function* () {
    if (stderr.includes(MISSING_MODULE)) {
      const install = yield* installer.command(fs, directory)
      return new BillingConfigError({
        message: `Could not load ${file}`,
        hint: `It imports ${PYTHON_MODULE}, which is not installed. Run ${install.join(' ')}.`,
      })
    }
    if (stderr.startsWith('Could not run ')) {
      return new BillingConfigError({
        message: `Could not load ${file}`,
        hint: `${stderr}. Install Python 3.11 or newer, or run from a project with a uv.lock or .venv.`,
      })
    }
    return new BillingConfigError({
      message: `Could not load ${file}`,
      hint: `${command.join(' ')} failed. ${detail(stderr)}`,
    })
  })

const STARTER = `from polar.config import BenefitSet, Config, Credits, Fixed, Flag, Free, Meter, MeterSet, Product, ProductSet, usd


class Meters(MeterSet):
    pass


class Benefits(BenefitSet):
    pass


class Products(ProductSet):
    pass


config = Config(meters=Meters, benefits=Benefits, products=Products)
`

export const python: Language = {
  format: 'py',
  extension: '.py',
  extensions: ['.py'],
  defaultFiles: ['polarfile.py'],
  manifest: MANIFEST,
  installer,
  load: (fs, run, file) =>
    Effect.gen(function* () {
      const source = yield* readSource(fs, file)
      const path = resolve(file)
      const directory = dirname(path)
      const command = [
        ...(yield* pythonCommand(fs, directory)),
        '-m',
        PYTHON_MODULE,
        path,
      ]
      const ran = yield* run(command, directory)
      if (!ran.ok) {
        return yield* yield* failure(fs, file, directory, command, ran.stderr)
      }
      const input = yield* Effect.try({
        try: () => JSON.parse(ran.stdout) as unknown,
        catch: () =>
          new BillingConfigError({
            message: `${file} did not produce a billing config`,
            hint: `${command.join(' ')} printed something other than JSON. Make sure the file does not print anything itself.`,
          }),
      })
      return { file, source, input, generated: true }
    }),
  render: (document) =>
    isEmpty(document)
      ? Effect.succeed(STARTER)
      : Effect.fail(
          unwritable('Python')(
            new Error(
              'Importing an existing catalog into polarfile.py is not supported yet.',
            ),
          ),
        ),
}
