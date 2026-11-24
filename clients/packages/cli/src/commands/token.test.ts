import { basename } from 'node:path'
import { Effect, Redacted } from 'effect'
import { beforeEach, expect, test } from 'vitest'
import { token as tokenCommand } from '@/commands/token'
import type { ActiveOrganization } from '@/schemas/Auth'
import { Organizations } from '@/services/organizations'
import { type TokenRequest, TokenHandoff } from '@/services/token-handoff'
import { runCli } from '@/utils/test-utils/cli'
import { fakeHttp } from '@/utils/test-utils/http'
import { fakeOrganizations } from '@/utils/test-utils/services'

const acme: ActiveOrganization = {
  id: 'org-1',
  name: 'Acme',
  slug: 'acme',
  environment: 'sandbox',
}

let requests: TokenRequest[]

let organizations: ReturnType<typeof fakeOrganizations>

const run = (args: string[], http = fakeHttp()) => {
  const cli = runCli(tokenCommand, args)
  const promise = Effect.runPromise(
    cli.effect.pipe(
      Effect.provide(http.layer),
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

test('shows the approval link on the setup page instead of opening the browser', async () => {
  const reports: unknown[] = []
  const http = fakeHttp({
    'POST https://sandbox-api.polar.sh/v1/agent-setup-runs/report': async (
      request,
    ) => {
      reports.push(await request.json())
      return Response.json({ drafts: null, approved_at: null })
    },
  })
  const { promise, output } = run(['--setup-run', 'acme#K7Q2M9XD'], http)
  await promise

  expect(output()).toBe('polar_oat_secret')
  expect(requests[0]?.openBrowser).toBe(false)
  expect(reports).toEqual([
    {
      code: 'K7Q2M9XD',
      stage: 'checkout',
      status: 'waiting',
      note: 'Approve the access token',
      url: 'https://polar.sh/dashboard/acme/cli/token',
    },
    { code: 'K7Q2M9XD', stage: 'checkout', status: 'in_progress' },
  ])
})
