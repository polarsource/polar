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
import { type Method, Updater, UpdaterError } from '@/services/updater'
import { captureConsole, runCli } from '@/utils/test-utils/cli'
import { fakeHttp } from '@/utils/test-utils/http'
import { VERSION } from '@/version'

describe('update command', () => {
  const upgrades: [string, string][] = []
  const fakeUpdater = (
    method: Method | undefined,
    latest = 'v9.9.9',
    failure?: UpdaterError,
  ) =>
    Updater.of({
      detect: Effect.succeed(method),
      latest: Effect.succeed(latest),
      upgrade: (manager, version) => {
        upgrades.push([manager, version])
        return failure ? Effect.fail(failure) : Effect.void
      },
    })
  const releases =
    'https://api.github.com/repos/polarsource/polar/releases?per_page=100&page=1'
  const runUpdate = (
    args: string[],
    updater: ReturnType<typeof fakeUpdater>,
    http = fakeHttp(),
  ) => {
    const cli = runCli(update, args)
    const promise = Effect.runPromise(
      cli.effect.pipe(
        Effect.provide(http.layer),
        Effect.provideService(Updater, updater),
      ),
    )
    return { cli, promise, http }
  }

  beforeEach(() => {
    upgrades.length = 0
  })

  test('reports when the standalone binary is already up to date', async () => {
    const http = fakeHttp({
      [releases]: Response.json([
        {
          tag_name: `@polar-sh/cli@${VERSION.slice(1)}`,
          draft: false,
          prerelease: false,
          assets: [],
        },
      ]),
    })
    const { cli, promise } = runUpdate([], fakeUpdater('binary'), http)
    await promise

    expect(cli.output()).toContain('Checking for updates...')
    expect(cli.output()).toContain(`Already up to date ${VERSION}`)
    expect(http.urls()).toEqual([releases])
  })

  test('updates an npm installation through the package manager', async () => {
    const { cli, promise, http } = runUpdate([], fakeUpdater('npm'))
    await promise

    expect(upgrades).toEqual([['npm', 'v9.9.9']])
    expect(cli.output()).toContain('Updating with npm...')
    expect(cli.output()).toContain(`Updated ${VERSION} → v9.9.9`)
    expect(http.urls()).toEqual([])
  })

  test('reports when the npm package is already up to date', async () => {
    const { cli, promise } = runUpdate([], fakeUpdater('pnpm', VERSION))
    await promise

    expect(upgrades).toEqual([])
    expect(cli.output()).toContain(`Already up to date ${VERSION}`)
  })

  test('honours --method instead of detecting the installation', async () => {
    const { promise } = runUpdate(['--method', 'bun'], fakeUpdater('npm'))
    await promise

    expect(upgrades).toEqual([['bun', 'v9.9.9']])
  })

  test('asks for --method when the installation cannot be detected', async () => {
    const { promise } = runUpdate([], fakeUpdater(undefined))

    await expect(promise).rejects.toThrow(
      'Could not detect how the CLI was installed. Pass --method',
    )
    expect(upgrades).toEqual([])
  })

  test('surfaces package manager failures', async () => {
    const failure = new UpdaterError({
      message: 'npm install --global @polar-sh/cli@9.9.9 exited with code 1',
    })
    const { promise } = runUpdate([], fakeUpdater('yarn', 'v9.9.9', failure))

    await expect(promise).rejects.toThrow('exited with code 1')
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
          tag_name: '@polar-sh/cli@9.9.9',
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
