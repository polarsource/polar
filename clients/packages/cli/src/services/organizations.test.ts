import { beforeEach, expect, test } from 'vitest'
import { Effect, Layer } from 'effect'
import type { ActiveOrganization, PolarEnvironment } from '@/schemas/Auth'
import { Auth } from '@/services/auth'
import { Organizations, layer } from '@/services/organizations'
import { Polar } from '@/services/polar'
import { CLIConfig } from '@/services/config'
import {
  fakeAuth,
  fakeConfig,
  fakePolar,
  overrideCredential,
} from '@/utils/test-utils/services'

const first = {
  id: 'org-1',
  name: 'First',
  slug: 'first',
  environment: 'sandbox' as const,
}
const second = {
  id: 'org-2',
  name: 'Second',
  slug: 'second',
  environment: 'production' as const,
}
let auth: ReturnType<typeof fakeAuth>
let config: ReturnType<typeof fakeConfig>
let pages: Partial<Record<PolarEnvironment, ActiveOrganization[][]>>
let requests: Array<{
  page?: number
  id?: string
  environment: PolarEnvironment
}>
let denied: boolean

const environmentOf = () => polar.state.requests.at(-1)!
const polar = fakePolar({
  organizations: {
    list: ({ page }: { page: number }) => {
      const environment = environmentOf()
      requests.push({ page, environment })
      if (denied) throw new Error('forbidden')
      const items = pages[environment] ?? [[]]
      return Promise.resolve({
        items: items[page - 1] ?? [],
        pagination: { max_page: items.length },
      })
    },
    get: (id: string) => {
      const environment = environmentOf()
      requests.push({ id, environment })
      const org = (pages[environment] ?? []).flat().find((org) => org.id === id)
      if (!org) throw new Error('missing')
      return Promise.resolve(org)
    },
  },
})

const service = () =>
  Effect.runPromise(
    Effect.service(Organizations).pipe(
      Effect.provide(
        layer.pipe(
          Layer.provide(
            Layer.mergeAll(
              Layer.succeed(Auth, auth.auth),
              Layer.succeed(Polar, polar.polar),
              Layer.succeed(CLIConfig, config.config),
            ),
          ),
        ),
      ),
    ),
  )

beforeEach(() => {
  auth = fakeAuth()
  config = fakeConfig({ id: first.id, environment: 'sandbox' })
  pages = { sandbox: [[first]], production: [[second]] }
  requests = []
  denied = false
})

test('selection stores the organization with its environment', async () => {
  const organizations = await service()
  await Effect.runPromise(
    organizations.select({ id: second.id, environment: 'production' }),
  )
  expect(await Effect.runPromise(organizations.selected)).toEqual({
    id: second.id,
    environment: 'production',
  })
  expect(await Effect.runPromise(organizations.resolve())).toEqual(second)
  expect(requests).toEqual([{ id: second.id, environment: 'production' }])
})

test('selection requires a session in that environment', async () => {
  auth.state.failure = new (await import('@/schemas/Auth')).AuthError({
    message: 'Not logged in to production',
  })
  const organizations = await service()
  await expect(
    Effect.runPromise(
      organizations.select({ id: second.id, environment: 'production' }),
    ),
  ).rejects.toThrow('Not logged in to production')
  expect(config.state.writes).toBe(0)
})

test('token overrides ignore saved selection and cannot change it', async () => {
  auth.state.credential = overrideCredential()
  const organizations = await service()
  expect(await Effect.runPromise(organizations.selected)).toBeUndefined()
  await expect(
    Effect.runPromise(
      organizations.select({ id: second.id, environment: 'production' }),
    ),
  ).rejects.toThrow('Unset POLAR_ACCESS_TOKEN')
  expect(config.state.activeOrganization?.id).toBe(first.id)
  expect(config.state.writes).toBe(0)
})

test('lists every page of every logged-in environment', async () => {
  pages = {
    sandbox: [[first], [{ ...first, id: 'org-3' }]],
    production: [[second]],
  }
  const organizations = await service()
  expect(await Effect.runPromise(organizations.listAll)).toEqual([
    first,
    { ...first, id: 'org-3' },
    second,
  ])
  expect(requests).toEqual([
    { page: 1, environment: 'sandbox' },
    { page: 2, environment: 'sandbox' },
    { page: 1, environment: 'production' },
  ])
})

test('only lists environments with a session', async () => {
  auth.state.sessions = ['production']
  const organizations = await service()
  expect(await Effect.runPromise(organizations.listAll)).toEqual([second])
})

test('an explicit id is looked up across logged-in environments without persisting it', async () => {
  const organizations = await service()
  expect(await Effect.runPromise(organizations.resolve(second.id))).toEqual(
    second,
  )
  expect(config.state.activeOrganization?.id).toBe(first.id)
  expect(config.state.writes).toBe(0)
  expect(requests).toEqual([
    { id: second.id, environment: 'sandbox' },
    { id: second.id, environment: 'production' },
  ])
})

test('an explicit id in a single environment surfaces the real error', async () => {
  auth.state.sessions = ['sandbox']
  const organizations = await service()
  await expect(
    Effect.runPromise(organizations.resolve('missing')),
  ).rejects.toThrow('missing')
})

test('an unknown explicit id names the environments that were searched', async () => {
  const organizations = await service()
  await expect(
    Effect.runPromise(organizations.resolve('missing')),
  ).rejects.toThrow('inaccessible in sandbox and production')
})

test('explicit IDs require a session', async () => {
  auth.state.sessions = []
  const organizations = await service()
  await expect(
    Effect.runPromise(organizations.resolve(first.id)),
  ).rejects.toThrow('Not logged in')
  expect(requests).toEqual([])
})

test('no selection fails with guidance instead of choosing an organization', async () => {
  config = fakeConfig()
  const organizations = await service()
  await expect(Effect.runPromise(organizations.resolve())).rejects.toThrow(
    'polar auth org',
  )
  expect(requests).toEqual([])
})

test('a stale selection fails rather than choosing another organization', async () => {
  pages = { sandbox: [[]], production: [[second]] }
  const organizations = await service()
  await expect(Effect.runPromise(organizations.resolve())).rejects.toThrow(
    'missing',
  )
  expect(config.state.writes).toBe(0)
})

test('override uses its own environment and only selects a sole accessible organization', async () => {
  auth.state.credential = overrideCredential()
  auth.state.environment = 'sandbox'
  pages = { sandbox: [[first, { ...first, id: 'org-3' }]] }
  const organizations = await service()
  await expect(Effect.runPromise(organizations.resolve())).rejects.toThrow(
    '--org <id>',
  )
  pages = { sandbox: [[first]] }
  expect(await Effect.runPromise(organizations.resolve())).toEqual(first)
  pages = { sandbox: [[]] }
  await expect(Effect.runPromise(organizations.resolve())).rejects.toThrow(
    '--org <id>',
  )
  expect(requests.every((request) => request.environment === 'sandbox')).toBe(
    true,
  )
  expect(config.state.writes).toBe(0)
})

test('override enumeration reports permission errors but explicit accessible IDs still work', async () => {
  auth.state.credential = overrideCredential()
  denied = true
  const organizations = await service()
  await expect(Effect.runPromise(organizations.listAll)).rejects.toThrow(
    'forbidden',
  )
  expect(await Effect.runPromise(organizations.resolve(second.id))).toEqual(
    second,
  )
})
