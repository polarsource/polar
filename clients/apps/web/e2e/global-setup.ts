import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { chromium, type FullConfig, request } from '@playwright/test'
import { login } from './support/auth'
import {
  apiURL,
  hasDevDockerInstance,
  storageStatePath,
  webURL,
} from './support/env'

async function waitForReady(): Promise<void> {
  const api = await request.newContext()
  const deadline = Date.now() + 180_000
  while (Date.now() < deadline) {
    try {
      const health = await api.get(`${apiURL}/healthz`)
      // Follow redirects: the web root 307s to /auth or /dashboard.
      const web = await api.get(webURL)
      if (health.ok() && web.status() < 500) {
        await api.dispose()
        return
      }
    } catch {
      // stack still coming up
    }
    await new Promise((r) => setTimeout(r, 5000))
  }
  await api.dispose()
  throw new Error(
    `Stack not ready: api=${apiURL} web=${webURL}. Is \`dev docker up\` running?`,
  )
}

/**
 * Runs once before the suite: waits for the dev-docker stack, logs in as the
 * seed admin via the real OTP flow, and saves storageState so every spec starts
 * authenticated (and the suite stays fully parallel).
 */
export default async function globalSetup(_config: FullConfig): Promise<void> {
  // No dev-docker instance (e.g. a CI `playwright test` against a remote URL):
  // skip login/storageState so we don't crash. The specs skip themselves too.
  if (!hasDevDockerInstance) return

  await waitForReady()

  mkdirSync(dirname(storageStatePath), { recursive: true })
  const browser = await chromium.launch()
  const context = await browser.newContext()
  const page = await context.newPage()
  try {
    await login(page)
    await context.storageState({ path: storageStatePath })
  } finally {
    await browser.close()
  }
}
