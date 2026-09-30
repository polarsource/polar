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
import {
  mkdtemp,
  readdir,
  readFile,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { BunFileSystem } from '@effect/platform-bun'
import { Effect, FileSystem, Layer, PlatformError } from 'effect'
import type { CLIRelease } from '@/services/github-releases'
import {
  binaryNameFor,
  getArchiveExtractionCommand,
  getReleaseArchiveName,
  install,
  type InstallStep,
  removeRetiredBinary,
  replaceBinary,
  retiredBinaryPath,
} from '@/services/update'
import { fakeHttp } from '@/utils/test-utils/http'

const makeTemp = () => mkdtemp(join(tmpdir(), 'polar-test-'))

describe('getReleaseArchiveName', () => {
  test('uses zip archives for darwin releases', () => {
    expect(getReleaseArchiveName({ os: 'darwin', arch: 'arm64' })).toBe(
      'polar-darwin-arm64.zip',
    )
    expect(getReleaseArchiveName({ os: 'darwin', arch: 'x64' })).toBe(
      'polar-darwin-x64.zip',
    )
  })

  test('uses tar.gz archives for linux releases', () => {
    expect(getReleaseArchiveName({ os: 'linux', arch: 'x64' })).toBe(
      'polar-linux-x64.tar.gz',
    )
  })

  test('uses zip archives for windows releases', () => {
    expect(getReleaseArchiveName({ os: 'windows', arch: 'x64' })).toBe(
      'polar-windows-x64.zip',
    )
  })
})

describe('binaryNameFor', () => {
  test('adds the exe extension on windows only', () => {
    expect(binaryNameFor('windows')).toBe('polar.exe')
    expect(binaryNameFor('darwin')).toBe('polar')
    expect(binaryNameFor('linux')).toBe('polar')
  })
})

describe('getArchiveExtractionCommand', () => {
  test('uses ditto for zip archives on macOS', () => {
    expect(
      getArchiveExtractionCommand('/tmp/polar.zip', '/tmp/out', 'darwin'),
    ).toEqual(['ditto', '-x', '-k', '/tmp/polar.zip', '/tmp/out'])
  })

  test('uses the bundled tar for zip archives on windows', () => {
    expect(
      getArchiveExtractionCommand(
        'C:\\Temp\\polar.zip',
        'C:\\Temp\\out',
        'win32',
      ),
    ).toEqual(['tar', '-xf', 'C:\\Temp\\polar.zip', '-C', 'C:\\Temp\\out'])
  })

  test('uses tar for tar.gz archives', () => {
    expect(
      getArchiveExtractionCommand('/tmp/polar.tar.gz', '/tmp/out'),
    ).toEqual(['tar', '-xzf', '/tmp/polar.tar.gz', '-C', '/tmp/out'])
  })
})

describe('replaceBinary on macOS and Linux', () => {
  let dir: string
  let newBinaryPath: string
  let binaryPath: string
  let writeError: PlatformError.PlatformError | undefined

  const runReplace = () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const error = writeError
      return yield* replaceBinary(newBinaryPath, binaryPath, 'linux').pipe(
        Effect.provideService(FileSystem.FileSystem, {
          ...fs,
          writeFile: error ? () => Effect.fail(error) : fs.writeFile,
        }),
      )
    }).pipe(Effect.provide(BunFileSystem.layer))

  const tempFiles = async () =>
    (await readdir(dir)).filter((file) => file.startsWith('.polar-update-'))

  beforeEach(async () => {
    writeError = undefined
    dir = await makeTemp()
    newBinaryPath = join(dir, 'polar-new')
    binaryPath = join(dir, 'polar')
    await writeFile(newBinaryPath, '#!/bin/sh\necho new')
    await writeFile(binaryPath, '#!/bin/sh\necho old')
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    await rm(dir, { recursive: true, force: true })
  })

  test('replaces target binary with new binary content', async () => {
    await Effect.runPromise(runReplace())

    await expect(readFile(binaryPath, 'utf8')).resolves.toBe(
      '#!/bin/sh\necho new',
    )
  })

  test.skipIf(process.platform === 'win32')(
    'sets executable permissions on target binary',
    async () => {
      await Effect.runPromise(runReplace())

      const s = await stat(binaryPath)
      expect(s.mode & 0o111).toBeGreaterThan(0)
    },
  )

  test('leaves no temp file behind after success', async () => {
    await Effect.runPromise(runReplace())

    await expect(tempFiles()).resolves.toHaveLength(0)
  })

  test('throws and cleans up temp file on non-permission write error', async () => {
    writeError = PlatformError.systemError({
      _tag: 'Unknown',
      module: 'FileSystem',
      method: 'writeFile',
      description: 'EIO: input/output error',
    })

    await expect(Effect.runPromise(runReplace())).rejects.toThrow('EIO')
    await expect(tempFiles()).resolves.toHaveLength(0)
  })

  test('does not throw when PermissionDenied triggers sudo fallback', async () => {
    writeError = PlatformError.systemError({
      _tag: 'PermissionDenied',
      module: 'FileSystem',
      method: 'writeFile',
    })
    const spawn = vi
      .spyOn(Bun, 'spawn')
      .mockImplementationOnce(
        () => ({ exited: Promise.resolve(0) }) as ReturnType<typeof Bun.spawn>,
      )

    await Effect.runPromise(runReplace())

    expect(spawn).toHaveBeenCalledWith(
      ['sudo', 'mv', newBinaryPath, binaryPath],
      expect.objectContaining({ stdin: 'inherit' }),
    )
  })

  test('throws when sudo mv exits non-zero', async () => {
    writeError = PlatformError.systemError({
      _tag: 'PermissionDenied',
      module: 'FileSystem',
      method: 'writeFile',
    })
    vi.spyOn(Bun, 'spawn').mockImplementationOnce(
      () => ({ exited: Promise.resolve(1) }) as ReturnType<typeof Bun.spawn>,
    )

    await expect(Effect.runPromise(runReplace())).rejects.toThrow(
      'sudo mv failed',
    )
  })
})

describe('replaceBinary on windows', () => {
  let dir: string
  let newBinaryPath: string
  let binaryPath: string
  let copyError: PlatformError.PlatformError | undefined

  const runReplace = () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const error = copyError
      return yield* replaceBinary(newBinaryPath, binaryPath, 'win32').pipe(
        Effect.provideService(FileSystem.FileSystem, {
          ...fs,
          copyFile: error ? () => Effect.fail(error) : fs.copyFile,
        }),
      )
    }).pipe(Effect.provide(BunFileSystem.layer))

  beforeEach(async () => {
    copyError = undefined
    dir = await makeTemp()
    newBinaryPath = join(dir, 'polar-new.exe')
    binaryPath = join(dir, 'polar.exe')
    await writeFile(newBinaryPath, 'new binary')
    await writeFile(binaryPath, 'old binary')
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  test('moves the running binary aside and installs the new one', async () => {
    await Effect.runPromise(runReplace())

    await expect(readFile(binaryPath, 'utf8')).resolves.toBe('new binary')
    await expect(readFile(retiredBinaryPath(binaryPath), 'utf8')).resolves.toBe(
      'old binary',
    )
  })

  test('replaces a binary left behind by an earlier update', async () => {
    await writeFile(retiredBinaryPath(binaryPath), 'older binary')

    await Effect.runPromise(runReplace())

    await expect(readFile(retiredBinaryPath(binaryPath), 'utf8')).resolves.toBe(
      'old binary',
    )
  })

  test('restores the running binary when the new one cannot be installed', async () => {
    copyError = PlatformError.systemError({
      _tag: 'PermissionDenied',
      module: 'FileSystem',
      method: 'copyFile',
    })

    await expect(Effect.runPromise(runReplace())).rejects.toThrow(
      'Could not replace',
    )
    await expect(readFile(binaryPath, 'utf8')).resolves.toBe('old binary')
    await expect(readdir(dir)).resolves.not.toContain('polar.exe.old')
  })
})

describe('removeRetiredBinary', () => {
  let dir: string
  let binaryPath: string

  beforeEach(async () => {
    dir = await makeTemp()
    binaryPath = join(dir, 'polar.exe')
    await writeFile(retiredBinaryPath(binaryPath), 'old binary')
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  test('removes the binary retired by the last update on windows', async () => {
    removeRetiredBinary(binaryPath, 'win32')

    await expect(readdir(dir)).resolves.toEqual([])
  })

  test('leaves other platforms alone', async () => {
    removeRetiredBinary(binaryPath, 'darwin')

    await expect(readdir(dir)).resolves.toEqual(['polar.exe.old'])
  })

  test('does nothing when no binary was retired', () => {
    expect(() =>
      removeRetiredBinary(join(dir, 'missing.exe'), 'win32'),
    ).not.toThrow()
  })
})

describe('install', () => {
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
  const archiveUrl = `https://example.test/${archiveName}`
  const checksumsUrl = 'https://example.test/checksums.txt'
  const archive = new TextEncoder().encode('archive bytes')
  const checksum = createHash('sha256').update(archive).digest('hex')
  const release = (
    assets: string[] = [archiveName, 'checksums.txt'],
  ): CLIRelease => ({
    tag_name: '@polar-sh/cli@9.9.9',
    draft: false,
    prerelease: false,
    version: 'v9.9.9',
    assets: assets.map((name) => ({
      name,
      browser_download_url: `https://example.test/${name}`,
    })),
  })
  let dir: string
  let binaryPath: string
  let http: ReturnType<typeof fakeHttp>
  let extraction: { exitCode: number; stderr: string }

  const run = (target = release()) => {
    const steps: InstallStep[] = []
    const promise = Effect.runPromise(
      install(target, binaryPath, (step) =>
        Effect.sync(() => {
          steps.push(step)
        }),
      ).pipe(Effect.provide(Layer.mergeAll(BunFileSystem.layer, http.layer))),
    )
    return { promise, steps }
  }

  beforeEach(async () => {
    dir = await makeTemp()
    binaryPath = join(dir, 'polar')
    await writeFile(binaryPath, 'old binary')
    http = fakeHttp({
      [archiveUrl]: () => new Response(archive),
      [checksumsUrl]: () => new Response(`${checksum}  ${archiveName}`),
    })
    extraction = { exitCode: 0, stderr: '' }
    vi.spyOn(Bun, 'spawn').mockImplementation(((command: string[]) => {
      writeFileSync(join(command.at(-1)!, 'polar'), 'new binary')
      return {
        exited: Promise.resolve(extraction.exitCode),
        stderr: extraction.stderr,
      }
    }) as unknown as typeof Bun.spawn)
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    await rm(dir, { recursive: true, force: true })
  })

  test('downloads, verifies, extracts and replaces the binary', async () => {
    const { promise, steps } = run()
    await promise

    await expect(readFile(binaryPath, 'utf8')).resolves.toBe('new binary')
    expect(steps).toEqual(['download', 'verify', 'extract', 'replace'])
    expect(http.urls()).toEqual([archiveUrl, checksumsUrl])
  })

  test('fails without an asset for the current platform', async () => {
    await expect(run(release(['checksums.txt'])).promise).rejects.toThrow(
      'No release asset found for platform',
    )
  })

  test('fails without a checksums file', async () => {
    await expect(run(release([archiveName])).promise).rejects.toThrow(
      'No checksums.txt found in release',
    )
  })

  test('fails when the download is rejected', async () => {
    http.routes[archiveUrl] = () => new Response(null, { status: 404 })

    await expect(run().promise).rejects.toThrow(
      `Failed to download ${archiveName}`,
    )
  })

  test('fails when the download throws', async () => {
    http.routes[archiveUrl] = () => {
      throw new Error('network down')
    }

    await expect(run().promise).rejects.toThrow(
      `Failed to download ${archiveName}`,
    )
  })

  test('fails when the checksums cannot be downloaded', async () => {
    http.routes[checksumsUrl] = () => new Response(null, { status: 500 })

    await expect(run().promise).rejects.toThrow(
      'Failed to download checksums.txt',
    )
  })

  test('fails when the archive has no checksum entry', async () => {
    http.routes[checksumsUrl] = () => new Response('abc  other.zip')

    await expect(run().promise).rejects.toThrow(
      `No checksum found for ${archiveName}`,
    )
  })

  test('fails on a checksum mismatch', async () => {
    http.routes[checksumsUrl] = () =>
      new Response(`${'0'.repeat(64)}  ${archiveName}`)

    await expect(run().promise).rejects.toThrow('Checksum mismatch!')
    await expect(readFile(binaryPath, 'utf8')).resolves.toBe('old binary')
  })

  test('surfaces extraction errors', async () => {
    extraction = { exitCode: 1, stderr: 'corrupt archive' }

    await expect(run().promise).rejects.toThrow(
      'Failed to extract archive: corrupt archive',
    )
  })
})
