import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  vi,
  test,
} from 'vitest'
import { createHash } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { BunFileSystem } from '@effect/platform-bun'
import { Console, Effect, Layer } from 'effect'
import { downloadAndUpdate, update } from '@/commands/update'
import { getReleaseArchiveName } from '@/services/update'
import { captureConsole, runCli } from '@/utils/test-utils/cli'
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

describe('downloadAndUpdate', () => {
  const host = { platform: process.platform, arch: process.arch }
  const archiveName = getReleaseArchiveName({ os: 'linux', arch: 'x64' })

  beforeAll(() => {
    Object.defineProperty(process, 'platform', { value: 'linux' })
    Object.defineProperty(process, 'arch', { value: 'x64' })
  })

  afterAll(() => {
    Object.defineProperty(process, 'platform', { value: host.platform })
    Object.defineProperty(process, 'arch', { value: host.arch })
  })
  const archive = new TextEncoder().encode('archive bytes')
  const checksum = createHash('sha256').update(archive).digest('hex')
  let dir: string
  let binaryPath: string

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'polar-test-'))
    binaryPath = join(dir, 'polar')
    await writeFile(binaryPath, 'old binary')
    vi.spyOn(Bun, 'spawn').mockImplementation(((command: string[]) => {
      writeFileSync(join(command.at(-1)!, 'polar'), 'new binary')
      return { exited: Promise.resolve(0), stderr: '' }
    }) as unknown as typeof Bun.spawn)
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    await rm(dir, { recursive: true, force: true })
  })

  test('prints each step and the installed version', async () => {
    const http = fakeHttp({
      [`https://example.test/${archiveName}`]: () => new Response(archive),
      'https://example.test/checksums.txt': () =>
        new Response(`${checksum}  ${archiveName}`),
    })
    const { lines, console } = captureConsole()

    await Effect.runPromise(
      downloadAndUpdate(
        {
          tag_name: 'polar-cli@9.9.9',
          draft: false,
          prerelease: false,
          version: 'v9.9.9',
          assets: [archiveName, 'checksums.txt'].map((name) => ({
            name,
            browser_download_url: `https://example.test/${name}`,
          })),
        },
        'v9.9.9',
        binaryPath,
      ).pipe(
        Effect.provide(Layer.mergeAll(BunFileSystem.layer, http.layer)),
        Effect.provideService(Console.Console, console),
      ),
    )

    await expect(readFile(binaryPath, 'utf8')).resolves.toBe('new binary')
    expect(lines.join('\n')).toContain('Downloading v9.9.9...')
    expect(lines.join('\n')).toContain('Verifying checksum...')
    expect(lines.join('\n')).toContain('Extracting...')
    expect(lines.join('\n')).toContain('Replacing binary...')
    expect(lines.join('\n')).toContain(`Updated ${VERSION} → v9.9.9`)
  })
})
