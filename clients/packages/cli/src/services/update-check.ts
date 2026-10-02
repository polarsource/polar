import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { Effect } from 'effect'
import { VERSION } from '@/version'
import { getLatestRelease, isNewerVersion } from '@/services/github-releases'
import { installedPackage, latestPackageVersion } from '@/services/updater'

const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000

type UpdateSource = 'github' | 'npm'

interface UpdateCheckState {
  lastChecked: string
  latestVersion: string
  source?: UpdateSource
}

export interface UpdateCheckOptions {
  home?: string
  executable?: string
}

const stateFile = (home: string) => join(home, '.polar', 'update-check.json')

const readState = (file: string): UpdateCheckState | undefined => {
  try {
    return existsSync(file)
      ? JSON.parse(readFileSync(file, 'utf-8'))
      : undefined
  } catch {
    return undefined
  }
}

const updateSource = (executable?: string) =>
  installedPackage(executable).pipe(
    Effect.map((pkg): UpdateSource => (pkg ? 'npm' : 'github')),
  )

const fetchLatestVersion = (source: UpdateSource) =>
  source === 'npm'
    ? latestPackageVersion
    : getLatestRelease.pipe(Effect.map((release) => release.version))

const checkedRecently = (
  state: UpdateCheckState | undefined,
  source: UpdateSource,
) =>
  state?.source === source &&
  Date.now() - new Date(state.lastChecked).getTime() < CHECK_INTERVAL_MS

export const availableUpdate = ({
  home = homedir(),
  executable,
}: UpdateCheckOptions = {}) =>
  updateSource(executable).pipe(
    Effect.map((source) => {
      try {
        const state = readState(stateFile(home))
        const latest =
          state?.source === source ? state.latestVersion : undefined
        return latest && isNewerVersion(latest, VERSION) ? latest : undefined
      } catch {
        return undefined
      }
    }),
  )

export const checkForUpdate = ({
  home = homedir(),
  executable,
}: UpdateCheckOptions = {}) =>
  Effect.gen(function* () {
    const file = stateFile(home)
    const source = yield* updateSource(executable)
    if (checkedRecently(readState(file), source)) return
    const state: UpdateCheckState = {
      lastChecked: new Date().toISOString(),
      latestVersion: yield* fetchLatestVersion(source),
      source,
    }
    yield* Effect.tryPromise(() => {
      mkdirSync(dirname(file), { recursive: true })
      return writeFile(file, JSON.stringify(state, null, 2))
    })
  }).pipe(Effect.ignore)
