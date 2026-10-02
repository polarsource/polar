import { createHash } from 'node:crypto'
import { rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { Data, Effect, FileSystem } from 'effect'
import { HttpClient } from 'effect/unstable/http'
import type { CLIRelease } from '@/services/github-releases'

export class UpdateError extends Data.TaggedError('UpdateError')<{
  message: string
  cause?: unknown
}> {}

export const retiredBinaryPath = (binaryPath: string) => `${binaryPath}.old`

export const removeRetiredBinary = (
  binaryPath: string = process.execPath,
  platform: NodeJS.Platform = process.platform,
) => {
  if (platform !== 'win32') return
  try {
    rmSync(retiredBinaryPath(binaryPath), { force: true })
  } catch {
    return
  }
}

const replaceRunningWindowsBinary = (
  newBinaryPath: string,
  binaryPath: string,
): Effect.Effect<void, UpdateError, FileSystem.FileSystem> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const retired = retiredBinaryPath(binaryPath)
    yield* fs.remove(retired).pipe(Effect.ignore)
    yield* fs.rename(binaryPath, retired)
    yield* fs
      .copyFile(newBinaryPath, binaryPath)
      .pipe(
        Effect.tapError(() =>
          fs.rename(retired, binaryPath).pipe(Effect.ignore),
        ),
      )
  }).pipe(
    Effect.mapError(
      (cause) =>
        new UpdateError({
          message: `Could not replace ${binaryPath}. Close other running polar processes, or run the terminal as administrator, and try again.`,
          cause,
        }),
    ),
  )

export const replaceBinary = (
  newBinaryPath: string,
  binaryPath: string,
  platform: NodeJS.Platform = process.platform,
): Effect.Effect<void, UpdateError, FileSystem.FileSystem> =>
  Effect.gen(function* () {
    if (platform === 'win32') {
      return yield* replaceRunningWindowsBinary(newBinaryPath, binaryPath)
    }
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
    case 'win32':
      os = 'windows'
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

  if (os === 'windows' && normalizedArch === 'arm64') {
    throw new Error('Windows arm64 is not yet supported')
  }

  return { os, arch: normalizedArch }
}

export function getReleaseArchiveName(platform: {
  os: string
  arch: string
}): string {
  const baseName = `polar-${platform.os}-${platform.arch}`
  return platform.os === 'linux' ? `${baseName}.tar.gz` : `${baseName}.zip`
}

export const binaryNameFor = (os: string) =>
  os === 'windows' ? 'polar.exe' : 'polar'

export function getArchiveExtractionCommand(
  archivePath: string,
  destinationDir: string,
  platform: NodeJS.Platform = process.platform,
): string[] {
  if (archivePath.endsWith('.zip')) {
    return platform === 'win32'
      ? ['tar', '-xf', archivePath, '-C', destinationDir]
      : ['ditto', '-x', '-k', archivePath, destinationDir]
  }

  if (archivePath.endsWith('.tar.gz')) {
    return ['tar', '-xzf', archivePath, '-C', destinationDir]
  }

  throw new Error(`Unsupported archive format: ${archivePath}`)
}

export type InstallStep = 'download' | 'verify' | 'extract' | 'replace'

export const install = (
  release: CLIRelease,
  binaryPath: string,
  onStep: (step: InstallStep) => Effect.Effect<void>,
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
        yield* onStep('download')

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

        yield* onStep('verify')

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

        yield* onStep('extract')

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

        yield* onStep('replace')

        yield* replaceBinary(join(tempDir, binaryNameFor(os)), binaryPath)
      }),
      fs.remove(tempDir, { recursive: true }).pipe(Effect.ignore),
    )
  })
