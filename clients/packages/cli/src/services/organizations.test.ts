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

const first = { id: 'org-1', name: 'First', slug: 'first' }
const second = { id: 'org-2', name: 'Second', slug: 'second' }
let auth: ReturnType<typeof fakeAuth>
let config: ReturnType<typeof fakeConfig>
let pages: ActiveOrganization[][]
let requests: Array<{
  page?: number
  id?: string
  environment: PolarEnvironment
}>
let denied: boolean

const polar = fakePolar({
  organizations: {
    list: ({ page }: { page: number }) => {
      requests.push({ page, environment: polar.state.requests.at(-1)! })
      if (denied) throw new Error('forbidden')
      return Promise.resolve({
        items: pages[page - 1] ?? [],
        pagination: { max_page: pages.length },
      })
    },
    get: (id: string) => {
      requests.push({ id, environment: polar.state.requests.at(-1)! })
      const org = pages.flat().find((org) => org.id === id)
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
  config = fakeConfig({ sandbox: first.id, production: first.id })
  pages = [[first], [second]]
  requests = []
  denied = false
})

test('selection is stored in config separately for each environment', async () => {
  const organizations = await service()
  await Effect.runPromise(organizations.select('sandbox', second.id))
  expect(await Effect.runPromise(organizations.selected('sandbox'))).toBe(
    second.id,
  )
  expect(await Effect.runPromise(organizations.resolve('sandbox'))).toEqual(
    second,
  )
  expect(config.state.activeOrganizations.production).toBe(first.id)
})

test('token overrides ignore saved selection and cannot change it', async () => {
  auth.state.credential = overrideCredential()
  const organizations = await service()
  expect(
    await Effect.runPromise(organizations.selected('sandbox')),
  ).toBeUndefined()
  await expect(
    Effect.runPromise(organizations.select('sandbox', second.id)),
  ).rejects.toThrow('Unset POLAR_ACCESS_TOKEN')
  expect(config.state.activeOrganizations.sandbox).toBe(first.id)
  expect(config.state.writes).toBe(0)
})

test('enumerates every page on the explicitly selected environment', async () => {
  const organizations = await service()
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
  const organizations = await service()
  expect(
    await Effect.runPromise(organizations.resolve('sandbox', second.id)),
  ).toEqual(second)
  expect(config.state.activeOrganizations.sandbox).toBe(first.id)
  expect(config.state.writes).toBe(0)
  expect(requests).toEqual([{ id: second.id, environment: 'sandbox' }])
})

test('explicit IDs work with no saved selection and without enumeration', async () => {
  delete config.state.activeOrganizations.sandbox
  denied = true
  const organizations = await service()
  expect(
    await Effect.runPromise(organizations.resolve('sandbox', first.id)),
  ).toEqual(first)
  await expect(
    Effect.runPromise(organizations.resolve('sandbox')),
  ).rejects.toThrow('polar auth org')
})

test('stale or unauthorized organization IDs fail rather than choosing another', async () => {
  pages = [[second]]
  const organizations = await service()
  await expect(
    Effect.runPromise(organizations.resolve('production')),
  ).rejects.toThrow('missing')
  await expect(
    Effect.runPromise(organizations.resolve('production', 'missing')),
  ).rejects.toThrow('missing')
  expect(config.state.writes).toBe(0)
})

test('override uses its own permissions and only selects a sole accessible organization', async () => {
  auth.state.credential = overrideCredential()
  const organizations = await service()
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
  expect(config.state.writes).toBe(0)
})

test('override enumeration reports permission errors but explicit accessible IDs still work', async () => {
  auth.state.credential = overrideCredential()
  denied = true
  const organizations = await service()
  await expect(
    Effect.runPromise(organizations.list('sandbox')),
  ).rejects.toThrow('forbidden')
  expect(
    await Effect.runPromise(organizations.resolve('sandbox', second.id)),
  ).toEqual(second)
})
