import { beforeEach, expect, test } from 'vitest'
import type { Polar as PolarSDK } from '@polar-sh/sdk/2026-04'
import { Effect, Layer, Redacted } from 'effect'
import {
  AuthError,
  type ActiveOrganization,
  type PolarEnvironment,
} from '@/schemas/Auth'
import { Auth, type Credential } from '@/services/auth'
import { Organizations, layer } from '@/services/organizations'
import { Polar } from '@/services/polar'
import { CLIConfig } from '@/services/config'

const first = { id: 'org-1', name: 'First', slug: 'first' }
const second = { id: 'org-2', name: 'Second', slug: 'second' }
let credential: Credential
let pages: ActiveOrganization[][]
let requests: Array<{
  page?: number
  id?: string
  environment: PolarEnvironment
}>
let denied: boolean
let selected: boolean
let activeOrganizations: Partial<Record<PolarEnvironment, string>>

const auth = Auth.of({
  resolve: () => Effect.sync(() => credential),
  override: Effect.sync(() => credential.source === 'override'),
  login: () => Effect.succeed(false),
  logout: () => Effect.succeed(false),
})
const polar = Polar.of({
  getClient: () => Effect.die('unused'),
  use: (fn, environment = 'sandbox') =>
    Effect.tryPromise({
      try: () =>
        fn({
          organizations: {
            list: ({ page }: { page: number }) => {
              requests.push({ page, environment })
              if (denied) throw new Error('forbidden')
              return Promise.resolve({
                items: pages[page - 1] ?? [],
                pagination: { max_page: pages.length },
              })
            },
            get: (id: string) => {
              requests.push({ id, environment })
              const org = pages.flat().find((org) => org.id === id)
              if (!org) throw new Error('missing')
              return Promise.resolve(org)
            },
          },
        } as unknown as PolarSDK),
      catch: () =>
        new AuthError({ message: 'Organization missing or access denied.' }),
    }),
})
const service = Effect.service(Organizations).pipe(
  Effect.provide(
    layer.pipe(
      Layer.provide(
        Layer.mergeAll(
          Layer.succeed(Auth, auth),
          Layer.succeed(Polar, polar),
          Layer.succeed(
            CLIConfig,
            CLIConfig.of({
              getActiveOrganization: (env) =>
                Effect.sync(() => activeOrganizations[env]),
              setActiveOrganization: (env, id) =>
                Effect.sync(() => {
                  selected = true
                  if (id === undefined) delete activeOrganizations[env]
                  else activeOrganizations[env] = id
                }),
            }),
          ),
        ),
      ),
    ),
  ),
)

beforeEach(() => {
  credential = {
    source: 'keyring',
    accessToken: Redacted.make('access'),
    session: {
      version: 1,
      accessToken: Redacted.make('access'),
      expiresAt: Date.now() + 3600_000,
      scopes: [],
    },
  }
  activeOrganizations = { sandbox: first.id, production: first.id }
  pages = [[first], [second]]
  requests = []
  denied = selected = false
})

test('selection is stored in config separately for each environment', async () => {
  const organizations = await Effect.runPromise(service)
  await Effect.runPromise(organizations.select('sandbox', second.id))
  expect(await Effect.runPromise(organizations.selected('sandbox'))).toBe(
    second.id,
  )
  expect(await Effect.runPromise(organizations.resolve('sandbox'))).toEqual(
    second,
  )
  expect(activeOrganizations.production).toBe(first.id)
  expect(credential.session).not.toHaveProperty('organization')
})

test('token overrides ignore saved selection and cannot change it', async () => {
  credential = { source: 'override', accessToken: Redacted.make('ci') }
  const organizations = await Effect.runPromise(service)
  expect(
    await Effect.runPromise(organizations.selected('sandbox')),
  ).toBeUndefined()
  await expect(
    Effect.runPromise(organizations.select('sandbox', second.id)),
  ).rejects.toThrow('Unset POLAR_ACCESS_TOKEN')
  expect(activeOrganizations.sandbox).toBe(first.id)
  expect(selected).toBe(false)
})

test('enumerates every page on the explicitly selected environment', async () => {
  const organizations = await Effect.runPromise(service)
  expect(await Effect.runPromise(organizations.list('production'))).toEqual([
    first,
    second,
  ])
  expect(requests).toEqual([
    { page: 1, environment: 'production' },
    { page: 2, environment: 'production' },
  ])
})

test('explicit organization overrides selection without persisting it', async () => {
  const organizations = await Effect.runPromise(service)
  expect(
    await Effect.runPromise(organizations.resolve('sandbox', second.id)),
  ).toEqual(second)
  expect(activeOrganizations.sandbox).toBe(first.id)
  expect(selected).toBe(false)
  expect(requests).toEqual([{ id: second.id, environment: 'sandbox' }])
})

test('explicit IDs work with no saved selection and without enumeration', async () => {
  delete activeOrganizations.sandbox
  denied = true
  const organizations = await Effect.runPromise(service)
  expect(
    await Effect.runPromise(organizations.resolve('sandbox', first.id)),
  ).toEqual(first)
  await expect(
    Effect.runPromise(organizations.resolve('sandbox')),
  ).rejects.toThrow('polar auth org')
})

test('stale or unauthorized organization IDs fail rather than choosing another', async () => {
  pages = [[second]]
  const organizations = await Effect.runPromise(service)
  await expect(
    Effect.runPromise(organizations.resolve('production')),
  ).rejects.toThrow('missing or access denied')
  await expect(
    Effect.runPromise(organizations.resolve('production', 'missing')),
  ).rejects.toThrow('missing or access denied')
  expect(selected).toBe(false)
})

test('override uses its own permissions and only selects a sole accessible organization', async () => {
  credential = { source: 'override', accessToken: Redacted.make('ci') }
  const organizations = await Effect.runPromise(service)
  await expect(
    Effect.runPromise(organizations.resolve('sandbox')),
  ).rejects.toThrow('--org <id>')
  pages = [[second]]
  expect(await Effect.runPromise(organizations.resolve('sandbox'))).toEqual(
    second,
  )
  pages = [[]]
  await expect(
    Effect.runPromise(organizations.resolve('sandbox')),
  ).rejects.toThrow('--org <id>')
  expect(selected).toBe(false)
})

test('override enumeration reports permission errors but explicit accessible IDs still work', async () => {
  credential = { source: 'override', accessToken: Redacted.make('ci') }
  denied = true
  const organizations = await Effect.runPromise(service)
  await expect(
    Effect.runPromise(organizations.list('sandbox')),
  ).rejects.toThrow('access denied')
  expect(
    await Effect.runPromise(organizations.resolve('sandbox', second.id)),
  ).toEqual(second)
})
