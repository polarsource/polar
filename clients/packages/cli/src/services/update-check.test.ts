import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { BunFileSystem } from '@effect/platform-bun'
import { Effect, Layer } from 'effect'
import { availableUpdate, checkForUpdate } from '@/services/update-check'
import { PACKAGE_NAME, REGISTRY_URL } from '@/services/updater'
import { fakeHttp } from '@/utils/test-utils/http'
import { VERSION } from '@/version'

const releasesUrl =
  'https://api.github.com/repos/polarsource/polar/releases?per_page=100&page=1'

let home: string
let http: ReturnType<typeof fakeHttp>
let binary: string
let packaged: string

const stateFile = () => join(home, '.polar', 'update-check.json')

const writeState = async (state: unknown) => {
  await mkdir(join(home, '.polar'), { recursive: true })
  await writeFile(
    stateFile(),
    typeof state === 'string' ? state : JSON.stringify(state),
  )
}

const readState = async () => JSON.parse(await readFile(stateFile(), 'utf8'))

const fresh = (latestVersion: string, source?: string) => ({
  lastChecked: new Date().toISOString(),
  latestVersion,
  source,
})

const release = (version: string) => () =>
  Response.json([
    {
      tag_name: `@polar-sh/cli@${version}`,
      draft: false,
      prerelease: false,
      assets: [],
    },
  ])

const registry = (version: string) => () => Response.json({ version })

const check = (executable = binary) =>
  Effect.runPromise(
    checkForUpdate({ home, executable }).pipe(
      Effect.provide(Layer.mergeAll(http.layer, BunFileSystem.layer)),
    ),
  )

const available = (executable = binary) =>
  Effect.runPromise(
    availableUpdate({ home, executable }).pipe(
      Effect.provide(BunFileSystem.layer),
    ),
  )

beforeEach(async () => {
  home = await mkdtemp(join(tmpdir(), 'polar-home-'))
  http = fakeHttp()

  binary = join(home, '.polar', 'bin', 'polar')
  await mkdir(join(home, '.polar', 'bin'), { recursive: true })
  await writeFile(binary, 'binary')

  const pkg = join(home, 'node_modules', '@polar-sh', 'cli')
  packaged = join(pkg, 'bin', 'polar.exe')
  await mkdir(join(pkg, 'bin'), { recursive: true })
  await writeFile(
    join(pkg, 'package.json'),
    JSON.stringify({ name: PACKAGE_NAME, bin: { polar: 'bin/polar.exe' } }),
  )
  await writeFile(packaged, 'binary')
})

afterEach(async () => {
  await rm(home, { recursive: true, force: true })
})

describe('availableUpdate', () => {
  test('finds nothing without a cached check', async () => {
    await expect(available()).resolves.toBeUndefined()
  })

  test('returns a newer GitHub release for the standalone binary', async () => {
    await writeState(fresh('v99.0.0', 'github'))
    await expect(available(binary)).resolves.toBe('v99.0.0')
  })

  test('returns a newer npm version for a package install', async () => {
    await writeState(fresh('v99.0.0', 'npm'))
    await expect(available(packaged)).resolves.toBe('v99.0.0')
  })

  test.each([
    ['a package install', 'github', () => packaged],
    ['the standalone binary', 'npm', () => binary],
    ['any install when the source is missing', undefined, () => binary],
  ])(
    'ignores a cached version from another source for %s',
    async (_, source, executable) => {
      await writeState(fresh('v99.0.0', source))
      await expect(available(executable())).resolves.toBeUndefined()
    },
  )

  test('finds nothing when the cached release is not newer', async () => {
    await writeState(fresh(VERSION, 'github'))
    await expect(available()).resolves.toBeUndefined()
  })

  test('ignores a corrupt cache', async () => {
    await writeState('not json')
    await expect(available()).resolves.toBeUndefined()
  })
})

describe('checkForUpdate', () => {
  test('caches the latest GitHub release for the standalone binary', async () => {
    http.routes[releasesUrl] = release('9.9.9')
    await check(binary)

    const state = await readState()
    expect(state.latestVersion).toBe('v9.9.9')
    expect(state.source).toBe('github')
    expect(Date.now() - new Date(state.lastChecked).getTime()).toBeLessThan(
      60_000,
    )
  })

  test('caches the npm version for a package install, ignoring GitHub', async () => {
    http.routes[releasesUrl] = release('9.9.9')
    http.routes[REGISTRY_URL] = registry('2.0.1')
    await check(packaged)

    expect(http.urls()).toEqual([REGISTRY_URL])
    expect(await readState()).toMatchObject({
      latestVersion: 'v2.0.1',
      source: 'npm',
    })
  })

  test('skips the check when it ran recently from the same source', async () => {
    await writeState(fresh('v1.0.0', 'npm'))
    await check(packaged)

    expect(http.requests).toHaveLength(0)
  })

  test.each([
    ['another source', 'github'],
    ['no source', undefined],
  ])('refreshes a recent check from %s', async (_, source) => {
    await writeState(fresh('v2.0.2', source))
    http.routes[REGISTRY_URL] = registry('2.0.1')
    await check(packaged)

    expect(http.urls()).toEqual([REGISTRY_URL])
    expect(await readState()).toMatchObject({
      latestVersion: 'v2.0.1',
      source: 'npm',
    })
  })

  test('re-checks once the cache is a day old', async () => {
    await writeState({
      lastChecked: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
      latestVersion: 'v1.0.0',
      source: 'github',
    })
    http.routes[releasesUrl] = release('2.0.0')
    await check()

    expect((await readState()).latestVersion).toBe('v2.0.0')
  })

  test('re-checks when the cache is corrupt', async () => {
    await writeState('not json')
    http.routes[releasesUrl] = release('2.0.0')
    await check()

    expect(http.requests).toHaveLength(1)
  })

  test.each([
    ['GitHub', releasesUrl, () => binary],
    ['npm', REGISTRY_URL, () => packaged],
  ])(
    'leaves no cache behind when the %s check fails',
    async (_, url, executable) => {
      http.routes[url] = () => {
        throw new Error('offline')
      }
      await check(executable())

      expect(http.requests).toHaveLength(1)
      expect(existsSync(stateFile())).toBe(false)
    },
  )
})
