import { Effect } from 'effect'
import { describe, expect, test } from 'vitest'
import { setup } from '@/commands/agent/setup'
import {
  AgentSetupError,
  type Client,
  type ClientStatus,
  type SkillScope,
  type SkillsStatus,
} from '@/schemas/AgentSetup'
import { AgentSetup } from '@/services/agent-setup/service'
import { type RunCliOptions, keys, runCli } from '@/utils/test-utils/cli'

const names: Record<Client, string> = {
  'claude-code': 'Claude Code',
  codex: 'Codex',
  cursor: 'Cursor',
}

const client = (
  id: Client,
  overrides: Partial<ClientStatus> = {},
): ClientStatus => ({
  client: id,
  name: names[id],
  detected: true,
  installed: false,
  ...overrides,
})

interface FakeOptions {
  readonly statuses: ReadonlyArray<ClientStatus>
  readonly callingAgent?: string
  readonly skills?: Partial<Record<SkillScope, SkillsStatus['state']>>
  readonly failing?: ReadonlyArray<Client>
}

const run = (
  args: string[],
  { statuses, callingAgent, skills = {}, failing = [] }: FakeOptions,
  options?: RunCliOptions,
) => {
  const installed: string[] = []
  const skillsStatus = (scope: SkillScope): SkillsStatus => ({
    scope,
    directory: `/${scope}/.agents/skills`,
    state: skills[scope] ?? 'missing',
    skills: ['setup-polar'],
  })
  const service = AgentSetup.of({
    callingAgent,
    detect: (clients) =>
      Effect.succeed(
        clients.map(
          (id) =>
            statuses.find((status) => status.client === id) ??
            client(id, { detected: false }),
        ),
      ),
    setUp: (status) => {
      if (failing.includes(status.client)) {
        return Effect.fail(
          new AgentSetupError({
            message: 'plugin install exited with code 1',
            hint: 'network down',
          }),
        )
      }
      installed.push(status.client)
      return Effect.void
    },
    skills: (scope) => Effect.succeed(skillsStatus(scope)),
    installSkills: (scope) => {
      installed.push(`skills:${scope}`)
      return Effect.succeed({ ...skillsStatus(scope), state: 'current' })
    },
  })
  const cli = runCli(setup, args, options)
  const promise = Effect.runPromise(
    cli.effect.pipe(Effect.provideService(AgentSetup, service)),
  )
  return { ...cli, promise, installed }
}

describe('agent setup', () => {
  test('--status reports clients and installed skills without changes', async () => {
    const cli = run(['--status', '--json'], {
      statuses: [
        client('claude-code', { installed: true, version: '0.1.0' }),
        client('codex', { problem: 'Update Codex.' }),
      ],
      skills: { project: 'outdated' },
    })
    await cli.promise

    expect(JSON.parse(cli.output())).toEqual({
      clients: [
        client('claude-code', { installed: true, version: '0.1.0' }),
        client('codex', { problem: 'Update Codex.' }),
        client('cursor', { detected: false }),
      ],
      skills: [
        {
          scope: 'project',
          directory: '/project/.agents/skills',
          state: 'outdated',
          skills: ['setup-polar'],
        },
      ],
      steps: [],
    })
    expect(cli.installed).toEqual([])
  })

  test('--yes sets up every detected client and skips the ones already set up', async () => {
    const cli = run(['--yes'], {
      statuses: [
        client('claude-code', { installed: true }),
        client('codex'),
        client('cursor'),
      ],
    })
    await cli.promise

    expect(cli.installed).toEqual(['codex', 'cursor'])
    expect(cli.output()).toContain('Claude Code already set up')
    expect(cli.output()).toContain('2 set up, 1 already set up, 0 failed')
    expect(cli.output()).toContain('codex mcp login polar')
  })

  test('only sets up the agent it runs inside', async () => {
    const cli = run(
      [],
      {
        statuses: [client('claude-code'), client('codex')],
        callingAgent: 'codex',
      },
      { interactive: true },
    )
    await cli.promise

    expect(cli.installed).toEqual(['codex'])
    expect(cli.output()).toContain('Running inside Codex')
  })

  test('installs project skills for an agent without a Polar plugin', async () => {
    const cli = run(['--json'], {
      statuses: [client('claude-code')],
      callingAgent: 'opencode',
    })
    await cli.promise

    expect(cli.installed).toEqual(['skills:project'])
    expect(JSON.parse(cli.output()).steps).toEqual([
      {
        target: 'skills',
        name: 'Polar skills (project)',
        outcome: 'installed',
        detail: '/project/.agents/skills',
      },
    ])
  })

  test('fails when --client names an agent that is not installed', async () => {
    const cli = run(['--client', 'cursor'], { statuses: [] })

    await expect(cli.promise).rejects.toThrow(
      'Cursor was not found on this machine',
    )
  })

  test('reports a failed client, keeps going and exits non-zero', async () => {
    const cli = run(['--yes'], {
      statuses: [
        client('claude-code', { problem: 'Update Claude Code.' }),
        client('codex'),
        client('cursor'),
      ],
      failing: ['codex'],
    })

    await expect(cli.promise).rejects.toThrow(
      'Could not set up Claude Code, Codex',
    )
    expect(cli.installed).toEqual(['cursor'])
    expect(cli.output()).toContain(
      'plugin install exited with code 1: network down',
    )
    expect(cli.output()).toContain('1 set up, 0 already set up, 2 failed')
  })

  test('asks what to set up, preselecting the clients that are missing', async () => {
    const cli = run(
      [],
      {
        statuses: [client('claude-code', { installed: true }), client('codex')],
      },
      { interactive: true, input: [keys.enter] },
    )
    await cli.promise

    expect(cli.terminal()).toContain('What should be set up for Polar?')
    expect(cli.installed).toEqual(['codex'])
  })
})
