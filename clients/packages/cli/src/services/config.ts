import { homedir } from 'node:os'
import { Context, Effect, FileSystem, Layer, Path, Schema } from 'effect'
import { AuthError, OrganizationSelection } from '@/schemas/Auth'

const ConfigFile = Schema.Struct({
  activeOrganization: Schema.optional(OrganizationSelection),
})

export class CLIConfig extends Context.Service<
  CLIConfig,
  {
    getActiveOrganization: Effect.Effect<
      OrganizationSelection | undefined,
      AuthError
    >
    setActiveOrganization: (
      selection: OrganizationSelection | undefined,
    ) => Effect.Effect<void, AuthError>
  }
>()('CLIConfig') {}

const sameSelection = (
  a: OrganizationSelection | undefined,
  b: OrganizationSelection | undefined,
) => a?.id === b?.id && a?.environment === b?.environment

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
      getActiveOrganization: Effect.map(
        read,
        (config) => config?.activeOrganization,
      ),
      setActiveOrganization: (selection) =>
        Effect.gen(function* () {
          const config = yield* read
          if (
            config?.activeOrganization !== undefined &&
            sameSelection(config.activeOrganization, selection)
          )
            return
          if (config === undefined && selection === undefined) return
          yield* fs.makeDirectory(directory, { recursive: true })
          yield* fs.writeFileString(
            file,
            `${JSON.stringify({ activeOrganization: selection }, null, 2)}\n`,
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
