import { Effect, FileSystem, Path } from 'effect'
import { AuthError } from '@/schemas/Auth'
import { ENVIRONMENT_VARS } from '@/services/token-handoff'
import { exec } from '@/services/updater'
import { hasEnv, upsertEnv } from '@/utils/env-file'

export const defaultEnvFile = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const local = path.resolve('.env.local')
  const exists = yield* fs.exists(local).pipe(Effect.orElseSucceed(() => false))
  return exists ? local : path.resolve('.env')
})

export const writeEnv = (
  file: string,
  settings: ReadonlyArray<readonly [string, string]>,
) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    let content = yield* fs
      .readFileString(file)
      .pipe(
        Effect.catch((error) =>
          error.reason._tag === 'NotFound'
            ? Effect.succeed('')
            : Effect.fail(error),
        ),
      )
    const written: Array<{ name: string; replaced: boolean }> = []
    for (const [name, value] of settings) {
      const result = upsertEnv(content, name, value)
      content = result.content
      written.push({ name, replaced: result.replaced })
    }
    yield* fs.writeFileString(file, content, { mode: 0o600 })
    const stale = ENVIRONMENT_VARS.filter(
      (name) =>
        hasEnv(content, name) && !settings.some(([key]) => key === name),
    )
    return { written, stale }
  }).pipe(
    Effect.mapError(
      () =>
        new AuthError({
          message: `Unable to write the token to ${file}. Check its permissions. The token was created; revoke it from the dashboard if you can't recover it.`,
        }),
    ),
  )

export const isExposedToGit = (file: string) =>
  Effect.gen(function* () {
    const path = yield* Path.Path
    const result = yield* exec([
      'git',
      '-C',
      path.dirname(file),
      'check-ignore',
      '--quiet',
      '--',
      path.basename(file),
    ])
    return result.code === 1
  }).pipe(Effect.orElseSucceed(() => false))
