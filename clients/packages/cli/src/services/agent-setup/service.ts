import { homedir } from 'node:os'
import { Context, Effect, FileSystem, Layer } from 'effect'
import { HttpClient } from 'effect/http'
import type {
  AgentSetupError,
  Client,
  ClientStatus,
  SkillScope,
  SkillsStatus,
} from '@/schemas/AgentSetup'
import {
  configureCursorMcp,
  cursorSkillsDirectory,
  detectCursor,
} from '@/services/agent-setup/cursor'
import {
  type PluginClient,
  claude,
  codex,
  detectPlugin,
  installPlugin,
} from '@/services/agent-setup/plugins'
import {
  checkSkills,
  fetchSkills,
  skillsDirectory,
  writeSkills,
} from '@/services/agent-setup/skills'
import { Environment, detectAgent } from '@/services/telemetry'
import { type Exec, exec } from '@/services/updater'

export class AgentSetup extends Context.Service<
  AgentSetup,
  {
    readonly callingAgent: string | undefined
    readonly detect: (
      clients: ReadonlyArray<Client>,
    ) => Effect.Effect<ReadonlyArray<ClientStatus>>
    readonly setUp: (
      status: ClientStatus,
    ) => Effect.Effect<void, AgentSetupError>
    readonly skills: (
      scope: SkillScope,
    ) => Effect.Effect<SkillsStatus, AgentSetupError>
    readonly installSkills: (
      scope: SkillScope,
    ) => Effect.Effect<SkillsStatus, AgentSetupError>
  }
>()('AgentSetup') {}

export interface Dependencies {
  readonly exec: Exec
  readonly which: (binary: string) => string | null
  readonly home: string
  readonly cwd: string
  readonly env: Record<string, string | undefined>
}

const plugins: Partial<Record<Client, PluginClient>> = {
  'claude-code': claude,
  codex,
}

export const make = (deps: Dependencies) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const http = yield* HttpClient.HttpClient
    const provide = <A, E>(
      effect: Effect.Effect<
        A,
        E,
        FileSystem.FileSystem | HttpClient.HttpClient
      >,
    ) =>
      effect.pipe(
        Effect.provideService(FileSystem.FileSystem, fs),
        Effect.provideService(HttpClient.HttpClient, http),
      )
    const toolkit = yield* Effect.cached(provide(fetchSkills))

    const skillsAt = (directory: string) =>
      toolkit.pipe(
        Effect.flatMap((skills) =>
          provide(checkSkills(directory, skills)).pipe(
            Effect.map((state) => ({
              directory,
              state,
              skills: skills.map(({ name }) => name),
            })),
          ),
        ),
      )
    const installSkillsAt = (directory: string) =>
      toolkit.pipe(
        Effect.flatMap((skills) => provide(writeSkills(directory, skills))),
        Effect.andThen(skillsAt(directory)),
      )

    const cursorSkills = cursorSkillsDirectory(deps.home)
    const detectClient = (client: Client) => {
      const plugin = plugins[client]
      if (plugin) {
        return detectPlugin(plugin, deps.exec, deps.which(plugin.binary))
      }
      return provide(
        detectCursor(
          deps.home,
          deps.which('cursor'),
          skillsAt(cursorSkills).pipe(
            Effect.map(({ state }) => state === 'current'),
            Effect.orElseSucceed(() => false),
          ),
        ),
      )
    }

    return AgentSetup.of({
      callingAgent: detectAgent(deps.env),
      detect: (clients) =>
        Effect.forEach(clients, detectClient, { concurrency: 'unbounded' }),
      setUp: (status) => {
        const plugin = plugins[status.client]
        if (plugin) {
          return installPlugin(plugin, deps.exec, status.installed)
        }
        return provide(configureCursorMcp(deps.home)).pipe(
          Effect.andThen(installSkillsAt(cursorSkills)),
          Effect.asVoid,
        )
      },
      skills: (scope) =>
        skillsAt(skillsDirectory(scope, deps)).pipe(
          Effect.map((status) => ({ scope, ...status })),
        ),
      installSkills: (scope) =>
        installSkillsAt(skillsDirectory(scope, deps)).pipe(
          Effect.map((status) => ({ scope, ...status })),
        ),
    })
  })

export const layer = Layer.effect(
  AgentSetup,
  Effect.gen(function* () {
    return yield* make({
      exec,
      which: (binary) => Bun.which(binary),
      home: homedir(),
      cwd: process.cwd(),
      env: yield* Environment,
    })
  }),
)
