import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { Effect } from 'effect'
import { VERSION } from '@/version'
import { getLatestRelease, isNewerVersion } from '@/services/github-releases'

const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000

interface UpdateCheckState {
  lastChecked: string
  latestVersion: string
}

export interface UpdateCheckOptions {
  home?: string
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

const checkedRecently = (state: UpdateCheckState | undefined) =>
  state !== undefined &&
  Date.now() - new Date(state.lastChecked).getTime() < CHECK_INTERVAL_MS

export const availableUpdate = ({ home = homedir() }: UpdateCheckOptions = {}):
  | string
  | undefined => {
  try {
    const latest = readState(stateFile(home))?.latestVersion
    return latest && isNewerVersion(latest, VERSION) ? latest : undefined
  } catch {
    return undefined
  }
}

export const checkForUpdate = ({ home = homedir() }: UpdateCheckOptions = {}) =>
  Effect.gen(function* () {
    const file = stateFile(home)
    if (checkedRecently(readState(file))) return
    const release = yield* getLatestRelease
    const state: UpdateCheckState = {
      lastChecked: new Date().toISOString(),
      latestVersion: release.version,
    }
    yield* Effect.tryPromise(() => {
      mkdirSync(dirname(file), { recursive: true })
      return writeFile(file, JSON.stringify(state, null, 2))
    })
  }).pipe(Effect.ignore)
