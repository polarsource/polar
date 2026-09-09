import { createHash } from 'node:crypto'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { BunFileSystem } from '@effect/platform-bun'
import { Console, Data, Effect, FileSystem } from 'effect'
import { Command } from 'effect/unstable/cli'
import {
  type CLIRelease,
  getLatestRelease,
  isNewerVersion,
} from '../services/github-releases'
import { VERSION } from '../version'

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

const downloadAndUpdate = (release: CLIRelease, latestVersion: string) =>
  Effect.gen(function* () {
    const bold = '\x1b[1m'
    const cyan = '\x1b[36m'
    const green = '\x1b[32m'
    const dim = '\x1b[2m'
    const reset = '\x1b[0m'

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

    const tempDir = yield* Effect.tryPromise({
      try: () => mkdtemp(join(tmpdir(), 'polar-update-')),
      catch: (cause) =>
        new UpdateError({ message: 'Failed to create temp directory', cause }),
    })

    yield* Effect.ensuring(
      Effect.gen(function* () {
        yield* Console.log(`${dim}Downloading ${latestVersion}...${reset}`)

        const archiveBuffer = yield* Effect.tryPromise({
          try: () =>
            fetch(asset.browser_download_url).then((res) => {
              if (!res.ok)
                throw new UpdateError({
                  message: `Download failed: ${res.status} ${res.statusText}`,
                })
              return res.arrayBuffer()
            }),
          catch: (cause) =>
            new UpdateError({
              message: `Failed to download binary: ${cause instanceof Error ? cause.message : cause}`,
              cause,
            }),
        })

        const archivePath = join(tempDir, archiveName)
        yield* Effect.tryPromise({
          try: () => Bun.write(archivePath, archiveBuffer),
          catch: (cause) =>
            new UpdateError({
              message: 'Failed to write archive to disk',
              cause,
            }),
        })

        yield* Console.log(`${dim}Verifying checksum...${reset}`)

        const checksumsText = yield* Effect.tryPromise({
          try: () =>
            fetch(checksumsAsset.browser_download_url).then((res) => {
              if (!res.ok)
                throw new UpdateError({
                  message: 'Failed to download checksums',
                })
              return res.text()
            }),
          catch: (cause) =>
            new UpdateError({
              message: 'Failed to download checksums.txt',
              cause,
            }),
        })

        const expectedChecksum = checksumsText
          .split('\n')
          .find((line) => line.includes(archiveName))
          ?.split(/\s+/)[0]

        if (!expectedChecksum) {
          return yield* new UpdateError({
            message: `No checksum found for ${archiveName}`,
          })
        }

        const archiveData = yield* Effect.tryPromise({
          try: () =>
            Bun.file(archivePath).arrayBuffer() as Promise<ArrayBuffer>,
          catch: (cause) =>
            new UpdateError({
              message: 'Failed to read archive for checksum',
              cause,
            }),
        })

        const hash = createHash('sha256')
        hash.update(new Uint8Array(archiveData))
        const actualChecksum = hash.digest('hex')

        if (expectedChecksum !== actualChecksum) {
          return yield* new UpdateError({
            message: `Checksum mismatch!\n  Expected: ${expectedChecksum}\n  Got:      ${actualChecksum}`,
          })
        }

        yield* Console.log(`${dim}Extracting...${reset}`)

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

        const binaryPath = process.execPath
        const newBinaryPath = join(tempDir, 'polar')

        yield* Console.log(`${dim}Replacing binary...${reset}`)

        yield* replaceBinary(newBinaryPath, binaryPath).pipe(
          Effect.provide(BunFileSystem.layer),
        )

        yield* Console.log('')
        yield* Console.log(
          `  ${bold}${green}Updated successfully!${reset} ${dim}${VERSION}${reset} -> ${bold}${cyan}${latestVersion}${reset}`,
        )
        yield* Console.log('')
      }),
      Effect.promise(() =>
        rm(tempDir, { recursive: true, force: true }).catch(() => {}),
      ),
    )
  })

export const update = Command.make('update', {}, () =>
  Effect.gen(function* () {
    const green = '\x1b[32m'
    const dim = '\x1b[2m'
    const reset = '\x1b[0m'

    yield* Console.log(`${dim}Checking for updates...${reset}`)

    const release = yield* getLatestRelease

    const latestVersion = release.version

    if (!isNewerVersion(latestVersion, VERSION)) {
      yield* Console.log(
        `${green}Already up to date${reset} ${dim}(${VERSION})${reset}`,
      )
      return
    }

    yield* downloadAndUpdate(release, latestVersion)
  }),
)
