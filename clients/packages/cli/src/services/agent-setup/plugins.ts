import { Effect, Schema } from 'effect'
import {
  AgentSetupError,
  type Client,
  type ClientStatus,
} from '@/schemas/AgentSetup'
import type { Exec, ProcessResult } from '@/services/updater'
import { TOOLKIT_REPOSITORY } from '@/services/agent-setup/skills'

export const MARKETPLACE = 'polar'
export const PLUGIN = `polar@${MARKETPLACE}`

interface InstalledPlugin {
  readonly id: string
  readonly version?: string | undefined
}

export interface PluginClient {
  readonly client: Client
  readonly name: string
  readonly binary: string
  readonly upgradeHint: string
  readonly list: ReadonlyArray<string>
  readonly plugins: (output: unknown) => ReadonlyArray<InstalledPlugin>
  readonly marketplaces: ReadonlyArray<string>
  readonly marketplaceNames: (output: unknown) => ReadonlyArray<string>
  readonly addMarketplace: ReadonlyArray<string>
  readonly refreshMarketplace: ReadonlyArray<string>
  readonly install: (installed: boolean) => ReadonlyArray<string>
}

const ClaudePlugins = Schema.Array(
  Schema.Struct({
    id: Schema.String,
    version: Schema.optional(Schema.String),
  }),
)
const ClaudeMarketplaces = Schema.Array(Schema.Struct({ name: Schema.String }))

export const claude: PluginClient = {
  client: 'claude-code',
  name: 'Claude Code',
  binary: 'claude',
  upgradeHint: 'Update Claude Code to a version with plugin support.',
  list: ['claude', 'plugin', 'list', '--json'],
  plugins: Schema.decodeUnknownSync(ClaudePlugins),
  marketplaces: ['claude', 'plugin', 'marketplace', 'list', '--json'],
  marketplaceNames: (output) =>
    Schema.decodeUnknownSync(ClaudeMarketplaces)(output).map(
      ({ name }) => name,
    ),
  addMarketplace: [
    'claude',
    'plugin',
    'marketplace',
    'add',
    TOOLKIT_REPOSITORY,
  ],
  refreshMarketplace: [
    'claude',
    'plugin',
    'marketplace',
    'update',
    MARKETPLACE,
  ],
  install: (installed) => [
    'claude',
    'plugin',
    installed ? 'update' : 'install',
    PLUGIN,
  ],
}

const CodexPlugins = Schema.Struct({
  installed: Schema.Array(
    Schema.Struct({
      pluginId: Schema.String,
      installed: Schema.optional(Schema.Boolean),
      version: Schema.optional(Schema.String),
    }),
  ),
})
const CodexMarketplaces = Schema.Struct({
  marketplaces: Schema.Array(Schema.Struct({ name: Schema.String })),
})

export const codex: PluginClient = {
  client: 'codex',
  name: 'Codex',
  binary: 'codex',
  upgradeHint: 'Update Codex to a version with plugin support.',
  list: ['codex', 'plugin', 'list', '--json'],
  plugins: (output) =>
    Schema.decodeUnknownSync(CodexPlugins)(output)
      .installed.filter((plugin) => plugin.installed !== false)
      .map(({ pluginId, version }) => ({ id: pluginId, version })),
  marketplaces: ['codex', 'plugin', 'marketplace', 'list', '--json'],
  marketplaceNames: (output) =>
    Schema.decodeUnknownSync(CodexMarketplaces)(output).marketplaces.map(
      ({ name }) => name,
    ),
  addMarketplace: ['codex', 'plugin', 'marketplace', 'add', TOOLKIT_REPOSITORY],
  refreshMarketplace: [
    'codex',
    'plugin',
    'marketplace',
    'upgrade',
    MARKETPLACE,
  ],
  install: () => ['codex', 'plugin', 'add', PLUGIN],
}

const LIST_TIMEOUT = 15_000
const INSTALL_TIMEOUT = 3 * 60_000

const commandFailed = (command: ReadonlyArray<string>, result: ProcessResult) =>
  new AgentSetupError({
    message: `${command.join(' ')} exited with code ${result.code}`,
    hint: lastLine(`${result.stdout}\n${result.stderr}`),
  })

const run = (command: ReadonlyArray<string>, exec: Exec, timeoutMs: number) =>
  Effect.gen(function* () {
    const result = yield* exec(command, { timeoutMs }).pipe(
      Effect.mapError(
        (error) => new AgentSetupError({ message: error.message }),
      ),
    )
    if (result.code !== 0) return yield* commandFailed(command, result)
    return result.stdout
  })

const runJson = (exec: Exec, command: ReadonlyArray<string>) =>
  Effect.gen(function* () {
    const stdout = yield* run(command, exec, LIST_TIMEOUT)
    return yield* Effect.try({
      try: (): unknown => JSON.parse(stdout),
      catch: () =>
        new AgentSetupError({
          message: `${command.join(' ')} printed invalid JSON`,
        }),
    })
  })

const runStep = (exec: Exec, command: ReadonlyArray<string>) =>
  run(command, exec, INSTALL_TIMEOUT).pipe(Effect.asVoid)

const lastLine = (output: string) =>
  output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .at(-1)

const parsed = <A>(parse: () => A) =>
  Effect.try({
    try: parse,
    catch: () => new AgentSetupError({ message: 'Unexpected plugin list' }),
  })

const installedPlugin = (spec: PluginClient, exec: Exec) =>
  Effect.gen(function* () {
    const output = yield* runJson(exec, spec.list)
    const plugins = yield* parsed(() => spec.plugins(output))
    return plugins.find((plugin) => plugin.id.toLowerCase() === PLUGIN)
  })

export const detectPlugin = (
  spec: PluginClient,
  exec: Exec,
  executable: string | null,
): Effect.Effect<ClientStatus> =>
  Effect.gen(function* () {
    const base = { client: spec.client, name: spec.name }
    if (!executable) return { ...base, detected: false, installed: false }
    return yield* installedPlugin(spec, exec).pipe(
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
          problem: spec.upgradeHint,
        }),
      ),
    )
  })

export const installPlugin = (
  spec: PluginClient,
  exec: Exec,
  installed: boolean,
) =>
  Effect.gen(function* () {
    const marketplaces = yield* runJson(exec, spec.marketplaces).pipe(
      Effect.flatMap((output) => parsed(() => spec.marketplaceNames(output))),
      Effect.orElseSucceed((): ReadonlyArray<string> => []),
    )
    yield* runStep(
      exec,
      marketplaces.includes(MARKETPLACE)
        ? spec.refreshMarketplace
        : spec.addMarketplace,
    )
    yield* runStep(exec, spec.install(installed))
    const plugin = yield* installedPlugin(spec, exec).pipe(
      Effect.orElseSucceed(() => undefined),
    )
    if (!plugin) {
      return yield* new AgentSetupError({
        message: `${spec.name} reported success but ${PLUGIN} is not installed`,
        hint: `Run ${spec.install(installed).join(' ')} to see the underlying error.`,
      })
    }
  })
