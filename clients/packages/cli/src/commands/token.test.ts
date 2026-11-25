import { basename } from 'node:path'
import { Effect, Redacted } from 'effect'
import { beforeEach, expect, test, vi } from 'vitest'
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

const globex: ActiveOrganization = {
  id: 'org-2',
  name: 'Globex',
  slug: 'globex',
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
    items: [acme, globex],
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

test('creates the token for the organization passed with --org', async () => {
  const { promise } = run(['--org', globex.id, '--scope', 'events:write'])
  await promise

  expect(requests).toEqual([
    {
      organization: { slug: 'globex', environment: 'sandbox' },
      name: basename(process.cwd()),
      scopes: ['events:write'],
    },
  ])
})

test('says what was created and how to use a sandbox token', async () => {
  const stderr = vi.spyOn(process.stderr, 'write').mockReturnValue(true)
  const { promise } = run([])
  await promise
  const notes = stderr.mock.calls.map(([chunk]) => String(chunk)).join('')
  stderr.mockRestore()

  expect(notes).toContain(
    'Opening your browser to create an access token for acme on sandbox...',
  )
  expect(notes).toContain('Created an access token for acme on sandbox')
  expect(notes).toContain(
    "Pass environment: 'sandbox' when you create the SDK client.",
  )
})
