import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { NodeServices } from '@effect/platform-node'
import {
  ConfigProvider,
  Console,
  Effect,
  FileSystem,
  Option,
  Redacted,
  Schema,
} from 'effect'
import { Command, Flag } from 'effect/unstable/cli'
import { FetchHttpClient } from 'effect/unstable/http'
import { Api } from '../api/index'
import { apiLayer } from '../api/layers'
import { checksum, compile } from '../config/compile'
import type { Config } from '../config/config'
import type { PricePreviewWindow } from '../api/generated'
import { describePlan, describeSummary } from './format'
import { PreviewError, previewWindow } from './preview'
import { soft, styleEnabled } from './style'

import { resolveCredentials } from './credentials'
import {
  authFlags,
  login,
  logout,
  profiles,
  showTarget,
  switchProfile,
  whoami,
} from './auth'

const CONFIG_FILES = ['void.ts', 'void.config.ts', 'void.mts']

export type Loader = (url: string) => Promise<Record<string, unknown>>

/** The config module could not be found, loaded, or does not export a config. */
export class ConfigError extends Schema.TaggedError<ConfigError>()(
  'ConfigError',
  {
    path: Schema.String,
    message: Schema.String,
    cause: Schema.optionalKey(Schema.Defect()),
  },
) {}

const isConfig = (value: unknown): value is Config =>
  typeof value === 'object' &&
  value !== null &&
  'kind' in value &&
  value.kind === 'config'

export const loadConfig = Effect.fn('cli.loadConfig')(function* (
  file: Option.Option<string>,
  load: Loader,
) {
  const fs = yield* FileSystem.FileSystem
  let path = Option.getOrUndefined(Option.map(file, (f) => resolve(f)))
  for (const candidate of CONFIG_FILES) {
    if (path) break
    if (yield* fs.exists(resolve(candidate))) path = resolve(candidate)
  }
  if (!path) {
    return yield* new ConfigError({
      path: process.cwd(),
      message: `no config found; looked for ${CONFIG_FILES.join(', ')}`,
    })
  }
  const found = path
  const module = yield* Effect.tryPromise({
    try: () => load(pathToFileURL(found).href),
    catch: (cause) =>
      new ConfigError({
        path: found,
        message: cause instanceof Error ? cause.message : String(cause),
        cause,
      }),
  })
  const config = [module.config, module.default].find(isConfig)
  if (!config) {
    return yield* new ConfigError({
      path: found,
      message: 'exports no config; export defineConfig(...) as `config`',
    })
  }
  return config
})

/** Every slug a plugin contributes, mapped to the plugin's name. */
export const pluginOrigins = (config: Config): ReadonlyMap<string, string> =>
  new Map(
    config.plugins.flatMap((plugin) =>
      Object.values(plugin.schema).flatMap((definition) => {
        const slug = 'key' in definition ? definition.key : definition.name
        if (slug === undefined) return []
        // Deployment creates `<reducer>-credits` when a meter names no credit reducer.
        const inner =
          definition.kind === 'meter'
            ? [
                definition.reducer.key,
                definition.creditReducer?.key ??
                  `${definition.reducer.key}-credits`,
              ]
            : []
        return [slug, ...inner]
          .filter((s): s is string => s !== undefined)
          .map((s): [string, string] => [s, plugin.name])
      }),
    ),
  )

export const reconcile = Effect.fn('cli.reconcile')(function* (
  command: 'plan' | 'deploy',
  config: Config,
  preview?: PricePreviewWindow,
) {
  const api = yield* Api
  const ir = compile(config)
  const sum = checksum(ir)
  const deploy = yield* api.deploysCreate({
    payload: {
      checksum: sum,
      dry_run: command === 'plan',
      reducers: ir.reducers,
      meters: ir.meters,
      entitlements: ir.entitlements,
      products: ir.products,
      ...(command === 'plan' && preview ? { preview } : {}),
    },
  })
  const styled = styleEnabled()
  yield* Console.log(
    `${soft('variant', styled)} ${deploy.variant_id ?? 'unavailable'}`,
  )
  const plan = describePlan(deploy.entries, styled, pluginOrigins(config))
  if (plan) yield* Console.log(`\n${plan}`)
  yield* Console.log('')
  yield* Console.log(
    describeSummary(
      deploy.entries,
      deploy.applied ? (deploy.id ?? undefined) : undefined,
      styled,
    ),
  )
})

const flags = {
  config: Flag.string('config').pipe(
    Flag.withDescription('Config module; defaults to void.ts'),
    Flag.optional,
  ),
  ...authFlags,
}

const command = (name: 'plan' | 'deploy', description: string, load: Loader) =>
  Command.make(
    name,
    {
      ...flags,
      ...(name === 'plan'
        ? {
            from: Flag.string('from').pipe(
              Flag.withDescription('Inclusive UTC date, YYYY-MM-DD'),
              Flag.optional,
            ),
            to: Flag.string('to').pipe(
              Flag.withDescription('Exclusive UTC date, YYYY-MM-DD'),
              Flag.optional,
            ),
            preview: Flag.boolean('preview').pipe(
              Flag.withDescription(
                'Compare usage prices over a historical window',
              ),
            ),
            noPreview: Flag.boolean('no-preview').pipe(
              Flag.withDescription('Skip the usage price comparison'),
            ),
          }
        : {}),
    },
    ({
      config: file,
      apiUrl,
      token,
      profile,
      from,
      to,
      preview: requestedPreview,
      noPreview,
    }) =>
      Effect.gen(function* () {
        const start =
          from === undefined ? undefined : Option.getOrUndefined(from)
        const end = to === undefined ? undefined : Option.getOrUndefined(to)
        const wantsPreview =
          requestedPreview || start !== undefined || end !== undefined
        if (noPreview && wantsPreview)
          return yield* new PreviewError({
            message:
              '--no-preview cannot be combined with --preview, --from or --to.',
          })
        const preview =
          name === 'plan' && wantsPreview
            ? yield* previewWindow(start, end)
            : undefined
        const config = yield* loadConfig(file, load)
        const credentials = yield* resolveCredentials(
          Option.getOrUndefined(apiUrl),
          Option.getOrUndefined(token),
          Option.getOrUndefined(profile),
        )
        yield* Effect.gen(function* () {
          yield* showTarget(credentials)
          yield* reconcile(name, config, preview)
        }).pipe(
          Effect.provide(
            apiLayer({
              apiUrl: credentials.apiUrl,
              token: Redacted.value(credentials.token),
            }),
          ),
        )
      }),
  ).pipe(Command.withDescription(description))

const cli = (load: Loader) =>
  Command.make('void').pipe(
    Command.withDescription('Deploy a void config'),
    Command.withSubcommands([
      login,
      logout,
      whoami,
      profiles,
      switchProfile,
      command('plan', 'Show config changes; writes nothing', load),
      command(
        'deploy',
        'Apply the config to reducers, meters, entitlements and products',
        load,
      ),
    ]),
  )

export const run = (argv: ReadonlyArray<string>, load: Loader): Promise<void> =>
  Effect.runPromise(
    Command.runWith(cli(load), { version: '0.0.0' })(argv).pipe(
      Effect.tapError((error) => Console.error(error.message)),
      Effect.provideService(
        ConfigProvider.ConfigProvider,
        ConfigProvider.fromEnv(),
      ),
      Effect.provideService(FetchHttpClient.Fetch, globalThis.fetch),
      Effect.provide(NodeServices.layer),
    ),
  )
