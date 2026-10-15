import { expect, test } from 'vitest'
import { Effect } from 'effect'
import { secret } from '@/commands/webhook/secret'
import { BillingConfig } from '@/services/billing-config/service'
import { Organizations } from '@/services/organizations'
import { runCli } from '@/utils/test-utils/cli'
import { fakeOrganizations } from '@/utils/test-utils/services'

const acme = {
  id: 'org-1',
  name: 'Acme',
  slug: 'acme',
  environment: 'sandbox' as const,
}

const run = async (args: string[]) => {
  const lookups: Array<[string, string]> = []
  const cli = runCli(secret, args)
  await Effect.runPromise(
    cli.effect.pipe(
      Effect.provideService(
        BillingConfig,
        BillingConfig.of({
          load: () => Effect.die('unused'),
          plan: () => Effect.die('unused'),
          apply: () => Effect.die('unused'),
          pull: () => Effect.die('unused'),
          webhookSecret: (organization, key) => {
            lookups.push([organization.id, key])
            return Effect.succeed('polar_whs_abc')
          },
        }),
      ),
      Effect.provideService(
        Organizations,
        fakeOrganizations({
          items: [acme],
          selected: { id: acme.id, environment: acme.environment },
        }).organizations,
      ),
    ),
  )
  return { output: cli.output(), lookups }
}

test('prints only the secret, so it can be piped', async () => {
  const { output, lookups } = await run(['app'])
  expect(output).toBe('polar_whs_abc')
  expect(lookups).toEqual([['org-1', 'app']])
})

test('prints the key and secret as JSON', async () => {
  const { output } = await run(['app', '--json'])
  expect(JSON.parse(output)).toEqual({ key: 'app', secret: 'polar_whs_abc' })
})
