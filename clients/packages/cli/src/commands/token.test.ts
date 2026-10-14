import { basename } from 'node:path'
import { Effect, Redacted } from 'effect'
import { beforeEach, expect, test } from 'vitest'
import { token as tokenCommand } from '@/commands/token'
import type { ActiveOrganization } from '@/schemas/Auth'
import { Organizations } from '@/services/organizations'
import { type TokenRequest, TokenHandoff } from '@/services/token-handoff'
import { runCli } from '@/utils/test-utils/cli'
import { fakeOrganizations } from '@/utils/test-utils/services'

const acme: ActiveOrganization = {
  id: 'org-1',
  name: 'Acme',
  slug: 'acme',
  environment: 'sandbox',
}

let requests: TokenRequest[]

let organizations: ReturnType<typeof fakeOrganizations>

const run = (args: string[]) => {
  const cli = runCli(tokenCommand, args)
  const promise = Effect.runPromise(
    cli.effect.pipe(
      Effect.provideService(Organizations, organizations.organizations),
      Effect.provideService(
        TokenHandoff,
        TokenHandoff.of({
          receive: (request, announce) =>
            announce(new URL('https://polar.sh/dashboard/acme/cli/token')).pipe(
              Effect.as(Redacted.make('polar_oat_secret')),
              Effect.tap(() => Effect.sync(() => requests.push(request))),
            ),
        }),
      ),
    ),
  )
  return { promise, output: cli.output }
}

beforeEach(() => {
  requests = []
  organizations = fakeOrganizations({
    items: [acme],
    selected: { id: acme.id, environment: acme.environment },
  })
})

test('prints only the token', async () => {
  const { promise, output } = run([
    '--scope',
    'products:read',
    '--scope',
    'checkouts:write',
  ])
  await promise

  expect(output().trim()).toBe('polar_oat_secret')
  expect(requests).toEqual([
    {
      organization: { slug: 'acme', environment: 'sandbox' },
      name: basename(process.cwd()),
      scopes: ['products:read', 'checkouts:write'],
    },
  ])
})
