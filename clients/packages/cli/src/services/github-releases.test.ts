import { beforeEach, describe, expect, mock, test } from 'bun:test'
import { Effect } from 'effect'
import { FetchHttpClient } from 'effect/unstable/http'
import { getLatestRelease, isNewerVersion } from './github-releases'
import { VERSION } from '../version'
import { version } from '../../package.json'

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

const fetchMock = Object.assign(mock<typeof fetch>(), {
  preconnect: fetch.preconnect,
})
const latestRelease = getLatestRelease.pipe(
  Effect.provide(FetchHttpClient.layer),
  Effect.provideService(FetchHttpClient.Fetch, fetchMock),
)

beforeEach(() => fetchMock.mockReset())

describe('getLatestRelease', () => {
  test('ignores other packages, drafts, prereleases, and non-version tags', async () => {
    fetchMock.mockResolvedValueOnce(
      Response.json([
        { ...release, tag_name: '@polar-sh/sdk@99.0.0' },
        { ...release, tag_name: 'polar-cli@2.0.0', draft: true },
        { ...release, tag_name: 'polar-cli@3.0.0', prerelease: true },
        { ...release, tag_name: 'polar-cli@4.0.0-beta.1' },
        { ...release, tag_name: 'polar-cli@verification' },
        release,
      ]),
    )

    expect(await Effect.runPromise(latestRelease)).toEqual({
      ...release,
      version: 'v1.4.0',
    })
  })

  test('paginates past unrelated releases and selects the highest semantic version', async () => {
    fetchMock
      .mockResolvedValueOnce(
        Response.json([{ ...release, tag_name: '@polar-sh/sdk@99.0.0' }], {
          headers: {
            link: '<https://api.github.com/repos/polarsource/polar/releases?per_page=100&page=2>; rel="next"',
          },
        }),
      )
      .mockResolvedValueOnce(
        Response.json([
          { ...release, tag_name: 'polar-cli@1.9.0' },
          { ...release, tag_name: 'polar-cli@1.10.0' },
          release,
        ]),
      )

    expect((await Effect.runPromise(latestRelease)).version).toBe('v1.10.0')
    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
      'https://api.github.com/repos/polarsource/polar/releases?per_page=100&page=1',
      'https://api.github.com/repos/polarsource/polar/releases?per_page=100&page=2',
    ])
  })

  test('reports GitHub failures instead of treating them as no updates', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response('Rate limit exceeded', { status: 403 }),
    )

    const error = await Effect.runPromise(Effect.flip(latestRelease))
    expect(error).toMatchObject({
      _tag: 'HttpClientError',
      reason: { _tag: 'StatusCodeError', response: { status: 403 } },
    })
  })

  test('reports when no stable CLI release exists', async () => {
    fetchMock.mockResolvedValueOnce(Response.json([]))

    const error = await Effect.runPromise(Effect.flip(latestRelease))
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
