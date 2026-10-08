import { describe, expect, test } from 'vitest'
import { Effect } from 'effect'
import { pull } from '@/commands/config/pull'
import type { PullResponse, SaveStatus } from '@/schemas/BillingConfig'
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

const run = async (
  pulled: PullResponse,
  status: SaveStatus,
  args: string[] = [],
) => {
  const saves: unknown[] = []
  const cli = runCli(pull, args)
  const exit = await Effect.runPromiseExit(
    cli.effect.pipe(
      Effect.provideService(
        BillingConfig,
        BillingConfig.of({
          load: () => Effect.die('unused'),
          plan: () => Effect.die('unused'),
          apply: () => Effect.die('unused'),
          pull: () => Effect.succeed(pulled),
          save: (file, _config, force) => {
            saves.push({ file, force })
            return Effect.succeed({ file: file ?? 'polar.config.json', status })
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
    output: stripAnsi(cli.output()),
    failed: exit._tag === 'Failure',
    saves,
  }
}

const meters = { config: { meters: [{}, {}] }, skipped: [] }

describe('polar config pull', () => {
  test('reports the written file', async () => {
    const { output, failed, saves } = await run(meters, 'written', [
      'billing.json',
      '--force',
    ])
    expect(failed).toBe(false)
    expect(saves).toEqual([{ file: 'billing.json', force: true }])
    expect(output).toContain(
      'Pulled 2 meters from Acme (sandbox) into billing.json',
    )
  })

  test('reports an up to date file', async () => {
    const { output } = await run(meters, 'unchanged')
    expect(output).toContain('polar.config.json is up to date with Acme')
  })

  test('lists skipped meters with a hint for missing external IDs', async () => {
    const { output, failed } = await run(
      {
        config: { meters: [] },
        skipped: [
          { id: 'meter-1', name: 'Legacy', reason: 'missing_external_id' },
          { id: 'meter-2', name: 'Old', reason: 'archived' },
        ],
      },
      'written',
    )
    expect(failed).toBe(false)
    expect(output).toContain('Skipped 2 meters:')
    expect(output).toContain('Legacy (meter-1): no external ID')
    expect(output).toContain('Old (meter-2): archived')
    expect(output).toContain('Set an external ID on meters')
  })
})
