import { beforeEach, describe, expect, test } from 'vitest'
import { Effect } from 'effect'
import type { ActiveOrganization } from '@/schemas/Auth'
import { Auth } from '@/services/auth'
import { disable } from '@/services/billing-config/disable'
import { authenticatedClient } from '@/services/client'
import { fakeHttp } from '@/utils/test-utils/http'
import { fakeAuth } from '@/utils/test-utils/services'

const disableUrl = 'https://sandbox-api.polar.sh/v1/config/disable'

const acme: ActiveOrganization = {
  id: 'org-1',
  name: 'Acme',
  slug: 'acme',
  environment: 'sandbox',
}

let api: ReturnType<typeof fakeHttp>

beforeEach(() => {
  api = fakeHttp()
})

const run = () =>
  Effect.runPromise(
    Effect.gen(function* () {
      const clients = {
        sandbox: yield* authenticatedClient('sandbox'),
        production: yield* authenticatedClient('production'),
        local: yield* authenticatedClient('local'),
      }
      return yield* disable(clients)(acme)
    }).pipe(
      Effect.provide(api.layer),
      Effect.provideService(Auth, fakeAuth({ environment: 'sandbox' }).auth),
    ),
  )

const failure = (promise: Promise<unknown>) =>
  promise.then(
    () => {
      throw new Error('expected failure')
    },
    (error: unknown) => error as { message: string; hint?: string },
  )

describe('disable', () => {
  test('disables config for the organization', async () => {
    api.routes[`POST ${disableUrl}`] = new Response(null, { status: 204 })

    await run()

    expect(api.requests[0]?.headers.get('Polar-Organization')).toBe('org-1')
  })

  test('explains why config cannot be disabled after a second publish', async () => {
    api.routes[`POST ${disableUrl}`] = Response.json(
      { error: 'ConfigCatalogPublished', detail: 'Published.' },
      { status: 409 },
    )

    const error = await failure(run())

    expect(error.message).toBe('Config cannot be disabled for Acme')
    expect(error.hint).toContain('More than one catalog was published')
  })

  test('reports config that is not enabled', async () => {
    api.routes[`POST ${disableUrl}`] = Response.json(
      { error: 'ConfigAsCodeNotEnabled', detail: 'Not enabled.' },
      { status: 403 },
    )

    const error = await failure(run())

    expect(error.message).toBe('Config is not enabled for Acme')
  })
})
