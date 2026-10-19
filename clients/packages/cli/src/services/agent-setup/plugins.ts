import { Effect, Schema, SchemaGetter } from 'effect'
import {
  AgentSetupError,
  type Client,
  type ClientStatus,
} from '@/schemas/AgentSetup'
import type { Exec } from '@/services/updater'
import { TOOLKIT_REPOSITORY } from '@/services/agent-setup/skills'

const MARKETPLACE = 'polar'
export const PLUGIN = `polar@${MARKETPLACE}`

const LIST_TIMEOUT = 15_000
const INSTALL_TIMEOUT = 3 * 60_000

const Plugins = Schema.Array(
  Schema.Struct({
    id: Schema.String,
    version: Schema.optional(Schema.String),
    installed: Schema.optional(Schema.Boolean),
  }),
)
const Marketplaces = Schema.Array(Schema.Struct({ name: Schema.String }))

const CodexPlugins = Schema.Struct({
  installed: Schema.Array(
    Schema.Struct({
      pluginId: Schema.String,
      version: Schema.optional(Schema.String),
      installed: Schema.optional(Schema.Boolean),
    }),
  ),
}).pipe(
  Schema.decodeTo(Plugins, {
    decode: SchemaGetter.transform(({ installed }) =>
      installed.map(({ pluginId, ...plugin }) => ({ id: pluginId, ...plugin })),
    ),
    encode: SchemaGetter.forbiddenEncoding,
  }),
)
const CodexMarketplaces = Schema.Struct({ marketplaces: Marketplaces }).pipe(
  Schema.decodeTo(Marketplaces, {
    decode: SchemaGetter.transform(({ marketplaces }) => marketplaces),
    encode: SchemaGetter.forbiddenEncoding,
  }),
)

export interface PluginClient {
  readonly client: Client
  readonly name: string
  readonly binary: string
  readonly plugins: Schema.Codec<typeof Plugins.Type, unknown>
  readonly marketplaces: Schema.Codec<typeof Marketplaces.Type, unknown>
  readonly refresh: 'update' | 'upgrade'
  readonly install: (installed: boolean) => 'install' | 'update' | 'add'
}

export const claude: PluginClient = {
  client: 'claude-code',
  name: 'Claude Code',
  binary: 'claude',
  plugins: Plugins,
  marketplaces: Marketplaces,
  refresh: 'update',
  install: (installed) => (installed ? 'update' : 'install'),
}

export const codex: PluginClient = {
  client: 'codex',
  name: 'Codex',
  binary: 'codex',
  plugins: CodexPlugins,
  marketplaces: CodexMarketplaces,
  refresh: 'upgrade',
  install: () => 'add',
}

const lastLine = (output: string) =>
  output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .at(-1)

const run = (exec: Exec, command: ReadonlyArray<string>, timeoutMs: number) =>
  exec(command, { timeoutMs }).pipe(
    Effect.mapError((error) => new AgentSetupError({ message: error.message })),
    Effect.filterOrFail(
      (result) => result.code === 0,
      (result) =>
        new AgentSetupError({
          message: `${command.join(' ')} exited with code ${result.code}`,
          hint: lastLine(`${result.stdout}\n${result.stderr}`),
        }),
    ),
    Effect.map((result) => result.stdout),
  )

const runJson = <T>(
  exec: Exec,
  command: ReadonlyArray<string>,
  schema: Schema.Codec<T, unknown>,
) =>
  run(exec, command, LIST_TIMEOUT).pipe(
    Effect.flatMap(Schema.decodeUnknownEffect(Schema.fromJsonString(schema))),
    Effect.catchTag(
      'SchemaError',
      (error) =>
        new AgentSetupError({
          message: `${command.join(' ')} printed an unexpected result`,
          hint: error.message,
        }),
    ),
  )

const pluginCommand = (spec: PluginClient, ...args: ReadonlyArray<string>) => [
  spec.binary,
  'plugin',
  ...args,
]

const installedPlugin = (spec: PluginClient, exec: Exec) =>
  runJson(exec, pluginCommand(spec, 'list', '--json'), spec.plugins).pipe(
    Effect.map((plugins) =>
      plugins.find(
        (plugin) =>
          plugin.installed !== false && plugin.id.toLowerCase() === PLUGIN,
      ),
    ),
  )

export const detectPlugin = (
  spec: PluginClient,
  exec: Exec,
  executable: string | null,
): Effect.Effect<ClientStatus> => {
  const base = { client: spec.client, name: spec.name }
  if (!executable) {
    return Effect.succeed({ ...base, detected: false, installed: false })
  }
  return installedPlugin(spec, exec).pipe(
    Effect.map(
      (plugin): ClientStatus => ({
        ...base,
        detected: true,
        installed: plugin !== undefined,
        ...(plugin?.version ? { version: plugin.version } : {}),
      }),
    ),
    Effect.orElseSucceed(
      (): ClientStatus => ({
        ...base,
        detected: true,
        installed: false,
        problem: `Update ${spec.name} to a version with plugin support.`,
      }),
    ),
  )
}

export const installPlugin = (
  spec: PluginClient,
  exec: Exec,
  installed: boolean,
) =>
  Effect.gen(function* () {
    const marketplaces = yield* runJson(
      exec,
      pluginCommand(spec, 'marketplace', 'list', '--json'),
      spec.marketplaces,
    ).pipe(Effect.orElseSucceed(() => []))
    yield* run(
      exec,
      marketplaces.some(({ name }) => name === MARKETPLACE)
        ? pluginCommand(spec, 'marketplace', spec.refresh, MARKETPLACE)
        : pluginCommand(spec, 'marketplace', 'add', TOOLKIT_REPOSITORY),
      INSTALL_TIMEOUT,
    )
    const install = pluginCommand(spec, spec.install(installed), PLUGIN)
    yield* run(exec, install, INSTALL_TIMEOUT)
    const plugin = yield* installedPlugin(spec, exec).pipe(
      Effect.orElseSucceed(() => undefined),
    )
    if (!plugin) {
      return yield* new AgentSetupError({
        message: `${spec.name} reported success but ${PLUGIN} is not installed`,
        hint: `Run ${install.join(' ')} to see the underlying error.`,
      })
    }
  })
