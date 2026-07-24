import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Resolves the URLs and dev-docker instance the E2E suite runs against.
 *
 * `dev e2e` exports E2E_WEB_URL / E2E_API_URL / E2E_INSTANCE for this
 * worktree's stack (ports 31NN / 81NN). Running Playwright directly with no
 * env falls back to the legacy non-docker ports (3000 / 8000).
 */

export function loadEnvLocal(dir: string): void {
  try {
    const content = readFileSync(resolve(dir, '.env.local'), 'utf-8')
    for (const line of content.split('\n')) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*"?(.*?)"?\s*$/)
      if (match && !process.env[match[1]]) {
        process.env[match[1]] = match[2]
      }
    }
  } catch {
    // ignore
  }
}

const instance = Number.parseInt(process.env.E2E_INSTANCE ?? '', 10)
const e2eInstance: number | null = Number.isInteger(instance) ? instance : null

/**
 * True only when running against a dev-docker instance (i.e. launched via
 * `dev e2e`, which sets E2E_INSTANCE). The specs need the local stack — its
 * OTP-from-logs login, seed data, and ports — so when this is false (e.g. a CI
 * `playwright test` against a remote URL) global setup no-ops and the specs skip
 * instead of failing.
 */
export const hasDevDockerInstance: boolean = e2eInstance !== null

// `dev e2e` always exports E2E_WEB_URL / E2E_API_URL (derived from the docker
// port scheme in dev/cli/commands/docker.py). Running Playwright directly falls
// back to the legacy non-docker ports.
export const webURL: string = process.env.E2E_WEB_URL ?? 'http://localhost:3000'
export const apiURL: string = process.env.E2E_API_URL ?? 'http://localhost:8000'

/** Container that logs the email OTP code, e.g. `polar-app-13-api-1`. */
export const apiContainer: string | null =
  e2eInstance === null ? null : `polar-app-${e2eInstance}-api-1`

export const workerContainer: string | null =
  e2eInstance === null ? null : `polar-app-${e2eInstance}-worker-1`

/** Seed account that owns the approved `admin-org` (products, payout account). */
export const adminEmail = process.env.E2E_ADMIN_EMAIL ?? 'admin@polar.sh'
export const adminOrgSlug = process.env.E2E_ADMIN_ORG ?? 'admin-org'

export const storageStatePath = resolve(__dirname, '..', '.auth', 'admin.json')
