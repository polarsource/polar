import { localBrowser, Stagehand } from '@browserbasehq/stagehand'
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect } from 'vitest'
import {
  API_URL,
  CHROME_PATH,
  CHROMIUM_SANDBOX,
  HEADLESS,
  OPENAI_API_KEY,
} from './constants'

const NAVIGATION_TIMEOUT = 120_000

type Browser = Awaited<ReturnType<typeof localBrowser.launch>>
type Page = NonNullable<Awaited<ReturnType<Browser['context']['activePage']>>>
export type Action = Awaited<ReturnType<Stagehand['observe']>>['data'][number]
type Variables = Record<string, string>
type Check = () => Promise<boolean>
type ConsoleCall = {
  type: string
  args: Array<{ value?: unknown; description?: string }>
}

const reportFailuresToConsole = () => {
  window.addEventListener('error', (event) =>
    console.error('[uncaught]', event.message),
  )
  window.addEventListener('unhandledrejection', (event) =>
    console.error('[unhandled rejection]', String(event.reason)),
  )
  const originalFetch = window.fetch
  window.fetch = async (input, init) => {
    const response = await originalFetch(input, init)
    if (!response.ok) {
      const url = input instanceof Request ? input.url : String(input)
      const body = (await response.clone().text()).slice(0, 500)
      console.error(
        '[fetch]',
        init?.method ?? 'GET',
        url,
        response.status,
        body,
      )
    }
    return response
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export class App {
  private step = 0
  private cleanups: Array<() => Promise<void>> = []

  private constructor(
    readonly browser: Browser,
    readonly stagehand: Stagehand,
    readonly page: Page,
    private readonly artifacts: string,
  ) {}

  static async launch(name: string): Promise<App> {
    if (!OPENAI_API_KEY) {
      throw new Error(
        'OPENAI_API_KEY is not set: export it or add it to apps/web/.env.local',
      )
    }
    const artifacts = fileURLToPath(
      new URL(`../artifacts/${name}/`, import.meta.url),
    )
    mkdirSync(artifacts, { recursive: true })
    const browser = await localBrowser.launch({
      headless: HEADLESS,
      executablePath: CHROME_PATH,
      chromiumSandbox: CHROMIUM_SANDBOX,
      viewport: { width: 1280, height: 900 },
    })
    const stagehand = await Stagehand.create({
      browser,
      model: {
        modelName: 'openai/gpt-5.5',
        apiKey: OPENAI_API_KEY,
      },
      selfHeal: true,
    })
    const page = await browser.context.activePage()
    if (!page) throw new Error('No active page')
    await page.addInitScript(reportFailuresToConsole)
    await page.on('console', (event) => {
      const { type, args } = event.params as ConsoleCall
      const text = args
        .map((arg) =>
          arg.value !== undefined ? String(arg.value) : (arg.description ?? ''),
        )
        .join(' ')
      appendFileSync(`${artifacts}browser.log`, `[${type}] ${text}\n`)
    })
    return new App(browser, stagehand, page, artifacts)
  }

  onCleanup(cleanup: () => Promise<void>): void {
    this.cleanups.unshift(cleanup)
  }

  async close(): Promise<void> {
    try {
      await this.snap('final')
    } finally {
      try {
        for (const cleanup of this.cleanups) await cleanup()
      } finally {
        await this.stagehand.close()
        await this.browser.close()
      }
    }
  }

  async goto(url: string): Promise<void> {
    await this.page.goto(url, { timeout: NAVIGATION_TIMEOUT })
    await this.page.waitForLoadState('load', NAVIGATION_TIMEOUT)
    await this.snap('loaded')
  }

  url(): Promise<string> {
    return this.page.url()
  }

  async snap(name: string): Promise<void> {
    this.step += 1
    const file = `${String(this.step).padStart(2, '0')}-${name}.png`
    appendFileSync(`${this.artifacts}browser.log`, `--- ${file}\n`)
    await this.page.screenshot({
      path: `${this.artifacts}${file}`,
      fullPage: true,
    })
  }

  async api<T>(
    path: string,
    init: { method?: string; token?: string; body?: unknown } = {},
  ): Promise<T> {
    const response = await fetch(`${API_URL}${path}`, {
      method: init.method ?? 'GET',
      headers: {
        ...(init.token ? { Authorization: `Bearer ${init.token}` } : {}),
        ...(init.body !== undefined
          ? { 'Content-Type': 'application/json' }
          : {}),
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    })
    if (!response.ok) {
      throw new Error(
        `${init.method ?? 'GET'} ${path} -> ${response.status} ${await response.text()}`,
      )
    }
    return (await response.json()) as T
  }

  async type(selector: string, value: string): Promise<void> {
    const field = this.page.locator(selector)
    const digits = (text: string) => text.replace(/\D/g, '')
    await expect
      .poll(
        async () => {
          await field.fill(value)
          await sleep(500)
          return digits(await field.inputValue())
        },
        { message: `${selector} value` },
      )
      .toBe(digits(value))
  }

  async plan(
    instruction: string,
    variables: Variables = {},
  ): Promise<Action[]> {
    const { data } = await this.stagehand.observe(instruction, {
      variables: Object.fromEntries(
        Object.entries(variables).map(([name, value]) => [name, { value }]),
      ),
    })
    writeFileSync(
      `${this.artifacts}${String(this.step + 1).padStart(2, '0')}-plan.json`,
      JSON.stringify(data, null, 2),
    )
    return data
  }

  async fill(
    action: Action,
    variables: Variables,
    saved: Check,
  ): Promise<void> {
    await expect
      .poll(
        async () => {
          await this.stagehand.act(action, { variables })
          await this.page.keyPress('Tab')
          await sleep(2_000)
          return saved()
        },
        { message: `${action.description} saved` },
      )
      .toBe(true)
    await this.snap('filled')
  }

  async select(what: string, value: string, chosen: Check): Promise<void> {
    await expect
      .poll(
        async () => {
          await this.page.keyPress('Escape')
          await this.stagehand.act(`Open the ${what} dropdown`)
          await this.page.type(value)
          await this.page.keyPress('Enter')
          await sleep(2_000)
          return chosen()
        },
        { message: `${what} set to ${value}` },
      )
      .toBe(true)
    await this.snap('selected')
  }

  async click(action: Action, done: Check): Promise<void> {
    const disabled = this.page.locator(`${action.selector}[@disabled]`)
    await expect
      .poll(() => disabled.count(), {
        message: `${action.description} still disabled`,
      })
      .toBe(0)
    await expect
      .poll(
        async () => {
          await this.stagehand.act(action)
          await sleep(3_000)
          return done()
        },
        { message: `${action.description} took effect` },
      )
      .toBe(true)
    await this.snap('clicked')
  }
}

export const actionFilling = (actions: Action[], variable: string): Action => {
  const action = actions.find((a) => a.arguments?.includes(`%${variable}%`))
  if (!action) throw new Error(`No action fills %${variable}%`)
  return action
}

export const actionClicking = (actions: Action[]): Action => {
  const action = actions.find((a) => a.method === 'click')
  if (!action) throw new Error('No click action in the plan')
  return action
}
