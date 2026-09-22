import { test as base } from 'vitest'
import { App } from './app'

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
  }
}

export const test = base.extend<{ app: App }>({
  app: async ({ task }, use) => {
    const attempt = (task.result?.retryCount ?? 0) + 1
    const artifacts = `${slug(task)}/attempt-${attempt}`
    task.meta.artifacts = artifacts
    const app = await App.launch(artifacts)
    try {
      await use(app)
    } finally {
      await app.close()
    }
  },
})

export { describe, expect } from 'vitest'
