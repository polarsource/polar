import { test as base, expect } from '@playwright/test'
import { adminOrgSlug } from './support/env'

type Fixtures = {
  adminOrgSlug: string
}

/**
 * Shared test surface. Authenticated specs start from the storageState minted in
 * global setup; this fixture adds the seeded admin org slug.
 */
export const test = base.extend<Fixtures>({
  adminOrgSlug: async ({}, use) => {
    await use(adminOrgSlug)
  },
})

export { expect }
