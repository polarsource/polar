import { Effect } from 'effect'
import { describe, expect, test } from 'vitest'
import {
  PLUGIN,
  claude,
  codex,
  detectPlugin,
  installPlugin,
} from '@/services/agent-setup/plugins'
import type { Exec, ProcessResult } from '@/services/updater'

const ok = (stdout: unknown = ''): ProcessResult => ({
  code: 0,
  stdout: typeof stdout === 'string' ? stdout : JSON.stringify(stdout),
  stderr: '',
})

const fakeExec = (replies: Record<string, ProcessResult>) => {
  const calls: string[] = []
  const exec: Exec = (command) => {
    const key = command.join(' ')
    calls.push(key)
    const reply = replies[key]
    return reply ? Effect.succeed(reply) : Effect.die(`Unexpected: ${key}`)
  }
  return { exec, calls }
}

describe('detectPlugin', () => {
  test('asks for an upgrade when the client has no plugin command', async () => {
    const { exec } = fakeExec({
      'codex plugin list --json': { code: 2, stdout: '', stderr: 'not found' },
    })
    const status = await Effect.runPromise(
      detectPlugin(codex, exec, '/bin/codex'),
    )
    expect(status).toMatchObject({
      detected: true,
      installed: false,
      problem: 'Update Codex to a version with plugin support.',
    })
  })
})

describe('installPlugin', () => {
  test('adds the marketplace, then installs into Claude Code', async () => {
    const { exec, calls } = fakeExec({
      'claude plugin marketplace list --json': ok([{ name: 'other' }]),
      'claude plugin marketplace add polarsource/agent-toolkit': ok(),
      [`claude plugin install ${PLUGIN}`]: ok(),
      'claude plugin list --json': ok([{ id: PLUGIN, version: '0.1.0' }]),
    })
    await Effect.runPromise(installPlugin(claude, exec, false))
    expect(calls).toEqual([
      'claude plugin marketplace list --json',
      'claude plugin marketplace add polarsource/agent-toolkit',
      `claude plugin install ${PLUGIN}`,
      'claude plugin list --json',
    ])
  })

  test('refreshes the marketplace, then updates an installed plugin', async () => {
    const { exec, calls } = fakeExec({
      'claude plugin marketplace list --json': ok([{ name: 'polar' }]),
      'claude plugin marketplace update polar': ok(),
      [`claude plugin update ${PLUGIN}`]: ok(),
      'claude plugin list --json': ok([{ id: PLUGIN }]),
    })
    await Effect.runPromise(installPlugin(claude, exec, true))
    expect(calls).toContain('claude plugin marketplace update polar')
    expect(calls).toContain(`claude plugin update ${PLUGIN}`)
  })

  test('fails when Codex exits 0 but the plugin is still missing', async () => {
    const { exec } = fakeExec({
      'codex plugin marketplace list --json': ok({
        marketplaces: [{ name: 'polar' }],
      }),
      'codex plugin marketplace upgrade polar': ok(),
      [`codex plugin add ${PLUGIN}`]: ok(),
      'codex plugin list --json': ok({
        installed: [{ pluginId: PLUGIN, installed: false }],
      }),
    })
    const error = await Effect.runPromise(
      Effect.flip(installPlugin(codex, exec, false)),
    )
    expect(error.message).toBe(
      `Codex reported success but ${PLUGIN} is not installed`,
    )
    expect(error.hint).toContain(`codex plugin add ${PLUGIN}`)
  })
})
