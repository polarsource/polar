import { beforeEach, describe, expect, test } from 'vitest'
import { Effect } from 'effect'
import { getLatestRelease, isNewerVersion } from '@/services/github-releases'
import { fakeHttp } from '@/utils/test-utils/http'
import { VERSION } from '@/version'
import { version } from '../../package.json'

const page = (number: number) =>
  `https://api.github.com/repos/polarsource/polar/releases?per_page=100&page=${number}`

const release = {
  tag_name: 'polar-cli@1.4.0',
  draft: false,
  prerelease: false,
  assets: [
    {
      name: 'polar-darwin-arm64.zip',
      browser_download_url:
        'https://github.com/polarsource/polar/releases/download/polar-cli@1.4.0/polar-darwin-arm64.zip',
    },
  ],
}

let http: ReturnType<typeof fakeHttp>

const latestRelease = () =>
  Effect.runPromise(getLatestRelease.pipe(Effect.provide(http.layer)))

beforeEach(() => {
  http = fakeHttp()
})

describe('getLatestRelease', () => {
  test('ignores other packages, drafts, prereleases, and non-version tags', async () => {
    http.routes[page(1)] = Response.json([
      { ...release, tag_name: '@polar-sh/sdk@99.0.0' },
      { ...release, tag_name: 'polar-cli@2.0.0', draft: true },
      { ...release, tag_name: 'polar-cli@3.0.0', prerelease: true },
      { ...release, tag_name: 'polar-cli@4.0.0-beta.1' },
      { ...release, tag_name: 'polar-cli@verification' },
      release,
    ])

    expect(await latestRelease()).toEqual({ ...release, version: 'v1.4.0' })
  })

  test('paginates past unrelated releases and selects the highest semantic version', async () => {
    http.routes[page(1)] = Response.json(
      [{ ...release, tag_name: '@polar-sh/sdk@99.0.0' }],
      { headers: { link: `<${page(2)}>; rel="next"` } },
    )
    http.routes[page(2)] = Response.json([
      { ...release, tag_name: 'polar-cli@1.9.0' },
      { ...release, tag_name: 'polar-cli@1.10.0' },
      release,
    ])

    expect((await latestRelease()).version).toBe('v1.10.0')
    expect(http.urls()).toEqual([page(1), page(2)])
  })

  test('reports GitHub failures instead of treating them as no updates', async () => {
    http.routes[page(1)] = new Response('Rate limit exceeded', { status: 403 })

    const error = await Effect.runPromise(
      getLatestRelease.pipe(Effect.provide(http.layer), Effect.flip),
    )
    expect(error).toMatchObject({
      _tag: 'HttpClientError',
      reason: { _tag: 'StatusCodeError', response: { status: 403 } },
    })
  })

  test('reports when no stable CLI release exists', async () => {
    http.routes[page(1)] = Response.json([])

    const error = await Effect.runPromise(
      getLatestRelease.pipe(Effect.provide(http.layer), Effect.flip),
    )
    expect(error).toMatchObject({
      _tag: 'GitHubReleaseError',
      message: 'No stable CLI release found',
    })
  })
})

describe('CLI version', () => {
  test('matches the version managed by Changesets', () => {
    expect(VERSION).toBe(`v${version}`)
  })

  test('compares normalized versions without offering a downgrade', () => {
    expect(isNewerVersion('v1.10.0', 'v1.9.0')).toBe(true)
    expect(isNewerVersion('1.10.0', 'v1.10.0')).toBe(false)
    expect(isNewerVersion('v1.9.0', 'v1.10.0')).toBe(false)
  })
})
