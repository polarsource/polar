import { createCheckouts } from '@polar-sh/sdk/2026-04/services/checkouts'
import type { PolarCore } from '@polar-sh/sdk/2026-04'
import {
  APIError,
  createAuthEndpoint,
  getSessionFromCtx,
} from 'better-auth/api'
import * as z from 'zod/v4'
import { getBetterAuthCreatorRole } from '../organization/roles'
import {
  getBetterAuthOrganizationOptions,
  getCheckoutSeatProducts,
  getOrganization,
  getOrganizationRoster,
  resolveRosterProductAllocations,
} from '../organization/seats'
import { isTeamCustomerSynchronized } from '../organization/sync'
import { resolveBillingPrincipal } from '../principal'
import type { PolarOptions, Product } from '../types'

export interface CheckoutOptions {
  /**
   * Optional list of slug -> productId mappings for easy slug checkouts
   */
  products?: Product[] | (() => Promise<Product[]>)
  /**
   * Checkout Success URL
   */
  successUrl?: string
  /**
   * Checkout Return URL
   */
  returnUrl?: string
  /**
   * Only allow authenticated customers to checkout
   */
  authenticatedUsersOnly?: boolean
  /**
   * Checkout theme
   */
  theme?: 'light' | 'dark'
}

export const CheckoutParams = z.object({
  products: z.union([z.array(z.string()), z.string()]).optional(),
  slug: z.string().optional(),
  referenceId: z.string().optional(),
  organizationId: z.string().min(1).optional(),
  customFieldData: z
    .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
    .optional(),
  metadata: z
    .record(z.string(), z.union([z.string().max(500), z.number(), z.boolean()]))
    .refine((obj) => Object.keys(obj).length <= 50, {
      message: 'Metadata can have at most 50 key-value pairs',
    })
    .refine((obj) => Object.keys(obj).every((key) => key.length <= 40), {
      message: 'Metadata keys must be at most 40 characters',
    })
    .optional(),
  allowDiscountCodes: z.coerce.boolean().optional(),
  discountId: z.string().optional(),
  seats: z.number().int().min(1).max(10_000).optional(),
  minSeats: z.number().int().min(1).max(10_000).optional(),
  maxSeats: z.number().int().min(1).max(10_000).optional(),
  redirect: z.coerce.boolean().optional(),
  embedOrigin: z.url().optional(),
  successUrl: z
    .string()
    .refine((val) => val.startsWith('/') || URL.canParse(val), {
      message: 'Must be a valid URL or a relative path starting with /',
    })
    .optional(),
  returnUrl: z
    .string()
    .refine((val) => val.startsWith('/') || URL.canParse(val), {
      message: 'Must be a valid URL or a relative path starting with /',
    })
    .optional(),
  allowTrial: z.boolean().optional(),
  trialInterval: z.enum(['day', 'week', 'month', 'year']).optional(),
  trialIntervalCount: z.number().int().min(1).max(1000).optional(),
})

export type CheckoutParams = z.infer<typeof CheckoutParams>

export const checkout =
  (checkoutOptions: CheckoutOptions = {}) =>
  (
    polar: PolarCore,
    rootOptions?: Pick<PolarOptions, 'experimental_organizationSync'>,
  ) => {
    return {
      checkout: createAuthEndpoint(
        '/checkout',
        {
          method: 'POST',
          body: CheckoutParams,
        },
        async (ctx) => {
          const session = await getSessionFromCtx(ctx)

          let productIds: string[] = []

          if (ctx.body.slug) {
            const resolvedProducts = await (typeof checkoutOptions.products ===
            'function'
              ? checkoutOptions.products()
              : checkoutOptions.products)

            const productId = resolvedProducts?.find(
              (product) => product.slug === ctx.body.slug,
            )?.productId

            if (!productId) {
              throw new APIError('BAD_REQUEST', {
                message: 'Product not found',
              })
            }

            productIds = [productId]
          } else {
            productIds = Array.isArray(ctx.body.products)
              ? ctx.body.products.filter((id) => id !== undefined)
              : [ctx.body.products].filter((id) => id !== undefined)
          }

          if (checkoutOptions.authenticatedUsersOnly) {
            if (!session?.user.id) {
              throw new APIError('UNAUTHORIZED', {
                message: 'You must be logged in to checkout',
              })
            }

            if (session.user['isAnonymous']) {
              throw new APIError('UNAUTHORIZED', {
                message: 'Anonymous users are not allowed to checkout',
              })
            }
          }

          const principal = ctx.body.organizationId
            ? await resolveBillingPrincipal({
                context: ctx.context,
                session,
                organizationId: ctx.body.organizationId,
                organizationEnabled:
                  rootOptions?.experimental_organizationSync?.enabled,
                authorization: 'billing',
                roleMapping: {
                  creatorRole: getBetterAuthCreatorRole(ctx.context),
                  mapBetterAuthRoleToPolarRole:
                    rootOptions?.experimental_organizationSync
                      ?.mapBetterAuthRoleToPolarRole,
                },
              })
            : undefined
          if (
            principal?.kind === 'team' &&
            !(await isTeamCustomerSynchronized(
              polar,
              principal.externalCustomerId,
            ))
          ) {
            throw new APIError('BAD_REQUEST', {
              message:
                'Polar team customer was not found for this Better Auth organization. Use referenceId for an existing unsynchronized organization.',
            })
          }

          let seats = ctx.body.seats
          let minSeats = ctx.body.minSeats
          let maxSeats = ctx.body.maxSeats
          const organizationOptions = rootOptions?.experimental_organizationSync
          if (
            principal?.kind === 'team' &&
            organizationOptions?.enabled &&
            organizationOptions.syncSeats
          ) {
            const products = await getCheckoutSeatProducts(polar, productIds)
            if (products.length > 0) {
              const betterAuthOrganizationOptions =
                getBetterAuthOrganizationOptions(ctx.context)
              const [organization, roster] = await Promise.all([
                getOrganization(ctx.context, principal.externalCustomerId),
                getOrganizationRoster(
                  ctx.context,
                  betterAuthOrganizationOptions,
                  principal.externalCustomerId,
                ),
              ])
              const allocations = await resolveRosterProductAllocations({
                organization,
                roster,
                products,
                selector: organizationOptions.selectSeatProductsForMember,
              })
              const allocationsList = [...allocations.values()]
              if (
                allocationsList.every(
                  (allocation) => allocation.memberIds.size === 0,
                )
              ) {
                throw new APIError('BAD_REQUEST', {
                  message:
                    'Organization checkout requires at least one selected product seat',
                })
              }
              const counts = new Set(
                allocationsList.map((allocation) =>
                  Math.max(allocation.memberIds.size, allocation.minimumSeats),
                ),
              )
              if (counts.size !== 1) {
                throw new APIError('BAD_REQUEST', {
                  message:
                    'Organization products require different seat quantities. Create a separate checkout for each seat-based product.',
                })
              }
              const calculatedSeats = counts.values().next().value as number
              if (calculatedSeats > 10_000) {
                throw new APIError('BAD_REQUEST', {
                  message:
                    'Organization checkout supports at most 10,000 product seats',
                })
              }
              seats = calculatedSeats
              minSeats = calculatedSeats
              maxSeats = calculatedSeats
            }
          }

          const successUrl = ctx.body.successUrl ?? checkoutOptions.successUrl
          const returnUrl = ctx.body.returnUrl ?? checkoutOptions.returnUrl

          try {
            const checkout = await createCheckouts(polar)({
              external_customer_id:
                principal?.externalCustomerId ?? session?.user.id,
              products: productIds,
              success_url: successUrl
                ? new URL(
                    successUrl,
                    ctx.request?.url ?? ctx.context.baseURL,
                  ).toString()
                : undefined,
              metadata: ctx.body.referenceId
                ? {
                    referenceId: ctx.body.referenceId,
                    ...ctx.body.metadata,
                  }
                : ctx.body.metadata,
              custom_field_data: ctx.body.customFieldData,
              allow_discount_codes: ctx.body.allowDiscountCodes ?? true,
              discount_id: ctx.body.discountId,
              seats,
              min_seats: minSeats,
              max_seats: maxSeats,
              embed_origin: ctx.body.embedOrigin,
              allow_trial: ctx.body.allowTrial,
              trial_interval: ctx.body.trialInterval,
              trial_interval_count: ctx.body.trialIntervalCount,
              return_url: returnUrl
                ? new URL(
                    returnUrl,
                    ctx.request?.url ?? ctx.context.baseURL,
                  ).toString()
                : undefined,
            })

            const redirectUrl = new URL(checkout.url)

            if (checkoutOptions.theme) {
              redirectUrl.searchParams.set('theme', checkoutOptions.theme)
            }

            return ctx.json({
              url: redirectUrl.toString(),
              redirect: ctx.body.redirect ?? true,
            })
          } catch (e: unknown) {
            if (e instanceof Error) {
              ctx.context.logger.error(
                `Polar checkout creation failed. Error: ${e.message}`,
              )
            }

            throw new APIError('INTERNAL_SERVER_ERROR', {
              message: 'Checkout creation failed',
            })
          }
        },
      ),
    }
  }
