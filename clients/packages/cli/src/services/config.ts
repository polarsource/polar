import { homedir } from 'node:os'
import { Context, Effect, FileSystem, Layer, Path, Schema } from 'effect'
import { AuthError, type PolarEnvironment } from '@/schemas/Auth'

const EnvironmentConfig = Schema.Struct({
  activeOrganizationId: Schema.optional(Schema.String),
})
const ConfigFile = Schema.Struct({
  sandbox: Schema.optional(EnvironmentConfig),
  production: Schema.optional(EnvironmentConfig),
})

export class CLIConfig extends Context.Service<
  CLIConfig,
  {
    getActiveOrganization: (
      environment: PolarEnvironment,
    ) => Effect.Effect<string | undefined, AuthError>
    setActiveOrganization: (
      environment: PolarEnvironment,
      id: string | undefined,
    ) => Effect.Effect<void, AuthError>
  }
>()('CLIConfig') {}

export const layer = Layer.effect(
  CLIConfig,
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const directory = path.join(
      process.platform === 'win32'
        ? process.env['APPDATA'] || path.join(homedir(), 'AppData', 'Roaming')
        : process.env['XDG_CONFIG_HOME'] || path.join(homedir(), '.config'),
      'polar-cli',
    )
    const file = path.join(directory, 'config.json')
    const read = Effect.gen(function* () {
      const content = yield* fs.readFileString(file).pipe(
        Effect.catch((error) =>
          error.reason._tag === 'NotFound'
            ? Effect.void
            : Effect.fail(
                new AuthError({
                  message: `Unable to read ${file}. Check its permissions.`,
                }),
              ),
        ),
      )
      if (content === undefined) return undefined
      return yield* Schema.decodeUnknownEffect(
        Schema.fromJsonString(ConfigFile),
      )(content).pipe(
        Effect.mapError(
          () =>
            new AuthError({
              message: `Invalid config in ${file}. Fix or remove the file and select your organization again.`,
            }),
        ),
      )
    })
    return CLIConfig.of({
      getActiveOrganization: (environment) =>
        Effect.gen(function* () {
          const config = yield* read
          return config?.[environment]?.activeOrganizationId
        }),
      setActiveOrganization: (environment, id) =>
        Effect.gen(function* () {
          const config = yield* read
          if (config?.[environment]?.activeOrganizationId === id) return
          const updated = {
            ...config,
            [environment]: {
              ...config?.[environment],
              activeOrganizationId: id,
            },
          }
          yield* fs.makeDirectory(directory, { recursive: true })
          yield* fs.writeFileString(
            file,
            `${JSON.stringify(updated, null, 2)}\n`,
          )
        }).pipe(
          Effect.mapError((error) =>
            error instanceof AuthError
              ? error
              : new AuthError({
                  message: `Unable to write ${file}. Check its permissions.`,
                }),
          ),
        ),
    })
  }),
)
