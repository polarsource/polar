import { describe, expect, test } from 'vitest'
import { Effect } from 'effect'
import { pull } from '@/commands/config/pull'
import type { PullResult } from '@/schemas/BillingConfig'
import { Auth } from '@/services/auth'
import { BillingConfig } from '@/services/billing-config/service'
import { Organizations } from '@/services/organizations'
import { runCli, stripAnsi } from '@/utils/test-utils/cli'
import { fakeAuth, fakeOrganizations } from '@/utils/test-utils/services'

const acme = {
  id: 'org-1',
  name: 'Acme',
  slug: 'acme',
  environment: 'sandbox' as const,
}

const written: PullResult = {
  status: 'written',
  file: 'polar.config.ts',
  entries: [
    { section: 'meters', id: 'tool_calls' },
    { section: 'meters', id: 'tokens' },
    { section: 'products', id: 'pro' },
  ],
  skipped: [
    {
      resource: 'meter',
      id: 'm-1',
      name: 'Dashboard meter',
      reason: 'missing_external_id',
    },
    { resource: 'meter', id: 'm-2', name: 'Old', reason: 'archived' },
  ],
}

const run = async (args: string[], result: PullResult = written) => {
  const calls: unknown[] = []
  const cli = runCli(pull, args)
  const exit = await Effect.runPromiseExit(
    cli.effect.pipe(
      Effect.provideService(
        BillingConfig,
        BillingConfig.of({
          load: () => Effect.die('unused'),
          plan: () => Effect.die('unused'),
          apply: () => Effect.die('unused'),
          pull: (organization, file, force) => {
            calls.push([organization.id, file, force])
            return Effect.succeed({ ...result, file: file ?? result.file })
          },
        }),
      ),
      Effect.provideService(Auth, fakeAuth().auth),
      Effect.provideService(
        Organizations,
        fakeOrganizations({
          items: [acme],
          selected: { id: acme.id, environment: acme.environment },
        }).organizations,
      ),
    ),
  )
  return {
    calls,
    output: stripAnsi(cli.output()),
    failed: exit._tag === 'Failure',
  }
}

describe('polar config pull', () => {
  test('leaves the file to the service by default and lists every section', async () => {
    const { calls, output, failed } = await run([])

    expect(failed).toBe(false)
    expect(calls).toEqual([['org-1', undefined, false]])
    expect(output).toContain('meters\n    + tool_calls\n    + tokens')
    expect(output).toContain('products\n    + pro')
    expect(output).toContain('Not in the config: 1 resource')
    expect(output).toContain('Dashboard meter (meter m-1) has no external ID')
    expect(output).not.toContain('Old')
    expect(output).toContain('polar.config.ts written: 3 entries')
  })

  test('passes the file and --force through', async () => {
    const { calls } = await run(['billing.json', '--force'])

    expect(calls).toEqual([['org-1', 'billing.json', true]])
  })

  test('lists the entries that differ and fails', async () => {
    const { output, failed } = await run([], {
      status: 'conflict',
      file: 'polar.config.ts',
      entries: [{ section: 'meters', id: 'tokens' }],
    })

    expect(failed).toBe(true)
    expect(output).toContain('meters\n    ~ tokens')
    expect(output).not.toContain('written')
  })

  test('prints the result as JSON', async () => {
    const { output } = await run(['--json'])

    expect(JSON.parse(output)).toEqual(written)
  })
})
