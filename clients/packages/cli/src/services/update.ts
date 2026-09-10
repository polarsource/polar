import { createHash } from 'node:crypto'
import { dirname, join } from 'node:path'
import { Data, Effect, FileSystem } from 'effect'
import { HttpClient } from 'effect/unstable/http'
import type { CLIRelease } from '@/services/github-releases'

export class UpdateError extends Data.TaggedError('UpdateError')<{
  message: string
  cause?: unknown
}> {}

export const replaceBinary = (
  newBinaryPath: string,
  binaryPath: string,
): Effect.Effect<void, UpdateError, FileSystem.FileSystem> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    yield* fs
      .chmod(newBinaryPath, 0o755)
      .pipe(
        Effect.mapError(
          (cause) =>
            new UpdateError({ message: 'Failed to chmod new binary', cause }),
        ),
      )

    const tempPath = join(dirname(binaryPath), `.polar-update-${Date.now()}`)

    yield* Effect.gen(function* () {
      const newBinary = yield* fs.readFile(newBinaryPath)
      yield* fs.writeFile(tempPath, newBinary)
      yield* fs.rename(tempPath, binaryPath)
    }).pipe(
      Effect.tapError(() => fs.remove(tempPath).pipe(Effect.ignore)),
      Effect.catchReason('PlatformError', 'PermissionDenied', () =>
        Effect.gen(function* () {
          const proc = Bun.spawn(['sudo', 'mv', newBinaryPath, binaryPath], {
            stdout: 'inherit',
            stderr: 'inherit',
            stdin: 'inherit',
          })
          const exitCode = yield* Effect.tryPromise({
            try: () => proc.exited,
            catch: (cause) =>
              new UpdateError({ message: 'Failed to run sudo mv', cause }),
          })
          if (exitCode !== 0) {
            return yield* new UpdateError({ message: 'sudo mv failed' })
          }
        }),
      ),
      Effect.mapError(
        (cause) => new UpdateError({ message: cause.message, cause }),
      ),
    )

    yield* fs
      .chmod(binaryPath, 0o755)
      .pipe(
        Effect.mapError(
          (cause) =>
            new UpdateError({ message: 'Failed to chmod binary', cause }),
        ),
      )
  })

function detectPlatform(): { os: string; arch: string } {
  const platform = process.platform
  const arch = process.arch

  let os: string
  switch (platform) {
    case 'darwin':
      os = 'darwin'
      break
    case 'linux':
      os = 'linux'
      break
    default:
      throw new Error(`Unsupported OS: ${platform}`)
  }

  let normalizedArch: string
  switch (arch) {
    case 'x64':
      normalizedArch = 'x64'
      break
    case 'arm64':
      normalizedArch = 'arm64'
      break
    default:
      throw new Error(`Unsupported architecture: ${arch}`)
  }

  if (os === 'linux' && normalizedArch === 'arm64') {
    throw new Error('Linux arm64 is not yet supported')
  }

  return { os, arch: normalizedArch }
}

export function getReleaseArchiveName(platform: {
  os: string
  arch: string
}): string {
  const baseName = `polar-${platform.os}-${platform.arch}`
  return platform.os === 'darwin' ? `${baseName}.zip` : `${baseName}.tar.gz`
}

export function getArchiveExtractionCommand(
  archivePath: string,
  destinationDir: string,
): string[] {
  if (archivePath.endsWith('.zip')) {
    return ['ditto', '-x', '-k', archivePath, destinationDir]
  }

  if (archivePath.endsWith('.tar.gz')) {
    return ['tar', '-xzf', archivePath, '-C', destinationDir]
  }

  throw new Error(`Unsupported archive format: ${archivePath}`)
}

export type UpdateStep = 'download' | 'verify' | 'extract' | 'replace'

export const downloadAndUpdate = (
  release: CLIRelease,
  binaryPath: string,
  report: (step: UpdateStep) => Effect.Effect<void>,
) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const client = (yield* HttpClient.HttpClient).pipe(
      HttpClient.filterStatusOk,
    )
    const { os, arch } = detectPlatform()
    const platform = `${os}-${arch}`
    const archiveName = getReleaseArchiveName({ os, arch })

    const asset = release.assets.find((a) => a.name === archiveName)
    if (!asset) {
      return yield* new UpdateError({
        message: `No release asset found for platform: ${platform}`,
      })
    }

    const checksumsAsset = release.assets.find(
      (a) => a.name === 'checksums.txt',
    )
    if (!checksumsAsset) {
      return yield* new UpdateError({
        message: 'No checksums.txt found in release',
      })
    }

    const download = (url: string, name: string) =>
      client.get(url).pipe(
        Effect.flatMap((response) => response.arrayBuffer),
        Effect.map((buffer) => new Uint8Array(buffer)),
        Effect.mapError(
          (cause) =>
            new UpdateError({
              message: `Failed to download ${name}: ${cause.message}`,
              cause,
            }),
        ),
      )

    const tempDir = yield* fs
      .makeTempDirectory({ prefix: 'polar-update-' })
      .pipe(
        Effect.mapError(
          (cause) =>
            new UpdateError({
              message: 'Failed to create temp directory',
              cause,
            }),
        ),
      )

    yield* Effect.ensuring(
      Effect.gen(function* () {
        yield* report('download')

        const archive = yield* download(asset.browser_download_url, archiveName)
        const archivePath = join(tempDir, archiveName)
        yield* fs.writeFile(archivePath, archive).pipe(
          Effect.mapError(
            (cause) =>
              new UpdateError({
                message: 'Failed to write archive to disk',
                cause,
              }),
          ),
        )

        yield* report('verify')

        const checksums = new TextDecoder().decode(
          yield* download(checksumsAsset.browser_download_url, 'checksums.txt'),
        )
        const expectedChecksum = checksums
          .split('\n')
          .find((line) => line.includes(archiveName))
          ?.split(/\s+/)[0]

        if (!expectedChecksum) {
          return yield* new UpdateError({
            message: `No checksum found for ${archiveName}`,
          })
        }

        const actualChecksum = createHash('sha256')
          .update(archive)
          .digest('hex')

        if (expectedChecksum !== actualChecksum) {
          return yield* new UpdateError({
            message: `Checksum mismatch!\n  Expected: ${expectedChecksum}\n  Got:      ${actualChecksum}`,
          })
        }

        yield* report('extract')

        const extract = Bun.spawn(
          getArchiveExtractionCommand(archivePath, tempDir),
          {
            stdout: 'ignore',
            stderr: 'pipe',
          },
        )

        const extractExitCode = yield* Effect.tryPromise({
          try: () => extract.exited,
          catch: (cause) =>
            new UpdateError({ message: 'Failed to extract archive', cause }),
        })

        if (extractExitCode !== 0) {
          const stderr = yield* Effect.tryPromise({
            try: () => new Response(extract.stderr).text(),
            catch: (cause) =>
              new UpdateError({
                message: 'Failed to read archive extractor stderr',
                cause,
              }),
          })
          return yield* new UpdateError({
            message: `Failed to extract archive: ${stderr}`,
          })
        }

        yield* report('replace')

        yield* replaceBinary(join(tempDir, 'polar'), binaryPath)
      }),
      fs.remove(tempDir, { recursive: true }).pipe(Effect.ignore),
    )
  })
