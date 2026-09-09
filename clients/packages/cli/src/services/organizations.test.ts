import { beforeEach, expect, test } from 'bun:test'
import type { Polar as PolarSDK } from '@polar-sh/sdk'
import { Effect, Layer, Redacted } from 'effect'
import {
  AuthError,
  type ActiveOrganization,
  type PolarEnvironment,
} from '../schemas/Auth'
import { Auth, type Credential } from './auth'
import { Organizations, layer } from './organizations'
import { Polar } from './polar'

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

const auth = Auth.of({
  resolve: () => Effect.sync(() => credential),
  override: Effect.sync(() => credential.source === 'override'),
  login: () => Effect.succeed(false),
  logout: () => Effect.succeed(false),
  select: () =>
    Effect.sync(() => {
      selected = true
    }),
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
                result: {
                  items: pages[page - 1] ?? [],
                  pagination: { maxPage: pages.length },
                },
              })
            },
            get: ({ id }: { id: string }) => {
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
        Layer.mergeAll(Layer.succeed(Auth, auth), Layer.succeed(Polar, polar)),
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
      organization: first,
    },
  }
  pages = [[first], [second]]
  requests = []
  denied = selected = false
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
  expect(credential.session?.organization).toEqual(first)
  expect(selected).toBe(false)
  expect(requests).toEqual([{ id: second.id, environment: 'sandbox' }])
})

test('explicit IDs work with no saved selection and without enumeration', async () => {
  credential.session = { ...credential.session!, organization: undefined }
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
