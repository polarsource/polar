import { describe, expect, test } from 'vitest'
import { Effect } from 'effect'
import { setup } from '@/commands/setup'
import { runCli } from '@/utils/test-utils/cli'
import { fakeHttp } from '@/utils/test-utils/http'

const REPORT = 'POST https://sandbox-api.polar.sh/v1/agent-setup-runs/report'

const run = (args: string[], http = fakeHttp()) => {
  const cli = runCli(setup, args)
  const promise = Effect.runPromise(
    cli.effect.pipe(Effect.provide(http.layer), Effect.exit),
  )
  return { cli, promise, http }
}

describe('setup command', () => {
  test('reports the connection and prints the instructions', async () => {
    const http = fakeHttp({
      [REPORT]: Response.json({ drafts: null, approved_at: null }),
    })
    const { cli, promise } = run(['acme#K7Q2M9XD', '--sandbox'], http)
    await promise

    expect(await http.requests[0]?.json()).toEqual({
      code: 'K7Q2M9XD',
      stage: 'connect',
    })
    expect(cli.output()).toContain('- Organization: acme')
    expect(cli.output()).toContain('- Setup run code: K7Q2M9XD')
    expect(cli.output()).toContain(
      'https://sandbox-api.polar.sh/v1/agent-setup-runs/report',
    )
  })

  test('points the SDK at the local API for a local run', async () => {
    const http = fakeHttp({
      'POST http://127.0.0.1:8000/v1/agent-setup-runs/report': Response.json({
        drafts: null,
        approved_at: null,
      }),
    })
    const { cli, promise } = run(['acme#K7Q2M9XD', '--local'], http)
    await promise

    expect(cli.output()).toContain('serverURL "http://127.0.0.1:8000"')
  })

  test('prints the instructions as JSON', async () => {
    const http = fakeHttp({
      [REPORT]: Response.json({ drafts: null, approved_at: null }),
    })
    const { cli, promise } = run(['acme#K7Q2M9XD', '--sandbox', '--json'], http)
    await promise

    expect(JSON.parse(cli.output())).toMatchObject({
      organization: 'acme',
      environment: 'sandbox',
    })
  })

  test('explains an unknown or expired run', async () => {
    const http = fakeHttp({
      [REPORT]: Response.json({ detail: 'Not found' }, { status: 404 }),
    })
    const { promise } = run(['acme#K7Q2M9XD', '--sandbox'], http)

    expect(JSON.stringify(await promise)).toContain(
      'This setup run was not found or has expired',
    )
  })

  test('rejects a run without a code before calling the API', async () => {
    const { promise, http } = run(['acme'])

    expect(JSON.stringify(await promise)).toContain('is not a setup run')
    expect(http.requests).toHaveLength(0)
  })
})
