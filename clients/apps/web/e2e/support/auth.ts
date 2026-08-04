import { spawnSync } from 'node:child_process'
import type { Page } from '@playwright/test'
import { adminEmail, apiContainer, webURL, workerContainer } from './env'

const CODE_RE = /LOGIN CODE:\s*([0-9A-Z]{6})/g

/**
 * Reads the most recent email OTP code from the dev-docker container logs.
 *
 * The backend prints `🔑 LOGIN CODE: XXXXXX` (to stderr) when an OTP is
 * requested (server/polar/auth/factors.py). The api usually renders it; we fall
 * back to the worker only if the api log has nothing yet.
 */
export function readLoginCode(): string | null {
  const containers = [apiContainer, workerContainer].filter(
    (c): c is string => Boolean(c),
  )
  if (containers.length === 0) {
    throw new Error(
      'E2E_INSTANCE is not set — cannot read the OTP from container logs. Run via `dev e2e`.',
    )
  }
  for (const container of containers) {
    const result = spawnSync(
      'docker',
      ['logs', '--since', '90s', container],
      { encoding: 'utf-8' },
    )
    const logs = `${result.stdout ?? ''}${result.stderr ?? ''}`
    const matches = [...logs.matchAll(CODE_RE)]
    if (matches.length > 0) return matches[matches.length - 1][1]
  }
  return null
}

/** Polls the container logs for a login code newer than `before`. */
export async function waitForFreshCode(
  page: Page,
  before: string | null,
): Promise<string> {
  for (let i = 0; i < 60; i++) {
    const code = readLoginCode()
    if (code && code !== before) return code
    await page.waitForTimeout(500)
  }
  throw new Error('Timed out waiting for a fresh LOGIN CODE in container logs')
}

/**
 * Drives the email-OTP form for `email`: submits the address, reads the fresh
 * code from the logs, and enters it. Leaves `page` on whatever the OTP submit
 * redirects to (the caller waits for its own destination).
 */
export async function requestEmailOtp(page: Page, email: string): Promise<void> {
  await page.goto(`${webURL}/auth`)
  // Baseline the current code so we wait for the one this request generates.
  const before = readLoginCode()

  await page.getByPlaceholder('Email').fill(email)
  await page.getByRole('button', { name: /sign in with email/i }).click()
  await page.waitForURL(/\/auth\/email-otp/, { timeout: 30_000 })

  const code = await waitForFreshCode(page, before)
  // The OTP input auto-submits once six characters are entered (onComplete).
  await page.locator('input[autocomplete="one-time-code"]').fill(code)
}

async function loginOnce(page: Page): Promise<void> {
  await requestEmailOtp(page, adminEmail)
  await page.waitForURL(/\/dashboard\//, { timeout: 30_000 })
}

/**
 * Logs in as the seed admin through the real dashboard email-OTP flow and
 * leaves `page` on the authenticated dashboard. Retries once, since the OTP
 * round-trip is occasionally slow on a cold stack.
 */
export async function login(page: Page): Promise<void> {
  try {
    await loginOnce(page)
  } catch {
    await loginOnce(page)
  }
}
