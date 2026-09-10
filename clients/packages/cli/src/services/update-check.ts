import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { Effect, type Layer } from 'effect'
import { FetchHttpClient, type HttpClient } from 'effect/unstable/http'
import { VERSION } from '@/version'
import { getLatestRelease, isNewerVersion } from '@/services/github-releases'

const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000 // 24 hours

interface UpdateCheckState {
  lastChecked: string
  latestVersion: string
}

export interface UpdateCheckOptions {
  home?: string
  http?: Layer.Layer<HttpClient.HttpClient>
}

const stateFile = (home: string) => join(home, '.polar', 'update-check.json')

export interface PendingUpdate {
  current: string
  latest: string
}

export function pendingUpdate({ home = homedir() }: UpdateCheckOptions = {}):
  | PendingUpdate
  | undefined {
  try {
    const file = stateFile(home)
    if (!existsSync(file)) return undefined

    const raw = readFileSync(file, 'utf-8')
    const state: UpdateCheckState = JSON.parse(raw)

    if (!state.latestVersion || !isNewerVersion(state.latestVersion, VERSION))
      return undefined

    return { current: VERSION, latest: state.latestVersion }
  } catch {
    return undefined
  }
}

export function checkForUpdateInBackground({
  home = homedir(),
  http = FetchHttpClient.layer,
}: UpdateCheckOptions = {}): void {
  try {
    const file = stateFile(home)
    let shouldCheck = true

    if (existsSync(file)) {
      try {
        const raw = readFileSync(file, 'utf-8')
        const state: UpdateCheckState = JSON.parse(raw)
        const lastChecked = new Date(state.lastChecked).getTime()
        if (Date.now() - lastChecked < CHECK_INTERVAL_MS) {
          shouldCheck = false
        }
      } catch {
        // Corrupt file — re-check
      }
    }

    if (!shouldCheck) return

    Effect.runPromise(getLatestRelease.pipe(Effect.provide(http)))
      .then((release) => {
        mkdirSync(dirname(file), { recursive: true })

        const state: UpdateCheckState = {
          lastChecked: new Date().toISOString(),
          latestVersion: release.version,
        }

        return writeFile(file, JSON.stringify(state, null, 2))
      })
      .catch(() => {
        // Silently ignore all errors
      })
  } catch {
    // Silently ignore any errors
  }
}
