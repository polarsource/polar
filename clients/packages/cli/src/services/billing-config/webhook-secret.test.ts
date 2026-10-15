import { beforeEach, describe, expect, test } from 'vitest'
import { Effect } from 'effect'
import type { ActiveOrganization } from '@/schemas/Auth'
import { Auth } from '@/services/auth'
import { webhookSecret } from '@/services/billing-config/webhook-secret'
import { authenticatedClient } from '@/services/client'
import { fakeHttp } from '@/utils/test-utils/http'
import { fakeAuth } from '@/utils/test-utils/services'

const endpointUrl =
  'https://sandbox-api.polar.sh/v1/webhooks/endpoints/external/app'

const acme: ActiveOrganization = {
  id: 'org-1',
  name: 'Acme',
  slug: 'acme',
  environment: 'sandbox',
}

let api: ReturnType<typeof fakeHttp>

const run = (key: string) =>
  Effect.runPromise(
    Effect.gen(function* () {
      const clients = {
        sandbox: yield* authenticatedClient('sandbox'),
        production: yield* authenticatedClient('production'),
        local: yield* authenticatedClient('local'),
      }
      return yield* webhookSecret(clients)(acme, key)
    }).pipe(
      Effect.provide(api.layer),
      Effect.provideService(Auth, fakeAuth({ environment: 'sandbox' }).auth),
    ),
  )

beforeEach(() => {
  api = fakeHttp()
})

describe('webhookSecret', () => {
  test('looks the endpoint up by its config key in the organization', async () => {
    api.routes[`GET ${endpointUrl}`] = Response.json({
      id: 'whe-1',
      external_id: 'app',
      secret: 'polar_whs_abc',
    })

    expect(await run('app')).toBe('polar_whs_abc')
    const [request] = api.requests
    expect(request?.headers.get('Polar-Organization')).toBe('org-1')
    expect(request?.headers.get('Polar-Version')).toBe('2027-01')
  })

  test('explains a key with no endpoint', async () => {
    api.routes[`GET ${endpointUrl}`] = Response.json(
      { error: 'ResourceNotFound', detail: 'Not found' },
      { status: 404 },
    )

    const error = await run('app').then(
      () => {
        throw new Error('expected failure')
      },
      (error: unknown) => error as { message: string },
    )

    expect(error.message).toBe('Acme has no webhook endpoint app')
  })
})
