import type { PolarCore } from '@polar-sh/sdk/2026-04'

import type { UnionToIntersection, User } from 'better-auth'
import type { PolarOrganizationOptions } from './organization/types'
import type { checkout } from './plugins/checkout'
import type { portal } from './plugins/portal'
import type { usage } from './plugins/usage'
import type { webhooks } from './plugins/webhooks'

export type Product = {
  /**
   * Product Id from Polar Product
   */
  productId: string
  /**
   * Easily identifiable slug for the product
   */
  slug: string
}

export type PolarPlugin = (
  client: PolarCore,
  options?: PolarOptions,
) => ReturnType<
  | ReturnType<typeof checkout>
  | ReturnType<typeof usage>
  | ReturnType<typeof portal>
  | ReturnType<typeof webhooks>
>

export type PolarPlugins = [PolarPlugin, ...PolarPlugin[]]

export type PolarEndpoints = UnionToIntersection<ReturnType<PolarPlugin>>

export interface PolarOptions {
  /**
   * Polar core client created with createPolarCore
   */
  client: PolarCore
  /**
   * Create a Polar customer after the user is inserted, with external_id set to user.id
   */
  createCustomerOnSignUp?: boolean
  /**
   * Additional metadata for new customers, evaluated after user creation.
   * The user ID, email, and name cannot be overridden.
   */
  getCustomerCreateParams?: (
    data: {
      user: Partial<User>
    },
    request?: Request,
  ) => Promise<{
    metadata?: Record<string, string | number | boolean>
  }>
  /**
   * EXPERIMENTAL: Mirror Better Auth organizations to Polar team customers.
   *
   * Do not enable this for applications that already handle organization
   * billing. Existing billing data is not migrated and can become inconsistent
   * with the newly synchronized Polar team customer.
   *
   * Organization support is disabled when omitted.
   */
  experimental_organizationSync?: PolarOrganizationOptions
  /**
   * Use Polar plugins
   */
  use: PolarPlugins
}
