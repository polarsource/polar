import { basename } from 'node:path'
import { Effect, Redacted } from 'effect'
import { beforeEach, expect, test } from 'vitest'
import { token as tokenCommand } from '@/commands/token'
import type { ActiveOrganization, PolarEnvironment } from '@/schemas/Auth'
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

test('prints the token and environment as KEY=value lines', async () => {
  const { promise, output } = run([
    '--scope',
    'products:read',
    '--scope',
    'checkouts:write',
  ])
  await promise

  expect(output().trim()).toBe(
    'POLAR_ACCESS_TOKEN=polar_oat_secret\nPOLAR_ENVIRONMENT=sandbox',
  )
  expect(requests).toEqual([
    {
      organization: { slug: 'acme', environment: 'sandbox' },
      name: basename(process.cwd()),
      scopes: ['products:read', 'checkouts:write'],
    },
  ])
})

const selectEnvironment = (environment: PolarEnvironment) => {
  organizations = fakeOrganizations({
    items: [{ ...acme, environment }],
    selected: { id: acme.id, environment },
  })
}

test('prints only the token for production', async () => {
  selectEnvironment('production')
  const { promise, output } = run([])
  await promise

  expect(output().trim()).toBe('POLAR_ACCESS_TOKEN=polar_oat_secret')
})

test('prints the local API URL for a local session', async () => {
  selectEnvironment('local')
  const { promise, output } = run([])
  await promise

  expect(output().trim()).toBe(
    'POLAR_ACCESS_TOKEN=polar_oat_secret\nPOLAR_API_URL=http://127.0.0.1:8000',
  )
})
