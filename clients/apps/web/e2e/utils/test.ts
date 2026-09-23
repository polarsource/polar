import { test as base } from 'vitest'
import { App } from './app'
import { type CheckoutPage, openCheckout } from './checkout'
import type { ProductSpec } from './products'

type Named = { name: string; suite?: Named }
const names = (task?: Named): string[] =>
  task ? [...names(task.suite), task.name] : []
const slug = (task: Named) =>
  names(task)
    .join(' ')
    .replace(/[^a-z0-9]+/gi, '-')
    .toLowerCase()

declare module 'vitest' {
  interface TaskMeta {
    artifacts?: string
    checkoutUrl?: string
  }
}

export const test = base.extend<{
  app: App
  openCheckout: (spec: ProductSpec) => Promise<CheckoutPage>
}>({
  app: async ({ task }, use) => {
    const attempt = (task.result?.retryCount ?? 0) + 1
    const artifacts = `${slug(task)}/attempt-${attempt}`
    task.meta.artifacts = artifacts
    const app = await App.launch(artifacts, task.meta)
    try {
      await use(app)
    } finally {
      await app.close()
    }
  },
  openCheckout: async ({ app }, use) => {
    await use((spec) => openCheckout(app, spec))
  },
})

export { describe, expect } from 'vitest'
