import { listBenefitGrants as listBenefitGrantsCustomerPortal } from '@polar-sh/sdk/2026-10/services/customer_portal/benefit_grants'
import { listSubscriptions as listSubscriptionsCustomerPortal } from '@polar-sh/sdk/2026-10/services/customer_portal/subscriptions'
import { getStateExternalCustomers } from '@polar-sh/sdk/2026-10/services/customers'
import { listOrders as listOrdersCustomerPortal } from '@polar-sh/sdk/2026-10/services/customer_portal/orders'
import { createCustomerSessions } from '@polar-sh/sdk/2026-10/services/customer_sessions'
import { listSubscriptions } from '@polar-sh/sdk/2026-10/services/subscriptions'
import type { models, PolarCore } from '@polar-sh/sdk/2026-10'
import { APIError } from 'better-auth/api'
import { createAuthEndpoint, sessionMiddleware } from 'better-auth/api'
import * as z from 'zod/v4'
import { resolveBillingPrincipal } from '../principal'
import {
  type ListResourceReferenceSubscription,
  resolveReferenceAccess,
  toEntitlementSubscription,
} from '../reference'
import type { PolarOptions } from '../types'

const OrganizationQuery = z.object({
  organizationId: z.string().min(1).optional(),
})

export interface PortalConfig {
  returnUrl?: string
  /**
   * Portal theme
   */
  theme?: 'light' | 'dark'
}

export const portal =
  ({ returnUrl, theme }: PortalConfig = {}) =>
  (
    polar: PolarCore,
    rootOptions?: Pick<
      PolarOptions,
      'experimental_organizationSync' | 'authorizeReference'
    >,
  ) => {
    const retUrl = returnUrl ? new URL(returnUrl) : undefined
    let warnedUnauthorizedReference = false

    return {
      portal: createAuthEndpoint(
        '/customer/portal',
        {
          method: ['GET', 'POST'],
          body: z
            .object({
              redirect: z.boolean().optional(),
            })
            .optional(),
          query: OrganizationQuery.optional(),
          use: [sessionMiddleware],
        },
        async (ctx) => {
          if (!ctx.context.session?.user.id) {
            throw new APIError('BAD_REQUEST', {
              message: 'User not found',
            })
          }

          if (ctx.context.session?.user['isAnonymous']) {
            throw new APIError('UNAUTHORIZED', {
              message: 'Anonymous users cannot access the portal',
            })
          }

          const principal = ctx.query?.organizationId
            ? await resolveBillingPrincipal({
                context: ctx.context,
                session: ctx.context.session,
                organizationId: ctx.query.organizationId,
                organizationEnabled:
                  rootOptions?.experimental_organizationSync?.enabled,
                authorization: 'member',
              })
            : undefined

          try {
            const customerSession = await createCustomerSessions(polar)({
              external_customer_id:
                principal?.externalCustomerId ?? ctx.context.session.user.id,
              ...(principal?.kind === 'team'
                ? { external_member_id: principal.externalMemberId }
                : {}),
              return_url: retUrl ? decodeURI(retUrl.toString()) : undefined,
            })

            const portalUrl = new URL(customerSession.customer_portal_url)

            if (theme) {
              portalUrl.searchParams.set('theme', theme)
            }

            return ctx.json({
              url: portalUrl.toString(),
              redirect: ctx.body?.redirect ?? true,
            })
          } catch (e: unknown) {
            if (e instanceof Error) {
              ctx.context.logger.error(
                `Polar customer portal creation failed. Error: ${e.message}`,
              )
            }

            throw new APIError('INTERNAL_SERVER_ERROR', {
              message: 'Customer portal creation failed',
            })
          }
        },
      ),
      state: createAuthEndpoint(
        '/customer/state',
        {
          method: 'GET',
          query: OrganizationQuery.optional(),
          use: [sessionMiddleware],
        },
        async (ctx) => {
          if (!ctx.context.session.user.id) {
            throw new APIError('BAD_REQUEST', {
              message: 'User not found',
            })
          }

          const principal = ctx.query?.organizationId
            ? await resolveBillingPrincipal({
                context: ctx.context,
                session: ctx.context.session,
                organizationId: ctx.query.organizationId,
                organizationEnabled:
                  rootOptions?.experimental_organizationSync?.enabled,
                authorization: 'member',
              })
            : undefined

          try {
            const state: models.CustomerState = await getStateExternalCustomers(
              polar,
            )(principal?.externalCustomerId ?? ctx.context.session.user.id)

            return ctx.json(state)
          } catch (e: unknown) {
            if (e instanceof Error) {
              ctx.context.logger.error(
                `Polar subscriptions list failed. Error: ${e.message}`,
              )
            }

            throw new APIError('INTERNAL_SERVER_ERROR', {
              message: 'Subscriptions list failed',
            })
          }
        },
      ),
      benefits: createAuthEndpoint(
        '/customer/benefits/list',
        {
          method: 'GET',
          query: z
            .object({
              organizationId: z.string().min(1).optional(),
              page: z.coerce.number().optional(),
              limit: z.coerce.number().optional(),
            })
            .optional(),
          use: [sessionMiddleware],
        },
        async (ctx) => {
          if (!ctx.context.session.user.id) {
            throw new APIError('BAD_REQUEST', {
              message: 'User not found',
            })
          }

          const principal = ctx.query?.organizationId
            ? await resolveBillingPrincipal({
                context: ctx.context,
                session: ctx.context.session,
                organizationId: ctx.query.organizationId,
                organizationEnabled:
                  rootOptions?.experimental_organizationSync?.enabled,
                authorization: 'member',
              })
            : undefined

          try {
            const customerSession = await createCustomerSessions(polar)({
              external_customer_id:
                principal?.externalCustomerId ?? ctx.context.session.user.id,
              ...(principal?.kind === 'team'
                ? { external_member_id: principal.externalMemberId }
                : {}),
            })

            const benefits: models.ListResourceCustomerBenefitGrant =
              await listBenefitGrantsCustomerPortal(polar)(
                {
                  page: ctx.query?.page,
                  limit: ctx.query?.limit,
                },
                { accessToken: customerSession.token },
              )

            return ctx.json(benefits)
          } catch (e: unknown) {
            if (e instanceof Error) {
              ctx.context.logger.error(
                `Polar benefits list failed. Error: ${e.message}`,
              )
            }

            throw new APIError('INTERNAL_SERVER_ERROR', {
              message: 'Benefits list failed',
            })
          }
        },
      ),
      subscriptions: createAuthEndpoint(
        '/customer/subscriptions/list',
        {
          method: 'GET',
          query: z
            .object({
              organizationId: z.string().min(1).optional(),
              reference_id: z.string().optional(),
              page: z.coerce.number().optional(),
              limit: z.coerce.number().optional(),
              active: z.coerce.boolean().optional(),
            })
            .optional(),
          use: [sessionMiddleware],
        },
        async (ctx) => {
          if (!ctx.context.session.user.id) {
            throw new APIError('BAD_REQUEST', {
              message: 'User not found',
            })
          }

          const principal = ctx.query?.organizationId
            ? await resolveBillingPrincipal({
                context: ctx.context,
                session: ctx.context.session,
                organizationId: ctx.query.organizationId,
                organizationEnabled:
                  rootOptions?.experimental_organizationSync?.enabled,
                authorization: 'member',
              })
            : undefined

          if (ctx.query?.organizationId && ctx.query.reference_id) {
            throw new APIError('BAD_REQUEST', {
              message: 'organizationId cannot be combined with reference_id',
            })
          }

          if (ctx.query?.reference_id) {
            const referenceId = ctx.query.reference_id
            const userId = ctx.context.session.user.id
            const { access, unauthorizedFallback } =
              await resolveReferenceAccess({
                context: ctx.context,
                session: ctx.context.session,
                referenceId,
                mapBetterAuthRoleToPolarRole:
                  rootOptions?.experimental_organizationSync
                    ?.mapBetterAuthRoleToPolarRole,
                authorizeReference: rootOptions?.authorizeReference,
                request: ctx.request,
              })

            if (access === 'none') {
              throw new APIError('FORBIDDEN', {
                message:
                  'Not allowed to list subscriptions for this reference_id',
              })
            }

            if (unauthorizedFallback && !warnedUnauthorizedReference) {
              warnedUnauthorizedReference = true
              ctx.context.logger.warn(
                'Polar: customer.subscriptions.list received a reference_id that is neither the signed-in user nor a Better Auth organization, so access to it could not be verified. Customer billing details were removed from the response. Set `authorizeReference` on polar() to authorize your own reference IDs: without it, the next major version returns only the subscriptions the signed-in user purchased.',
              )
            }

            try {
              const subscriptions: models.ListResourceSubscription =
                await listSubscriptions(polar)({
                  page: ctx.query?.page,
                  limit: ctx.query?.limit,
                  active: ctx.query?.active,
                  metadata: {
                    referenceId,
                  },
                  ...(access === 'purchased'
                    ? { external_customer_id: userId }
                    : {}),
                })

              const response: ListResourceReferenceSubscription =
                access === 'redacted'
                  ? {
                      ...subscriptions,
                      items: subscriptions.items.map((subscription) =>
                        subscription.customer.external_id === userId
                          ? subscription
                          : toEntitlementSubscription(
                              subscription,
                              referenceId,
                            ),
                      ),
                    }
                  : subscriptions

              return ctx.json(response)
            } catch (e: unknown) {
              if (e instanceof Error) {
                ctx.context.logger.error(
                  `Polar subscriptions list with reference_id failed. Error: ${e.message}`,
                )
              }

              throw new APIError('INTERNAL_SERVER_ERROR', {
                message: 'Subscriptions list with reference_id failed',
              })
            }
          }

          try {
            const customerSession = await createCustomerSessions(polar)({
              external_customer_id:
                principal?.externalCustomerId ?? ctx.context.session.user.id,
              ...(principal?.kind === 'team'
                ? { external_member_id: principal.externalMemberId }
                : {}),
            })

            const subscriptions: models.ListResourceCustomerSubscription =
              await listSubscriptionsCustomerPortal(polar)(
                {
                  page: ctx.query?.page,
                  limit: ctx.query?.limit,
                  active: ctx.query?.active,
                },
                { accessToken: customerSession.token },
              )

            return ctx.json(subscriptions)
          } catch (e: unknown) {
            if (e instanceof Error) {
              ctx.context.logger.error(
                `Polar subscriptions list failed. Error: ${e.message}`,
              )
            }

            throw new APIError('INTERNAL_SERVER_ERROR', {
              message: 'Polar subscriptions list failed',
            })
          }
        },
      ),
      orders: createAuthEndpoint(
        '/customer/orders/list',
        {
          method: 'GET',
          query: z
            .object({
              organizationId: z.string().min(1).optional(),
              page: z.coerce.number().optional(),
              limit: z.coerce.number().optional(),
              productBillingType: z.enum(['recurring', 'one_time']).optional(),
            })
            .optional(),
          use: [sessionMiddleware],
        },
        async (ctx) => {
          if (!ctx.context.session.user.id) {
            throw new APIError('BAD_REQUEST', {
              message: 'User not found',
            })
          }

          const principal = ctx.query?.organizationId
            ? await resolveBillingPrincipal({
                context: ctx.context,
                session: ctx.context.session,
                organizationId: ctx.query.organizationId,
                organizationEnabled:
                  rootOptions?.experimental_organizationSync?.enabled,
                authorization: 'member',
              })
            : undefined

          try {
            const customerSession = await createCustomerSessions(polar)({
              external_customer_id:
                principal?.externalCustomerId ?? ctx.context.session.user.id,
              ...(principal?.kind === 'team'
                ? { external_member_id: principal.externalMemberId }
                : {}),
            })

            const orders: models.ListResourceCustomerOrder =
              await listOrdersCustomerPortal(polar)(
                {
                  page: ctx.query?.page,
                  limit: ctx.query?.limit,
                  product_billing_type: ctx.query?.productBillingType,
                },
                { accessToken: customerSession.token },
              )

            return ctx.json(orders)
          } catch (e: unknown) {
            if (e instanceof Error) {
              ctx.context.logger.error(
                `Polar orders list failed. Error: ${e.message}`,
              )
            }

            throw new APIError('INTERNAL_SERVER_ERROR', {
              message: 'Orders list failed',
            })
          }
        },
      ),
    }
  }
