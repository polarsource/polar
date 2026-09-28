import type { schemas } from '@polar-sh/client'
import { test as base } from 'vitest'
import { App } from './app'
import { type CheckoutPage, openCheckout } from './checkout'
import {
  type CustomFieldSpec,
  type DiscountSpec,
  ensureCustomField,
  ensureDiscount,
  ensureMeter,
  type MeterSpec,
} from './org'
import { orgApi } from './api'
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
  openCheckout: (specs: ProductSpec | ProductSpec[]) => Promise<CheckoutPage>
  org: {
    discount: (spec: DiscountSpec) => ReturnType<typeof ensureDiscount>
    customField: (spec: CustomFieldSpec) => ReturnType<typeof ensureCustomField>
    meter: (spec: MeterSpec) => ReturnType<typeof ensureMeter>
    order: (id: string) => Promise<schemas['Order']>
  }
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
    await use((specs) => openCheckout(app, specs))
  },
  org: async ({}, use) => {
    await use({
      discount: ensureDiscount,
      customField: ensureCustomField,
      meter: ensureMeter,
      order: (id) => orgApi<schemas['Order']>(`/v1/orders/${id}`),
    })
  },
})

export { describe, expect } from 'vitest'
