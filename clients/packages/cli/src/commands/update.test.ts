import { describe, expect, test } from 'vitest'
import { Effect } from 'effect'
import { update } from '@/commands/update'
import { runCli } from '@/utils/test-utils/cli'
import { fakeHttp } from '@/utils/test-utils/http'
import { VERSION } from '@/version'

describe('update command', () => {
  test('reports when the CLI is already up to date', async () => {
    const http = fakeHttp({
      'https://api.github.com/repos/polarsource/polar/releases?per_page=100&page=1':
        Response.json([
          {
            tag_name: `polar-cli@${VERSION.slice(1)}`,
            draft: false,
            prerelease: false,
            assets: [],
          },
        ]),
    })
    const cli = runCli(update, [])
    await Effect.runPromise(cli.effect.pipe(Effect.provide(http.layer)))

    expect(cli.output()).toContain('Checking for updates...')
    expect(cli.output()).toContain(`Already up to date ${VERSION}`)
  })
})
