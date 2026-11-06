import { beforeEach, describe, expect, test } from 'vitest'
import { Effect } from 'effect'
import type { ActiveOrganization } from '@/schemas/Auth'
import type { Catalog } from '@/schemas/BillingConfig'
import { Auth } from '@/services/auth'
import { catalogs, publish } from '@/services/billing-config/publish'
import { authenticatedClient } from '@/services/client'
import { fakeHttp } from '@/utils/test-utils/http'
import { fakeAuth } from '@/utils/test-utils/services'

const listUrl =
  'https://sandbox-api.polar.sh/v1/catalogs/?organization_id=org-1&status=draft&status=live'
const publishUrl = 'https://sandbox-api.polar.sh/v1/catalogs/cat-draft/publish'

const acme: ActiveOrganization = {
  id: 'org-1',
  name: 'Acme',
  slug: 'acme',
  environment: 'sandbox',
}

const draft: Catalog = { id: 'cat-draft', name: null }

let api: ReturnType<typeof fakeHttp>

beforeEach(() => {
  api = fakeHttp()
})

const run = <A, E>(
  effect: (
    clients: Parameters<typeof catalogs>[0],
  ) => Effect.Effect<A, E, never>,
) =>
  Effect.runPromise(
    Effect.gen(function* () {
      const clients = {
        sandbox: yield* authenticatedClient('sandbox'),
        production: yield* authenticatedClient('production'),
        local: yield* authenticatedClient('local'),
      }
      return yield* effect(clients)
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

describe('catalogs', () => {
  test('finds the live and draft catalogs of the organization', async () => {
    api.routes[`GET ${listUrl}`] = Response.json({
      items: [
        { id: 'cat-draft', name: null, status: 'draft' },
        { id: 'cat-live', name: 'v3', status: 'live' },
      ],
    })

    const result = await run((clients) => catalogs(clients)(acme))

    expect(api.requests[0]?.headers.get('Polar-Organization')).toBe('org-1')
    expect(result).toEqual({
      live: { id: 'cat-live', name: 'v3' },
      draft: { id: 'cat-draft', name: null },
    })
  })

  test('reports no draft', async () => {
    api.routes[`GET ${listUrl}`] = Response.json({ items: [] })

    const result = await run((clients) => catalogs(clients)(acme))

    expect(result).toEqual({ live: null, draft: null })
  })
})

describe('publish', () => {
  test('publishes the draft and returns the live catalog', async () => {
    api.routes[`POST ${publishUrl}`] = Response.json({
      id: 'cat-draft',
      name: 'v4',
      status: 'live',
    })

    const result = await run((clients) => publish(clients)(acme, draft))

    expect(result).toEqual({ id: 'cat-draft', name: 'v4' })
  })

  test('asks to retry when the draft was already published', async () => {
    api.routes[`POST ${publishUrl}`] = Response.json(
      { error: 'CatalogNotDraft', detail: 'Not a draft.' },
      { status: 409 },
    )

    const error = await failure(run((clients) => publish(clients)(acme, draft)))

    expect(error.message).toBe(
      'The draft was published or discarded in the meantime',
    )
  })

  test('asks to retry when the draft was discarded', async () => {
    api.routes[`POST ${publishUrl}`] = Response.json(
      { error: 'CatalogNotFound', detail: 'No catalog.' },
      { status: 404 },
    )
    api.routes[`GET ${listUrl}`] = Response.json({ items: [] })

    const error = await failure(run((clients) => publish(clients)(acme, draft)))

    expect(error.message).toBe(
      'The draft was published or discarded in the meantime',
    )
  })

  test('explains a missing permission when the draft is still there', async () => {
    api.routes[`POST ${publishUrl}`] = Response.json(
      { error: 'CatalogNotFound', detail: 'No catalog.' },
      { status: 404 },
    )
    api.routes[`GET ${listUrl}`] = Response.json({
      items: [{ id: 'cat-draft', name: null, status: 'draft' }],
    })

    const error = await failure(run((clients) => publish(clients)(acme, draft)))

    expect(error.message).toBe('You cannot publish the draft of Acme')
    expect(error.hint).toContain('manage products')
  })

  test('asks for the products:write scope on 403', async () => {
    api.routes[`POST ${publishUrl}`] = Response.json(
      { error: 'NotPermitted', detail: 'Not permitted' },
      { status: 403 },
    )

    const error = await failure(run((clients) => publish(clients)(acme, draft)))

    expect(error.hint).toBe('The token needs the products:write scope.')
  })
})
