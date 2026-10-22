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
import {
  type CallingAgent,
  detectCallingAgent,
} from '@/services/agent-setup/agents'
import { Environment } from '@/services/telemetry'
import { exec } from '@/services/updater'

export class AgentSetup extends Context.Service<
  AgentSetup,
  {
    readonly callingAgent: CallingAgent | undefined
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

const plugins: Partial<Record<Client, PluginClient>> = {
  'claude-code': claude,
  codex,
}

export const layer = Layer.effect(
  AgentSetup,
  Effect.gen(function* () {
    const services = yield* Effect.context<
      FileSystem.FileSystem | HttpClient.HttpClient
    >()
    const env = yield* Environment
    const paths = { home: homedir(), cwd: process.cwd() }
    const cursorSkills = cursorSkillsDirectory(paths.home)
    const toolkit = yield* Effect.cached(fetchSkills)

    const skillsAt = (directory: string) =>
      Effect.gen(function* () {
        const skills = yield* toolkit
        const state = yield* checkSkills(directory, skills)
        return { directory, state, skills: skills.map(({ name }) => name) }
      }).pipe(Effect.provideContext(services))

    const installSkillsAt = (directory: string) =>
      toolkit.pipe(
        Effect.flatMap((skills) => writeSkills(directory, skills)),
        Effect.andThen(skillsAt(directory)),
        Effect.provideContext(services),
      )

    const detectClient = (client: Client) => {
      const plugin = plugins[client]
      if (plugin) {
        return detectPlugin(plugin, exec, Bun.which(plugin.binary))
      }
      return detectCursor(
        paths.home,
        Bun.which('cursor'),
        skillsAt(cursorSkills).pipe(
          Effect.map(({ state }) => state === 'current'),
          Effect.orElseSucceed(() => false),
        ),
      ).pipe(Effect.provideContext(services))
    }

    return AgentSetup.of({
      callingAgent: detectCallingAgent(env),
      detect: (clients) =>
        Effect.forEach(clients, detectClient, { concurrency: 'unbounded' }),
      setUp: (status) => {
        const plugin = plugins[status.client]
        if (plugin) return installPlugin(plugin, exec, status.installed)
        return configureCursorMcp(paths.home).pipe(
          Effect.andThen(installSkillsAt(cursorSkills)),
          Effect.provideContext(services),
          Effect.asVoid,
        )
      },
      skills: (scope) =>
        skillsAt(skillsDirectory(scope, paths)).pipe(
          Effect.map((status) => ({ scope, ...status })),
        ),
      installSkills: (scope) =>
        installSkillsAt(skillsDirectory(scope, paths)).pipe(
          Effect.map((status) => ({ scope, ...status })),
        ),
    })
  }),
)
