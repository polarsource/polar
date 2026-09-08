import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test'
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { BunFileSystem } from '@effect/platform-bun'
import { Effect, FileSystem, PlatformError } from 'effect'
import {
  getArchiveExtractionCommand,
  getReleaseArchiveName,
  replaceBinary,
} from './update'

async function makeTemp() {
  return mkdtemp(join(tmpdir(), 'polar-test-'))
}

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
})

describe('getArchiveExtractionCommand', () => {
  test('uses ditto for zip archives', () => {
    expect(getArchiveExtractionCommand('/tmp/polar.zip', '/tmp/out')).toEqual([
      'ditto',
      '-x',
      '-k',
      '/tmp/polar.zip',
      '/tmp/out',
    ])
  })

  test('uses tar for tar.gz archives', () => {
    expect(
      getArchiveExtractionCommand('/tmp/polar.tar.gz', '/tmp/out'),
    ).toEqual(['tar', '-xzf', '/tmp/polar.tar.gz', '-C', '/tmp/out'])
  })
})

describe('replaceBinary', () => {
  let dir: string
  let newBinaryPath: string
  let binaryPath: string
  let writeError: PlatformError.PlatformError | undefined

  const runReplace = () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const error = writeError
      return yield* replaceBinary(newBinaryPath, binaryPath).pipe(
        Effect.provideService(FileSystem.FileSystem, {
          ...fs,
          writeFile: error ? () => Effect.fail(error) : fs.writeFile,
        }),
      )
    }).pipe(Effect.provide(BunFileSystem.layer))

  beforeEach(async () => {
    writeError = undefined
    dir = await makeTemp()
    newBinaryPath = join(dir, 'polar-new')
    binaryPath = join(dir, 'polar')
    await writeFile(newBinaryPath, '#!/bin/sh\necho new')
    await writeFile(binaryPath, '#!/bin/sh\necho old')
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  test('replaces target binary with new binary content', async () => {
    await Effect.runPromise(runReplace())

    const content = await readFile(binaryPath, 'utf8')
    expect(content).toBe('#!/bin/sh\necho new')
  })

  test('sets executable permissions on target binary', async () => {
    await Effect.runPromise(runReplace())

    const s = await stat(binaryPath)
    // check owner execute bit
    expect(s.mode & 0o111).toBeGreaterThan(0)
  })

  test('leaves no temp file behind after success', async () => {
    await Effect.runPromise(runReplace())

    // list files in dir — only the replaced binary should remain
    const { readdir } = await import('node:fs/promises')
    const files = await readdir(dir)
    const tempFiles = files.filter((f) => f.startsWith('.polar-update-'))
    expect(tempFiles).toHaveLength(0)
  })

  test('throws and cleans up temp file on non-permission write error', async () => {
    writeError = PlatformError.systemError({
      _tag: 'Unknown',
      module: 'FileSystem',
      method: 'writeFile',
      description: 'EIO: input/output error',
    })

    await expect(Effect.runPromise(runReplace())).rejects.toThrow('EIO')

    const { readdir } = await import('node:fs/promises')
    const files = await readdir(dir)
    const tempFiles = files.filter((f) => f.startsWith('.polar-update-'))
    expect(tempFiles).toHaveLength(0)
  })

  test('does not throw when PermissionDenied triggers sudo fallback', async () => {
    writeError = PlatformError.systemError({
      _tag: 'PermissionDenied',
      module: 'FileSystem',
      method: 'writeFile',
    })

    // Mock Bun.spawn so sudo mv appears to succeed
    const spawnSpy = spyOn(Bun, 'spawn').mockImplementationOnce(
      () =>
        ({
          exited: Promise.resolve(0),
        }) as ReturnType<typeof Bun.spawn>,
    )

    await Effect.runPromise(runReplace())

    // Verify sudo mv was called with the right args
    expect(spawnSpy).toHaveBeenCalledWith(
      ['sudo', 'mv', newBinaryPath, binaryPath],
      expect.objectContaining({ stdin: 'inherit' }),
    )

    spawnSpy.mockRestore()
  })

  test('throws when sudo mv exits non-zero', async () => {
    writeError = PlatformError.systemError({
      _tag: 'PermissionDenied',
      module: 'FileSystem',
      method: 'writeFile',
    })

    const spawnSpy = spyOn(Bun, 'spawn').mockImplementationOnce(
      () =>
        ({
          exited: Promise.resolve(1),
        }) as ReturnType<typeof Bun.spawn>,
    )

    await expect(Effect.runPromise(runReplace())).rejects.toThrow(
      'sudo mv failed',
    )

    spawnSpy.mockRestore()
  })
})
