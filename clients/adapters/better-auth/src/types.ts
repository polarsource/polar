import type { Polar } from '@polar-sh/sdk/2026-04'

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
  client: Polar,
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
   * Polar Client
   */
  client: Polar
  /**
   * Enable customer creation when a user signs up
   */
  createCustomerOnSignUp?: boolean
  /**
   * A custom function to get the customer create
   * params
   * @param data - data containing user and session
   * @returns
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
