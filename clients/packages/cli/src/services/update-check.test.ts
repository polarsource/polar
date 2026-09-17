import { afterEach, beforeEach, describe, expect, vi, test } from 'vitest'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  checkForUpdateInBackground,
  showUpdateNotice,
} from '@/services/update-check'
import { stripAnsi } from '@/utils/test-utils/cli'
import { fakeHttp } from '@/utils/test-utils/http'
import { VERSION } from '@/version'

const releasesUrl =
  'https://api.github.com/repos/polarsource/polar/releases?per_page=100&page=1'

let home: string
let stderr: string[]
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
      tag_name: `polar-cli@${version}`,
      draft: false,
      prerelease: false,
      assets: [],
    },
  ])

const settle = () => new Promise((resolve) => setTimeout(resolve, 20))

beforeEach(async () => {
  home = await mkdtemp(join(tmpdir(), 'polar-home-'))
  stderr = []
  vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
    stderr.push(stripAnsi(String(chunk)))
    return true
  })
  http = fakeHttp()
})

afterEach(async () => {
  vi.restoreAllMocks()
  await rm(home, { recursive: true, force: true })
})

describe('showUpdateNotice', () => {
  test('stays silent without a cached check', () => {
    showUpdateNotice({ home })
    expect(stderr).toEqual([])
  })

  test('announces a newer cached release', async () => {
    await writeState({
      lastChecked: new Date().toISOString(),
      latestVersion: 'v99.0.0',
    })
    showUpdateNotice({ home })
    expect(stderr.join('')).toContain(`Update available ${VERSION} → v99.0.0`)
    expect(stderr.join('')).toContain('polar update')
  })

  test('stays silent when the cached release is not newer', async () => {
    await writeState({
      lastChecked: new Date().toISOString(),
      latestVersion: VERSION,
    })
    showUpdateNotice({ home })
    expect(stderr).toEqual([])
  })

  test('ignores a corrupt cache', async () => {
    await writeState('not json')
    showUpdateNotice({ home })
    expect(stderr).toEqual([])
  })
})

describe('checkForUpdateInBackground', () => {
  test('fetches and caches the latest release', async () => {
    http.routes[releasesUrl] = release('9.9.9')
    checkForUpdateInBackground({ home, http: http.layer })

    await vi.waitFor(() => expect(existsSync(stateFile())).toBe(true))
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
    checkForUpdateInBackground({ home, http: http.layer })

    await settle()
    expect(http.requests).toHaveLength(0)
  })

  test('re-checks once the cache is a day old', async () => {
    await writeState({
      lastChecked: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
      latestVersion: 'v1.0.0',
    })
    http.routes[releasesUrl] = release('2.0.0')
    checkForUpdateInBackground({ home, http: http.layer })

    await vi.waitFor(async () =>
      expect(
        JSON.parse(await readFile(stateFile(), 'utf8')).latestVersion,
      ).toBe('v2.0.0'),
    )
  })

  test('re-checks when the cache is corrupt', async () => {
    await writeState('not json')
    http.routes[releasesUrl] = release('2.0.0')
    checkForUpdateInBackground({ home, http: http.layer })

    await vi.waitFor(() => expect(http.requests).toHaveLength(1))
  })

  test('leaves no cache behind when the check fails', async () => {
    http.routes[releasesUrl] = () => {
      throw new Error('offline')
    }
    checkForUpdateInBackground({ home, http: http.layer })

    await vi.waitFor(() => expect(http.requests).toHaveLength(1))
    await settle()
    expect(existsSync(stateFile())).toBe(false)
  })
})
