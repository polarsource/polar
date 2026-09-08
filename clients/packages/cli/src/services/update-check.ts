import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { VERSION } from '../version'

const REPO = 'polarsource/cli'
const STATE_DIR = join(homedir(), '.polar')
const STATE_FILE = join(STATE_DIR, 'update-check.json')
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000 // 24 hours

interface UpdateCheckState {
  lastChecked: string
  latestVersion: string
}

export function showUpdateNotice(): void {
  try {
    if (!existsSync(STATE_FILE)) return

    const raw = readFileSync(STATE_FILE, 'utf-8')
    const state: UpdateCheckState = JSON.parse(raw)

    if (!state.latestVersion || state.latestVersion === VERSION) return

    const dim = '\x1b[2m'
    const cyan = '\x1b[36m'
    const bold = '\x1b[1m'
    const reset = '\x1b[0m'

    process.stderr.write(
      `\n  ${dim}Update available:${reset} ${dim}${VERSION}${reset} ${dim}→${reset} ${bold}${cyan}${state.latestVersion}${reset}\n` +
        `  ${dim}Run${reset} ${cyan}polar update${reset} ${dim}to update${reset}\n\n`,
    )
  } catch {
    // Silently ignore any errors
  }
}

export function checkForUpdateInBackground(): void {
  try {
    let shouldCheck = true

    if (existsSync(STATE_FILE)) {
      try {
        const raw = readFileSync(STATE_FILE, 'utf-8')
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

    fetch(`https://api.github.com/repos/${REPO}/releases/latest`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((data: { tag_name?: string }) => {
        if (!data.tag_name) return

        if (!existsSync(STATE_DIR)) {
          mkdirSync(STATE_DIR, { recursive: true })
        }

        const state: UpdateCheckState = {
          lastChecked: new Date().toISOString(),
          latestVersion: data.tag_name,
        }

        return writeFile(STATE_FILE, JSON.stringify(state, null, 2))
      })
      .catch(() => {
        // Silently ignore all errors
      })
  } catch {
    // Silently ignore any errors
  }
}
