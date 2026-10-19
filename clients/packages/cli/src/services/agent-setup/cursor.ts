import path from 'node:path'
import { Effect, FileSystem, Option, Schema } from 'effect'
import { applyEdits, modify, parse } from 'jsonc-parser'
import { AgentSetupError, type ClientStatus } from '@/schemas/AgentSetup'

export const MCP_SERVERS = {
  polar: 'https://mcp.polar.sh/mcp/polar-mcp',
  'polar-sandbox': 'https://mcp.polar.sh/mcp/polar-sandbox',
} as const

const cursorDirectory = (home: string) => path.join(home, '.cursor')
export const cursorSkillsDirectory = (home: string) =>
  path.join(cursorDirectory(home), 'skills')
const mcpFile = (home: string) => path.join(cursorDirectory(home), 'mcp.json')

const Config = Schema.Struct({
  mcpServers: Schema.optional(Schema.Record(Schema.String, Schema.Unknown)),
})

const configuredServers = (source: string) =>
  Schema.decodeUnknownOption(Config)(parse(source)).pipe(
    Option.map((config) => Object.keys(config.mcpServers ?? {})),
    Option.getOrElse((): ReadonlyArray<string> => []),
  )

const readConfig = (file: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    return (yield* fs.exists(file)) ? yield* fs.readFileString(file) : '{}'
  })

const mcpConfigured = (home: string) =>
  readConfig(mcpFile(home)).pipe(
    Effect.map((source) => {
      const servers = configuredServers(source)
      return Object.keys(MCP_SERVERS).every((name) => servers.includes(name))
    }),
    Effect.orElseSucceed(() => false),
  )

export const detectCursor = (
  home: string,
  executable: string | null,
  skillsCurrent: Effect.Effect<boolean>,
): Effect.Effect<ClientStatus, never, FileSystem.FileSystem> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const base = { client: 'cursor', name: 'Cursor' } as const
    const detected =
      executable !== null ||
      (yield* fs
        .exists(cursorDirectory(home))
        .pipe(Effect.orElseSucceed(() => false)))
    if (!detected) return { ...base, detected, installed: false }
    const installed = (yield* mcpConfigured(home)) && (yield* skillsCurrent)
    return { ...base, detected, installed }
  })

export const configureCursorMcp = (home: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const file = mcpFile(home)
    let source = yield* readConfig(file)
    const existing = configuredServers(source)
    for (const [name, url] of Object.entries(MCP_SERVERS)) {
      if (existing.includes(name)) continue
      source = applyEdits(
        source,
        modify(
          source,
          ['mcpServers', name],
          { url },
          { formattingOptions: { insertSpaces: true, tabSize: 2 } },
        ),
      )
    }
    yield* fs.makeDirectory(path.dirname(file), { recursive: true })
    yield* fs.writeFileString(
      file,
      source.endsWith('\n') ? source : `${source}\n`,
    )
  }).pipe(
    Effect.mapError(
      (cause) =>
        new AgentSetupError({
          message: `Could not add the Polar MCP servers to ${mcpFile(home)}`,
          hint: cause.message,
        }),
    ),
  )
