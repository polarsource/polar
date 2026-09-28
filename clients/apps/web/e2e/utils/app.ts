import { appendFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  type Browser,
  type BrowserContext,
  chromium,
  type Frame,
  type Locator,
  type Page,
} from 'playwright'
import { expect } from 'vitest'
import { api, type ApiInit } from './api'
import { HEADLESS } from './constants'

const NAVIGATION_TIMEOUT = 120_000

type Check = () => Promise<boolean>
export type Meta = { checkoutUrl?: string }

const SETTLE = { timeout: 5_000, interval: 1_000 }
const digits = (text: string) => text.replace(/\D/g, '')
const stamp = () => new Date().toISOString().slice(11, 19)

export class App {
  private step = 0
  private cleanups: Array<() => Promise<void>> = []

  private constructor(
    readonly browser: Browser,
    readonly context: BrowserContext,
    readonly page: Page,
    readonly meta: Meta,
    private readonly artifacts: string,
  ) {}

  static async launch(name: string, meta: Meta): Promise<App> {
    const artifacts = fileURLToPath(
      new URL(`../artifacts/${name}/`, import.meta.url),
    )
    mkdirSync(artifacts, { recursive: true })
    const browser = await chromium.launch({
      headless: HEADLESS,
    })
    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
    })
    await context.tracing.start({ snapshots: true })
    const page = await context.newPage()
    const log = (line: string) =>
      appendFileSync(`${artifacts}browser.log`, `${line}\n`)
    log(`--- ${stamp()} browser launched`)
    page.on('console', (message) =>
      log(`[${message.type()}] ${message.text()}`),
    )
    page.on('pageerror', (error) => log(`[uncaught] ${error.message}`))
    page.on('response', (response) => {
      if (response.status() < 400) return
      response
        .text()
        .catch(() => '')
        .then((body) =>
          log(
            `[response] ${response.request().method()} ${response.url()} ${response.status()} ${body.slice(0, 500)}`,
          ),
        )
    })
    return new App(browser, context, page, meta, artifacts)
  }

  onCleanup(cleanup: () => Promise<void>): void {
    this.cleanups.unshift(cleanup)
  }

  async close(): Promise<void> {
    try {
      await this.snap('final')
    } finally {
      try {
        this.mark('cleanup')
        for (const cleanup of this.cleanups) await cleanup()
      } finally {
        this.mark('closing browser')
        await this.context.tracing
          .stop({ path: `${this.artifacts}trace.zip` })
          .catch((error: Error) => this.mark(`trace failed: ${error.message}`))
        await this.context.close()
        this.mark('context closed')
        await this.browser.close()
        this.mark('browser closed')
      }
    }
  }

  async goto(url: string): Promise<void> {
    this.mark('navigating')
    await this.page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: NAVIGATION_TIMEOUT,
    })
    await this.snap('loaded')
  }

  async url(): Promise<string> {
    return this.page.url()
  }

  mark(what: string): void {
    appendFileSync(`${this.artifacts}browser.log`, `--- ${stamp()} ${what}\n`)
  }

  async snap(name: string): Promise<void> {
    this.step += 1
    const file = `${String(this.step).padStart(2, '0')}-${name}.png`
    this.mark(file)
    await this.page
      .screenshot({
        path: `${this.artifacts}${file}`,
        fullPage: true,
        caret: 'initial',
      })
      .catch((error: Error) => this.mark(`${file} failed: ${error.message}`))
  }

  api = <T>(path: string, init: ApiInit = {}): Promise<T> => api<T>(path, init)

  stripeField(name: string): Locator {
    return this.page
      .frameLocator('iframe[title="Secure payment input frame"]')
      .locator(`input[name="${name}"]`)
  }

  frame(url: RegExp): Frame | undefined {
    return this.page.frames().find((frame) => url.test(frame.url()))
  }

  async type(field: Locator, value: string): Promise<void> {
    await expect
      .poll(
        async () => {
          await field.fill(value)
          await expect
            .poll(async () => digits(await field.inputValue()), SETTLE)
            .toBe(digits(value))
          return true
        },
        { message: `${field} value` },
      )
      .toBe(true)
  }

  async fill(
    field: Locator,
    value: string,
    saved: Check,
    commit: () => Promise<void> = () => this.page.keyboard.press('Tab'),
  ): Promise<void> {
    await expect
      .poll(
        async () => {
          await field.fill(value)
          await commit()
          await expect.poll(saved, SETTLE).toBe(true)
          return true
        },
        { message: `${field} saved` },
      )
      .toBe(true)
    await this.snap('filled')
  }

  async select(trigger: Locator, value: string, chosen: Check): Promise<void> {
    await expect
      .poll(
        async () => {
          await this.page.keyboard.press('Escape')
          await trigger.click()
          this.mark('trigger clicked')
          await this.page
            .getByRole('listbox')
            .waitFor({ timeout: SETTLE.timeout })
          this.mark('listbox open')
          await this.page.keyboard.type(value)
          await expect
            .poll(
              () =>
                this.page.evaluate(() => document.activeElement?.textContent),
              { timeout: 5_000, message: `highlighted option in ${trigger}` },
            )
            .toBe(value)
          this.mark('option highlighted')
          await this.page.keyboard.press('Enter')
          await expect
            .poll(
              async () =>
                (await trigger.innerText()).includes(value) && (await chosen()),
              SETTLE,
            )
            .toBe(true)
          this.mark('selection saved')
          return true
        },
        { message: `${trigger} set to ${value}` },
      )
      .toBe(true)
    await this.snap('selected')
  }

  async click(button: Locator, done: Check): Promise<void> {
    await expect
      .poll(() => button.isEnabled(), { message: `${button} enabled` })
      .toBe(true)
    await expect
      .poll(
        async () => {
          if (await done()) return true
          await button.click()
          await expect.poll(done, SETTLE).toBe(true)
          return true
        },
        { message: `${button} took effect` },
      )
      .toBe(true)
    await this.snap('clicked')
  }
}
