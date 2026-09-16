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
import { checksum, compile, type Ir } from '../config/compile'
import type { Config } from '../config/config'
import { toSource } from '../config/codegen'
import { normalizeIr, parseIr } from '../config/ir'
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

const CONFIG_FILES = ['void.ts', 'void.config.ts', 'void.mts', 'void.json']

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
  if (found.endsWith('.json')) {
    const text = yield* fs.readFileString(found)
    return yield* Effect.try({
      try: () => parseIr(JSON.parse(text)),
      catch: (cause) =>
        new ConfigError({
          path: found,
          message: cause instanceof Error ? cause.message : String(cause),
          cause,
        }),
    })
  }
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

/** A `void.json` deploys as the IR it holds; nothing in it comes from a plugin. */
const compiled = (
  source: Config | Ir,
): { ir: Ir; origins: ReadonlyMap<string, string> } =>
  isConfig(source)
    ? { ir: compile(source), origins: pluginOrigins(source) }
    : { ir: source, origins: new Map() }

export const reconcile = Effect.fn('cli.reconcile')(function* (
  command: 'plan' | 'deploy',
  source: Config | Ir,
  preview?: PricePreviewWindow,
  activate = false,
) {
  const api = yield* Api
  const { ir, origins } = compiled(source)
  const sum = checksum(ir)
  const deploy = yield* api.deploysCreate({
    payload: {
      checksum: sum,
      dry_run: command === 'plan',
      activate: command === 'deploy' && activate,
      reducers: ir.reducers,
      meters: ir.meters,
      entitlements: ir.entitlements,
      products: ir.products,
      ...(command === 'plan' && preview ? { preview } : {}),
    },
  })
  const styled = styleEnabled()
  yield* Console.log(`${soft('version', styled)} ${deploy.version_id}`)
  if (deploy.status)
    yield* Console.log(`${soft('status', styled)} ${deploy.status}`)
  const plan = describePlan(deploy.entries, styled, origins)
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

/**
 * Writes the deployed configuration to a file: the IR as `void.json`, which
 * deploys as it is, or best-effort TypeScript. The TypeScript is loaded back
 * and compiled so a version that would not round-trip is reported.
 */
export const pull = Effect.fn('cli.pull')(function* (
  load: Loader,
  options: {
    versionId?: string
    out?: string
    ts?: boolean
    force?: boolean
  },
) {
  const api = yield* Api
  const fs = yield* FileSystem.FileSystem
  const out = resolve(options.out ?? (options.ts ? 'void.ts' : 'void.json'))
  if (!options.force && (yield* fs.exists(out))) {
    return yield* new ConfigError({
      path: out,
      message: 'already exists; pass --force to overwrite it',
    })
  }
  const deployment = yield* api.deploysLatest({
    params: { version_id: options.versionId },
  })
  if (deployment.id === null) {
    return yield* new ConfigError({
      path: out,
      message: 'no deployment to pull',
    })
  }
  const ir = normalizeIr(
    yield* api.deploysConfiguration(deployment.id, undefined),
  )
  const styled = styleEnabled()
  yield* Console.log(`${soft('version', styled)} ${deployment.version_id}`)
  if (!options.ts) {
    yield* fs.writeFileString(out, `${JSON.stringify(ir, null, 2)}\n`)
    yield* Console.log(`wrote ${out}`)
    return
  }
  yield* fs.writeFileString(
    out,
    toSource(ir, { version: deployment.version_id }),
  )
  yield* Console.log(`wrote ${out}`)
  const roundTrip = yield* Effect.tryPromise(() =>
    load(pathToFileURL(out).href),
  ).pipe(
    Effect.map((module) => [module.config, module.default].find(isConfig)),
    Effect.map((config) =>
      config === undefined
        ? 'exports no config'
        : checksum(compile(config)) === checksum(ir)
          ? undefined
          : 'compiles to a different configuration',
    ),
    Effect.catch((cause) =>
      Effect.succeed(
        `could not be loaded: ${cause.cause instanceof Error ? cause.cause.message : String(cause.cause)}`,
      ),
    ),
  )
  if (roundTrip !== undefined)
    yield* Console.log(
      `warning: the generated config ${roundTrip}; review it before deploying`,
    )
})

export const activateDeployment = Effect.fn('cli.activate')(function* (
  id: string,
) {
  const api = yield* Api
  const deploy = yield* api.deploysActivate(id, undefined)
  const styled = styleEnabled()
  yield* Console.log(`${soft('version', styled)} ${deploy.version_id}`)
  yield* Console.log(`${soft('status', styled)} ${deploy.status}`)
  yield* Console.log(`activated deployment ${deploy.id}`)
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
      ...(name === 'deploy'
        ? {
            activate: Flag.boolean('activate').pipe(
              Flag.withDescription(
                'Make the deployment active once applied; requires a reviewed organization',
              ),
            ),
          }
        : {}),
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
      activate,
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
          yield* reconcile(name, config, preview, activate === true)
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

const activate = Command.make(
  'activate',
  {
    id: Flag.string('id').pipe(Flag.withDescription('Deployment id')),
    ...authFlags,
  },
  ({ id, apiUrl, token, profile }) =>
    Effect.gen(function* () {
      const credentials = yield* resolveCredentials(
        Option.getOrUndefined(apiUrl),
        Option.getOrUndefined(token),
        Option.getOrUndefined(profile),
      )
      yield* Effect.gen(function* () {
        yield* showTarget(credentials)
        yield* activateDeployment(id)
      }).pipe(
        Effect.provide(
          apiLayer({
            apiUrl: credentials.apiUrl,
            token: Redacted.value(credentials.token),
          }),
        ),
      )
    }),
).pipe(
  Command.withDescription(
    'Make a deployment the active configuration; the previous one is archived',
  ),
)

const pullCommand = (load: Loader) =>
  Command.make(
    'pull',
    {
      version: Flag.string('version').pipe(
        Flag.withDescription(
          'Configuration version to pull; defaults to the active deployment',
        ),
        Flag.optional,
      ),
      out: Flag.string('out').pipe(
        Flag.withDescription(
          'Output file; defaults to void.json, or void.ts with --ts',
        ),
        Flag.optional,
      ),
      ts: Flag.boolean('ts').pipe(
        Flag.withDescription('Write best-effort TypeScript instead of the IR'),
      ),
      force: Flag.boolean('force').pipe(
        Flag.withDescription('Overwrite the output file if it exists'),
      ),
      ...authFlags,
    },
    ({ version, out, ts, force, apiUrl, token, profile }) =>
      Effect.gen(function* () {
        const credentials = yield* resolveCredentials(
          Option.getOrUndefined(apiUrl),
          Option.getOrUndefined(token),
          Option.getOrUndefined(profile),
        )
        yield* Effect.gen(function* () {
          yield* showTarget(credentials)
          yield* pull(load, {
            versionId: Option.getOrUndefined(version),
            out: Option.getOrUndefined(out),
            ts,
            force,
          })
        }).pipe(
          Effect.provide(
            apiLayer({
              apiUrl: credentials.apiUrl,
              token: Redacted.value(credentials.token),
            }),
          ),
        )
      }),
  ).pipe(
    Command.withDescription(
      'Write the deployed configuration to void.json, or to void.ts with --ts',
    ),
  )

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
        'Apply the config as a draft deployment; --activate makes it live',
        load,
      ),
      activate,
      pullCommand(load),
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
