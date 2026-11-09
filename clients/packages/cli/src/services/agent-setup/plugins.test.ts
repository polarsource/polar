import { BunServices } from '@effect/platform-bun'
import { Effect } from 'effect'
import type { ChildProcessSpawner } from 'effect/process'
import { describe, expect, test } from 'vitest'
import {
  claude,
  codex,
  detectPlugin,
  installPlugin,
} from '@/services/agent-setup/plugins'
import {
  type Exec,
  ExecTimeoutError,
  type ProcessResult,
} from '@/services/updater'

const run = <A, E>(
  effect: Effect.Effect<A, E, ChildProcessSpawner.ChildProcessSpawner>,
) => Effect.runPromise(effect.pipe(Effect.provide(BunServices.layer)))

const ok = (stdout: unknown = ''): ProcessResult => ({
  code: 0,
  stdout: typeof stdout === 'string' ? stdout : JSON.stringify(stdout),
  stderr: '',
})

const fakeExec = (
  replies: Record<string, ProcessResult | ExecTimeoutError>,
) => {
  const calls: string[] = []
  const exec: Exec = (command) => {
    const key = command.join(' ')
    calls.push(key)
    const reply = replies[key]
    if (reply instanceof ExecTimeoutError) return Effect.fail(reply)
    return reply ? Effect.succeed(reply) : Effect.die(`Unexpected: ${key}`)
  }
  return { exec, calls }
}

describe('detectPlugin', () => {
  test('asks for an upgrade when the client has no plugin command', async () => {
    const { exec } = fakeExec({
      'codex plugin list --json': { code: 2, stdout: '', stderr: 'not found' },
    })
    const status = await run(detectPlugin(codex, exec, '/bin/codex'))
    expect(status).toMatchObject({
      detected: true,
      installed: false,
      problem: 'Update Codex to a version with plugin support.',
    })
  })

  test('reports a timeout instead of asking for an upgrade', async () => {
    const { exec } = fakeExec({
      'codex plugin list --json': new ExecTimeoutError({
        message: 'codex plugin list --json did not respond within 15s',
      }),
    })
    const status = await run(detectPlugin(codex, exec, '/bin/codex'))
    expect(status).toMatchObject({
      detected: true,
      installed: false,
      problem: 'Codex did not respond within 15s.',
    })
  })
})

describe('installPlugin', () => {
  test('adds the marketplace, then installs into Claude Code', async () => {
    const { exec, calls } = fakeExec({
      'claude plugin marketplace list --json': ok([{ name: 'other' }]),
      'claude plugin marketplace add polarsource/agent-toolkit': ok(),
      [`claude plugin install ${claude.plugin}`]: ok(),
      'claude plugin list --json': ok([
        { id: claude.plugin, version: '0.1.0' },
      ]),
    })
    await run(installPlugin(claude, exec, false))
    expect(calls).toEqual([
      'claude plugin marketplace list --json',
      'claude plugin marketplace add polarsource/agent-toolkit',
      `claude plugin install ${claude.plugin}`,
      'claude plugin list --json',
    ])
  })

  test('refreshes the marketplace, then updates an installed plugin', async () => {
    const { exec, calls } = fakeExec({
      'claude plugin marketplace list --json': ok([{ name: 'polar' }]),
      'claude plugin marketplace update polar': ok(),
      [`claude plugin update ${claude.plugin}`]: ok(),
      'claude plugin list --json': ok([{ id: claude.plugin }]),
    })
    await run(installPlugin(claude, exec, true))
    expect(calls).toContain('claude plugin marketplace update polar')
    expect(calls).toContain(`claude plugin update ${claude.plugin}`)
  })

  test('installs into Codex from its official marketplace', async () => {
    const { exec, calls } = fakeExec({
      'codex plugin add polar@openai-curated-remote': ok(),
      'codex plugin list --json': ok({
        installed: [{ pluginId: 'polar@openai-curated-remote' }],
      }),
    })
    await run(installPlugin(codex, exec, false))
    expect(calls).toEqual([
      'codex plugin add polar@openai-curated-remote',
      'codex plugin list --json',
    ])
  })

  test('fails when Codex exits 0 but the plugin is still missing', async () => {
    const { exec } = fakeExec({
      [`codex plugin add ${codex.plugin}`]: ok(),
      'codex plugin list --json': ok({
        installed: [{ pluginId: codex.plugin, installed: false }],
      }),
    })
    const error = await run(Effect.flip(installPlugin(codex, exec, false)))
    expect(error.message).toBe(
      `Codex reported success but ${codex.plugin} is not installed`,
    )
    expect(error.hint).toContain(`codex plugin add ${codex.plugin}`)
  })

  test('reports a timed-out install as a timeout', async () => {
    const { exec } = fakeExec({
      [`codex plugin add ${codex.plugin}`]: new ExecTimeoutError({
        message: `codex plugin add ${codex.plugin} did not respond within 180s`,
      }),
    })
    const error = await run(Effect.flip(installPlugin(codex, exec, false)))
    expect(error).toMatchObject({
      _tag: 'AgentSetupError',
      message: `codex plugin add ${codex.plugin} did not respond within 180s`,
    })
  })
})
