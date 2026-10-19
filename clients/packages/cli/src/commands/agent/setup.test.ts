import { Effect, Option } from 'effect'
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

const fakeSetup = ({
  statuses,
  callingAgent,
  skills = {},
  failing = [],
}: FakeOptions) => {
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
  return { service, installed }
}

const run = (
  args: string[],
  fake: ReturnType<typeof fakeSetup>,
  options?: RunCliOptions,
) => {
  const cli = runCli(setup, args, options)
  const promise = Effect.runPromise(
    cli.effect.pipe(Effect.provideService(AgentSetup, fake.service)),
  )
  return { ...cli, promise }
}

const space = {
  input: Option.some(' '),
  key: { name: 'space', ctrl: false, meta: false, shift: false },
}

describe('agent setup', () => {
  test('--status reports clients and installed skills without changes', async () => {
    const fake = fakeSetup({
      statuses: [
        client('claude-code', { installed: true, version: '0.1.0' }),
        client('codex', { problem: 'Update Codex.' }),
      ],
      skills: { project: 'outdated' },
    })
    const cli = run(['--status', '--json'], fake)
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
    expect(fake.installed).toEqual([])
  })

  test('--status renders a table', async () => {
    const fake = fakeSetup({
      statuses: [client('claude-code', { installed: true, version: '0.1.0' })],
    })
    const cli = run(['--status'], fake)
    await cli.promise

    expect(cli.output()).toContain('Claude Code  set up 0.1.0')
    expect(cli.output()).toContain('Codex        not found')
  })

  test('--yes sets up every detected client and skips the ones already set up', async () => {
    const fake = fakeSetup({
      statuses: [
        client('claude-code', { installed: true }),
        client('codex'),
        client('cursor'),
      ],
    })
    const cli = run(['--yes'], fake)
    await cli.promise

    expect(fake.installed).toEqual(['codex', 'cursor'])
    expect(cli.output()).toContain('Claude Code already set up')
    expect(cli.output()).toContain('2 set up, 1 already set up, 0 failed')
    expect(cli.output()).toContain('codex mcp login polar')
  })

  test('--force reinstalls clients that are already set up', async () => {
    const fake = fakeSetup({
      statuses: [client('claude-code', { installed: true })],
    })
    const cli = run(['--yes', '--force', '--json'], fake)
    await cli.promise

    expect(fake.installed).toEqual(['claude-code'])
    expect(JSON.parse(cli.output()).steps).toEqual([
      { target: 'claude-code', name: 'Claude Code', outcome: 'updated' },
    ])
  })

  test('only sets up the agent it runs inside', async () => {
    const fake = fakeSetup({
      statuses: [client('claude-code'), client('codex')],
      callingAgent: 'codex',
    })
    const cli = run([], fake, { interactive: true })
    await cli.promise

    expect(fake.installed).toEqual(['codex'])
    expect(cli.output()).toContain('Running inside Codex')
  })

  test('installs project skills for an agent without a Polar plugin', async () => {
    const fake = fakeSetup({
      statuses: [client('claude-code')],
      callingAgent: 'opencode',
    })
    const cli = run(['--json'], fake)
    await cli.promise

    expect(fake.installed).toEqual(['skills:project'])
    expect(JSON.parse(cli.output()).steps).toEqual([
      {
        target: 'skills',
        name: 'Polar skills (project)',
        outcome: 'installed',
        detail: '/project/.agents/skills',
      },
    ])
  })

  test('leaves skills that are already current alone', async () => {
    const fake = fakeSetup({ statuses: [], skills: { global: 'current' } })
    const cli = run(['--skills', 'global', '--json'], fake)
    await cli.promise

    expect(fake.installed).toEqual([])
    expect(JSON.parse(cli.output()).steps[0].outcome).toBe('unchanged')
  })

  test('fails when --client names an agent that is not installed', async () => {
    const fake = fakeSetup({ statuses: [] })
    const cli = run(['--client', 'cursor'], fake)

    await expect(cli.promise).rejects.toThrow(
      'Cursor was not found on this machine',
    )
  })

  test('points to the skills when no agent is found', async () => {
    const fake = fakeSetup({ statuses: [] })
    const cli = run([], fake)
    await cli.promise

    expect(cli.output()).toContain(
      'No Claude Code, Codex or Cursor installation found',
    )
    expect(cli.output()).toContain('polar agent setup --skills project')
  })

  test('reports a failed client and keeps going', async () => {
    const fake = fakeSetup({
      statuses: [
        client('claude-code', { problem: 'Update Claude Code.' }),
        client('codex'),
        client('cursor'),
      ],
      failing: ['codex'],
    })
    const cli = run(['--yes'], fake)

    await expect(cli.promise).rejects.toThrow(
      'Could not set up Claude Code, Codex',
    )
    expect(fake.installed).toEqual(['cursor'])
    expect(cli.output()).toContain(
      'plugin install exited with code 1: network down',
    )
    expect(cli.output()).toContain('1 set up, 0 already set up, 2 failed')
  })

  test('asks which clients to set up, preselecting the missing ones', async () => {
    const fake = fakeSetup({
      statuses: [client('claude-code', { installed: true }), client('codex')],
    })
    const cli = run([], fake, { interactive: true, input: [keys.enter] })
    await cli.promise

    expect(cli.terminal()).toContain('What should be set up for Polar?')
    expect(fake.installed).toEqual(['codex'])
  })

  test('asks where to put the skills when they are picked', async () => {
    const fake = fakeSetup({ statuses: [client('codex', { installed: true })] })
    const cli = run([], fake, {
      interactive: true,
      input: [
        keys.down,
        keys.down,
        keys.down,
        space,
        keys.enter,
        keys.down,
        keys.enter,
      ],
    })
    await cli.promise

    expect(cli.terminal()).toContain('Where should the Polar skills go?')
    expect(fake.installed).toEqual(['skills:global'])
  })

  test('makes no changes when nothing is picked', async () => {
    const fake = fakeSetup({ statuses: [client('codex')] })
    const cli = run([], fake, { interactive: true, input: [keys.ctrlC] })
    await cli.promise

    expect(fake.installed).toEqual([])
    expect(cli.output()).toContain('Nothing selected, no changes made')
  })
})
