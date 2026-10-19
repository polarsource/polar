import { Effect } from 'effect'
import { describe, expect, test } from 'vitest'
import {
  PLUGIN,
  claude,
  codex,
  detectPlugin,
  installPlugin,
} from '@/services/agent-setup/plugins'
import { type Exec, type ProcessResult, UpdaterError } from '@/services/updater'

type Reply = ProcessResult | Error

const ok = (stdout: unknown = ''): ProcessResult => ({
  code: 0,
  stdout: typeof stdout === 'string' ? stdout : JSON.stringify(stdout),
  stderr: '',
})

const fakeExec = (replies: Record<string, Reply>) => {
  const calls: string[] = []
  const exec: Exec = (command) => {
    const key = command.join(' ')
    calls.push(key)
    const reply = replies[key]
    if (reply === undefined) return Effect.die(`Unexpected command: ${key}`)
    if (reply instanceof Error) {
      return Effect.fail(new UpdaterError({ message: reply.message }))
    }
    return Effect.succeed(reply)
  }
  return { exec, calls }
}

const claudeList = 'claude plugin list --json'
const claudeMarketplaces = 'claude plugin marketplace list --json'
const codexList = 'codex plugin list --json'
const codexMarketplaces = 'codex plugin marketplace list --json'

describe('detectPlugin', () => {
  test('reports a client that is not on the PATH', async () => {
    const { exec, calls } = fakeExec({})
    const status = await Effect.runPromise(detectPlugin(claude, exec, null))
    expect(status).toEqual({
      client: 'claude-code',
      name: 'Claude Code',
      detected: false,
      installed: false,
    })
    expect(calls).toEqual([])
  })

  test('finds the Polar plugin in Claude Code', async () => {
    const { exec } = fakeExec({
      [claudeList]: ok([
        { id: 'stripe@claude-plugins-official', version: '1.0.0' },
        { id: PLUGIN, version: '0.1.0' },
      ]),
    })
    const status = await Effect.runPromise(
      detectPlugin(claude, exec, '/bin/claude'),
    )
    expect(status).toMatchObject({
      detected: true,
      installed: true,
      version: '0.1.0',
    })
  })

  test('ignores Codex plugins that are only available', async () => {
    const { exec } = fakeExec({
      [codexList]: ok({
        installed: [{ pluginId: PLUGIN, installed: false }],
      }),
    })
    const status = await Effect.runPromise(
      detectPlugin(codex, exec, '/bin/codex'),
    )
    expect(status).toMatchObject({ detected: true, installed: false })
    expect(status.problem).toBeUndefined()
  })

  test('asks for an upgrade when the client has no plugin command', async () => {
    const { exec } = fakeExec({
      [codexList]: {
        code: 2,
        stdout: '',
        stderr: "Command 'plugin' not found",
      },
    })
    const status = await Effect.runPromise(
      detectPlugin(codex, exec, '/bin/codex'),
    )
    expect(status).toMatchObject({
      detected: true,
      installed: false,
      problem: codex.upgradeHint,
    })
  })
})

describe('installPlugin', () => {
  test('adds the marketplace before installing into Claude Code', async () => {
    const { exec, calls } = fakeExec({
      [claudeMarketplaces]: ok([{ name: 'claude-plugins-official' }]),
      'claude plugin marketplace add polarsource/agent-toolkit': ok(),
      [`claude plugin install ${PLUGIN}`]: ok(),
      [claudeList]: ok([{ id: PLUGIN }]),
    })
    await Effect.runPromise(installPlugin(claude, exec, false))
    expect(calls).toEqual([
      claudeMarketplaces,
      'claude plugin marketplace add polarsource/agent-toolkit',
      `claude plugin install ${PLUGIN}`,
      claudeList,
    ])
  })

  test('refreshes the marketplace and updates an installed plugin', async () => {
    const { exec, calls } = fakeExec({
      [claudeMarketplaces]: ok([{ name: 'polar' }]),
      'claude plugin marketplace update polar': ok(),
      [`claude plugin update ${PLUGIN}`]: ok(),
      [claudeList]: ok([{ id: PLUGIN }]),
    })
    await Effect.runPromise(installPlugin(claude, exec, true))
    expect(calls).toContain('claude plugin marketplace update polar')
    expect(calls).toContain(`claude plugin update ${PLUGIN}`)
  })

  test('adds the marketplace when Codex cannot list them', async () => {
    const { exec, calls } = fakeExec({
      [codexMarketplaces]: new Error('spawn failed'),
      'codex plugin marketplace add polarsource/agent-toolkit': ok(),
      [`codex plugin add ${PLUGIN}`]: ok(),
      [codexList]: ok({ installed: [{ pluginId: PLUGIN, installed: true }] }),
    })
    await Effect.runPromise(installPlugin(codex, exec, false))
    expect(calls).toContain(
      'codex plugin marketplace add polarsource/agent-toolkit',
    )
  })

  test('fails when the plugin is missing after a successful install', async () => {
    const { exec } = fakeExec({
      [codexMarketplaces]: ok({ marketplaces: [{ name: 'polar' }] }),
      'codex plugin marketplace upgrade polar': ok(),
      [`codex plugin add ${PLUGIN}`]: ok(),
      [codexList]: ok({ installed: [] }),
    })
    const error = await Effect.runPromise(
      Effect.flip(installPlugin(codex, exec, false)),
    )
    expect(error.message).toBe(
      `Codex reported success but ${PLUGIN} is not installed`,
    )
    expect(error.hint).toContain(`codex plugin add ${PLUGIN}`)
  })

  test('reports the last line of output when a command fails', async () => {
    const { exec } = fakeExec({
      [claudeMarketplaces]: ok([]),
      'claude plugin marketplace add polarsource/agent-toolkit': {
        code: 1,
        stdout: 'Cloning…\n',
        stderr: 'fatal: could not read from remote repository\n',
      },
    })
    const error = await Effect.runPromise(
      Effect.flip(installPlugin(claude, exec, false)),
    )
    expect(error.message).toBe(
      'claude plugin marketplace add polarsource/agent-toolkit exited with code 1',
    )
    expect(error.hint).toBe('fatal: could not read from remote repository')
  })
})
