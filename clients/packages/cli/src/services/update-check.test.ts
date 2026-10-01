import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Effect } from 'effect'
import { availableUpdate, checkForUpdate } from '@/services/update-check'
import { fakeHttp } from '@/utils/test-utils/http'
import { VERSION } from '@/version'

const releasesUrl =
  'https://api.github.com/repos/polarsource/polar/releases?per_page=100&page=1'

let home: string
let http: ReturnType<typeof fakeHttp>

const stateFile = () => join(home, '.polar', 'update-check.json')

const writeState = async (state: unknown) => {
  await mkdir(join(home, '.polar'), { recursive: true })
  await writeFile(
    stateFile(),
    typeof state === 'string' ? state : JSON.stringify(state),
  )
}

const release = (version: string) => () =>
  Response.json([
    {
      tag_name: `@polar-sh/cli@${version}`,
      draft: false,
      prerelease: false,
      assets: [],
    },
  ])

const check = () =>
  Effect.runPromise(checkForUpdate({ home }).pipe(Effect.provide(http.layer)))

beforeEach(async () => {
  home = await mkdtemp(join(tmpdir(), 'polar-home-'))
  http = fakeHttp()
})

afterEach(async () => {
  await rm(home, { recursive: true, force: true })
})

describe('availableUpdate', () => {
  test('finds nothing without a cached check', () => {
    expect(availableUpdate({ home })).toBeUndefined()
  })

  test('returns a newer cached release', async () => {
    await writeState({
      lastChecked: new Date().toISOString(),
      latestVersion: 'v99.0.0',
    })
    expect(availableUpdate({ home })).toBe('v99.0.0')
  })

  test('finds nothing when the cached release is not newer', async () => {
    await writeState({
      lastChecked: new Date().toISOString(),
      latestVersion: VERSION,
    })
    expect(availableUpdate({ home })).toBeUndefined()
  })

  test('ignores a corrupt cache', async () => {
    await writeState('not json')
    expect(availableUpdate({ home })).toBeUndefined()
  })
})

describe('checkForUpdate', () => {
  test('fetches and caches the latest release', async () => {
    http.routes[releasesUrl] = release('9.9.9')
    await check()

    const state = JSON.parse(await readFile(stateFile(), 'utf8'))
    expect(state.latestVersion).toBe('v9.9.9')
    expect(Date.now() - new Date(state.lastChecked).getTime()).toBeLessThan(
      60_000,
    )
  })

  test('skips the check when it ran recently', async () => {
    await writeState({
      lastChecked: new Date().toISOString(),
      latestVersion: 'v1.0.0',
    })
    await check()

    expect(http.requests).toHaveLength(0)
  })

  test('re-checks once the cache is a day old', async () => {
    await writeState({
      lastChecked: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
      latestVersion: 'v1.0.0',
    })
    http.routes[releasesUrl] = release('2.0.0')
    await check()

    expect(JSON.parse(await readFile(stateFile(), 'utf8')).latestVersion).toBe(
      'v2.0.0',
    )
  })

  test('re-checks when the cache is corrupt', async () => {
    await writeState('not json')
    http.routes[releasesUrl] = release('2.0.0')
    await check()

    expect(http.requests).toHaveLength(1)
  })

  test('leaves no cache behind when the check fails', async () => {
    http.routes[releasesUrl] = () => {
      throw new Error('offline')
    }
    await check()

    expect(http.requests).toHaveLength(1)
    expect(existsSync(stateFile())).toBe(false)
  })
})
