import { chromium } from '@playwright/test'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const [, , jobPath, side, ...rest] = process.argv
const headed = rest.includes('--headed')

if (!jobPath || (side !== 'before' && side !== 'after')) {
  console.error('usage: snap-capture.mjs <job.json> <before|after> [--headed]')
  process.exit(2)
}

const status = (msg) => console.log(`STATUS: ${msg}`)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function poll(fn, { timeout = 30000, interval = 400 } = {}) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    const v = await fn()
    if (v) return v
    await sleep(interval)
  }
  return null
}

function disableAnimationsInit() {
  const orig = Element.prototype.animate
  Element.prototype.animate = function (keyframes, options) {
    options =
      options && typeof options === 'object' ? { ...options, duration: 0 } : 0
    return orig.call(this, keyframes, options)
  }
}

async function login(page, job, baseUrl, runDir) {
  const apiLog = path.join(runDir, 'api.log')

  const before = existsSync(apiLog)
    ? (await readFile(apiLog, 'utf8')).length
    : 0

  status('logging in')
  await page.goto(`${baseUrl}/auth`, { waitUntil: 'load' })
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
  await page.fill('input[type="email"]', job.login_email)

  const signIn = page.getByRole('button', { name: 'Sign in with email' })
  let navigated = false
  for (let attempt = 0; attempt < 3 && !navigated; attempt++) {
    navigated = await page
      .waitForURL(/email-otp/, { timeout: 45000 })
      .then(() => true)
      .catch(() => false)
  }
  if (!navigated) throw new Error('login did not advance to the OTP step')

  const code = await poll(
    async () => {
      if (!existsSync(apiLog)) return null
      const fresh = (await readFile(apiLog, 'utf8')).slice(before)
      const matches = [...fresh.matchAll(/LOGIN CODE:\s*([A-Z0-9]+)/g)]
      return matches.length ? matches[matches.length - 1][1] : null
    },
    { timeout: 30000, interval: 400 },
  )
  if (!code)
    throw new Error('OTP code never appeared in api.log (is the run’s API up?)')

  await page.waitForURL(/\/dashboard/, { timeout: 30000 }).catch(() => {})
}

function toUrl(shotUrl, baseUrl) {
  if (/^https?:\/\//.test(shotUrl)) {
    const u = new URL(shotUrl)
    return baseUrl + u.pathname + u.search
  }
  return baseUrl + (shotUrl.startsWith('/') ? shotUrl : `/${shotUrl}`)
}

async function main() {
  const job = JSON.parse(await readFile(jobPath, 'utf8'))

  const resultDir = path.join(runDir, 'result')
  const baseUrl = `http://${job.host}:${job.port}`
  const shots = job.shots || []
  const viewports =
    job.viewports && job.viewports.length
      ? job.viewports
      : [{ name: 'desktop', width: 1440, height: 900 }]

  const browser = await chromium.launch({ headless: !headed })
  const context = await browser.newContext({
    viewport: { width: viewports[0].width, height: viewports[0].height },
    deviceScaleFactor: 1,
  })
  await context.addInitScript(disableAnimationsInit)
  const page = await context.newPage()

  const failures = []
  const total = shots.length * viewports.length
  let done = 0
  try {
    if (job.needs_login) {
      await login(page, job, baseUrl, runDir)
    }

    for (const shot of shots) {
      const target = toUrl(shot.url, baseUrl)

      for (const vp of viewports) {
        done++
        status(`${side}: ${shot.url} @ ${vp.name} (${done}/${total})`)
        try {
          await page.setViewportSize({ width: vp.width, height: vp.height })
          const resp = await page.goto(target, {
            waitUntil: 'domcontentloaded',
          })
          await page
            .waitForLoadState('networkidle', { timeout: 15000 })
            .catch(() => {})

          if (resp && resp.status() >= 500)
            throw new Error(`HTTP ${resp.status()}`)
          const errored = await page.evaluate(() => {
            const t = document.body?.innerText || ''
            return (
              t.includes('Something went wrong') &&
              t.includes('Debugging information')
            )
          })
          if (errored) throw new Error('app error boundary rendered')

          await page.evaluate(() => {
            for (const a of document.getAnimations()) {
              try {
                a.finish()
              } catch {}
            }
          })
          await sleep(250)
          await page.screenshot({
            path: path.join(resultDir, `${shot.slug}_${vp.name}_${side}.png`),
            fullPage: true,
          })
        } catch (err) {
          failures.push(`${shot.url} @ ${vp.name}: ${err.message}`)
          console.error(`ERROR ${shot.url} @ ${vp.name}: ${err.message}`)
        }
      }
    }
  } finally {
    await context.close()
    await browser.close()
  }

  if (failures.length) {
    console.error(
      `FAILED ${failures.length}/${total} shot(s) on the ${side} side`,
    )
    process.exit(1)
  }
}

main().catch((err) => {
  console.error(`FATAL ${err.stack || err.message}`)
  process.exit(1)
})
