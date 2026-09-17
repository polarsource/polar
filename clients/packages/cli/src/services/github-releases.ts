import { Data, Effect, Schema } from 'effect'
import { HttpClient, HttpClientResponse } from 'effect/unstable/http'

const REPOSITORY = 'polarsource/polar'
const TAG_PREFIX = 'polar-cli@'

const GitHubRelease = Schema.Struct({
  tag_name: Schema.String,
  draft: Schema.Boolean,
  prerelease: Schema.Boolean,
  assets: Schema.Array(
    Schema.Struct({
      name: Schema.String,
      browser_download_url: Schema.String,
    }),
  ),
})

export type CLIRelease = typeof GitHubRelease.Type & { version: string }

export function isNewerVersion(latest: string, current: string): boolean {
  return (
    Bun.semver.order(latest.replace(/^v/, ''), current.replace(/^v/, '')) > 0
  )
}

export class GitHubReleaseError extends Data.TaggedError('GitHubReleaseError')<{
  message: string
}> {}

export const getLatestRelease = Effect.gen(function* () {
  const client = (yield* HttpClient.HttpClient).pipe(HttpClient.filterStatusOk)
  let latest: CLIRelease | undefined

  for (let page = 1; ; page++) {
    const response = yield* client.get(
      `https://api.github.com/repos/${REPOSITORY}/releases?per_page=100&page=${page}`,
    )
    const releases = yield* HttpClientResponse.schemaBodyJson(
      Schema.Array(GitHubRelease),
    )(response)
    for (const release of releases) {
      if (release.draft || release.prerelease) continue
      if (!release.tag_name.startsWith(TAG_PREFIX)) continue

      const version = release.tag_name.slice(TAG_PREFIX.length)
      if (!/^\d+\.\d+\.\d+$/.test(version)) continue

      if (!latest || isNewerVersion(version, latest.version)) {
        latest = { ...release, version: `v${version}` }
      }
    }

    if (!response.headers['link']?.includes('rel="next"')) break
  }

  if (!latest) {
    return yield* new GitHubReleaseError({
      message: 'No stable CLI release found',
    })
  }
  return latest
})
