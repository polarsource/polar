import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { BunFileSystem } from '@effect/platform-bun'
import { Effect, Layer } from 'effect'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { AgentSetup, make } from '@/services/agent-setup/service'
import { TREE_URL, fileUrl, gitBlobSha } from '@/services/agent-setup/skills'
import type { Exec } from '@/services/updater'
import { fakeHttp } from '@/utils/test-utils/http'

const skill = '# Set up Polar\n'

const toolkit = () =>
  fakeHttp({
    [TREE_URL]: Response.json({
      tree: [
        {
          path: 'skills/setup-polar/SKILL.md',
          type: 'blob',
          sha: gitBlobSha(new TextEncoder().encode(skill)),
        },
      ],
    }),
    [fileUrl('skills/setup-polar/SKILL.md')]: new Response(skill),
  })

const claudeOnly: Exec = (command) =>
  Effect.succeed(
    command.join(' ') === 'claude plugin list --json'
      ? {
          code: 0,
          stdout: '[{"id":"polar@polar","version":"0.1.0"}]',
          stderr: '',
        }
      : { code: 1, stdout: '', stderr: 'unexpected' },
  )

let home: string
let cwd: string

beforeEach(async () => {
  home = await mkdtemp(join(tmpdir(), 'polar-agent-home-'))
  cwd = await mkdtemp(join(tmpdir(), 'polar-agent-cwd-'))
})

afterEach(async () => {
  await rm(home, { recursive: true, force: true })
  await rm(cwd, { recursive: true, force: true })
})

const run = <A, E>(
  use: (setup: AgentSetup['Service']) => Effect.Effect<A, E>,
  http = toolkit(),
) =>
  Effect.runPromise(
    Effect.gen(function* () {
      return yield* use(yield* AgentSetup)
    }).pipe(
      Effect.provide(
        Layer.effect(
          AgentSetup,
          make({
            exec: claudeOnly,
            which: (binary) => (binary === 'claude' ? '/bin/claude' : null),
            home,
            cwd,
            env: { CODEX_THREAD_ID: 'abc' },
          }),
        ).pipe(Layer.provide(Layer.merge(BunFileSystem.layer, http.layer))),
      ),
    ),
  )

test('detects every client and the agent it runs inside', async () => {
  await mkdir(join(home, '.cursor'))
  const [agent, statuses] = await run((setup) =>
    setup
      .detect(['claude-code', 'codex', 'cursor'])
      .pipe(Effect.map((statuses) => [setup.callingAgent, statuses] as const)),
  )
  expect(agent).toBe('codex')
  expect(
    statuses.map(({ client, detected, installed }) => [
      client,
      detected,
      installed,
    ]),
  ).toEqual([
    ['claude-code', true, true],
    ['codex', false, false],
    ['cursor', true, false],
  ])
})

test('sets up Cursor with the MCP servers and skills', async () => {
  const http = toolkit()
  const status = await run(
    (setup) =>
      setup
        .setUp({
          client: 'cursor',
          name: 'Cursor',
          detected: true,
          installed: false,
        })
        .pipe(Effect.andThen(setup.detect(['cursor']))),
    http,
  )
  expect(status[0]?.installed).toBe(true)
  expect(
    await readFile(join(home, '.cursor/skills/setup-polar/SKILL.md'), 'utf8'),
  ).toBe(skill)
  expect(http.urls().filter((url) => url === TREE_URL)).toHaveLength(1)
})

test('installs skills into the project or home directory', async () => {
  const [before, after, global] = await run((setup) =>
    Effect.all([
      setup.skills('project'),
      setup.installSkills('project'),
      setup.skills('global'),
    ]),
  )
  expect(before).toMatchObject({ scope: 'project', state: 'missing' })
  expect(after).toEqual({
    scope: 'project',
    directory: join(cwd, '.agents/skills'),
    state: 'current',
    skills: ['setup-polar'],
  })
  expect(global).toMatchObject({ scope: 'global', state: 'missing' })
})
