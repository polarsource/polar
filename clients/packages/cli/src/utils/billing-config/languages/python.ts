import { dirname, resolve } from 'node:path'
import { Effect } from 'effect'
import { BillingConfigError } from '@/schemas/BillingConfig'
import {
  findUp,
  type Loader,
  readSource,
} from '@/utils/billing-config/languages/language'

const PYTHON = process.platform === 'win32' ? 'python' : 'python3'

const MISSING_SDK = /No module named '?polar(?:\.config)?'?\)?$/
const FRAME = /File "([^"]+)", line (\d+)/g

const loadFailure = (file: string, script: string, stderr: string) => {
  const reason = stderr.trim().split('\n').at(-1)!.replaceAll(script, file)
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

export const python: Loader = {
  extensions: ['.py'],
  defaultFiles: ['polar_config.py'],
  load: (fs, run, file) =>
    Effect.gen(function* () {
      const source = yield* readSource(fs, file)
      const script = resolve(file)
      const directory = dirname(script)
      const uv = yield* findUp(fs, directory, ['uv.lock'])
      const interpreter =
        uv === undefined
          ? [PYTHON]
          : ['uv', 'run', '--project', directory, 'python']
      const ran = yield* run(
        [...interpreter, '-m', 'polar.config', 'load', script],
        process.cwd(),
      )
      if (!ran.ok) return yield* loadFailure(file, script, ran.stderr)
      const input = yield* Effect.try({
        try: () => JSON.parse(ran.stdout) as unknown,
        catch: () =>
          new BillingConfigError({
            message: `${file} did not produce a billing config`,
            hint: 'Assign a Config to a variable named `config` and let the file run to its end.',
          }),
      })
      return { file, source, input, generated: true }
    }),
}
