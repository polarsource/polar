import type { models, Polar } from '@polar-sh/sdk/2026-04'
import { APIError } from 'better-auth/api'
import { createAuthEndpoint, sessionMiddleware } from 'better-auth/api'
import * as z from 'zod/v4'
import { resolveBillingPrincipal } from '../principal'
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
    polar: Polar,
    rootOptions?: Pick<PolarOptions, 'experimental_organizationSync'>,
  ) => {
    const retUrl = returnUrl ? new URL(returnUrl) : undefined

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
            const customerSession = await polar.customerSessions.create({
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
            const state: models.CustomerState =
              await polar.customers.getStateExternal(
                principal?.externalCustomerId ?? ctx.context.session.user.id,
              )

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
            const customerSession = await polar.customerSessions.create({
              external_customer_id:
                principal?.externalCustomerId ?? ctx.context.session.user.id,
              ...(principal?.kind === 'team'
                ? { external_member_id: principal.externalMemberId }
                : {}),
            })

            const benefits: models.ListResourceCustomerBenefitGrant =
              await polar.customerPortal.benefitGrants.list(
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
              referenceId: z.string().optional(),
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

          if (ctx.query?.organizationId && ctx.query.referenceId) {
            throw new APIError('BAD_REQUEST', {
              message: 'organizationId cannot be combined with referenceId',
            })
          }

          if (ctx.query?.referenceId) {
            try {
              const subscriptions: models.ListResourceSubscription =
                await polar.subscriptions.list({
                  page: ctx.query?.page,
                  limit: ctx.query?.limit,
                  active: ctx.query?.active,
                  metadata: {
                    referenceId: ctx.query?.referenceId,
                  },
                })

              return ctx.json(subscriptions)
            } catch (e: unknown) {
              console.log(e)
              if (e instanceof Error) {
                ctx.context.logger.error(
                  `Polar subscriptions list with referenceId failed. Error: ${e.message}`,
                )
              }

              throw new APIError('INTERNAL_SERVER_ERROR', {
                message: 'Subscriptions list with referenceId failed',
              })
            }
          }

          try {
            const customerSession = await polar.customerSessions.create({
              external_customer_id:
                principal?.externalCustomerId ?? ctx.context.session.user.id,
              ...(principal?.kind === 'team'
                ? { external_member_id: principal.externalMemberId }
                : {}),
            })

            const subscriptions: models.ListResourceCustomerSubscription =
              await polar.customerPortal.subscriptions.list(
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
            const customerSession = await polar.customerSessions.create({
              external_customer_id:
                principal?.externalCustomerId ?? ctx.context.session.user.id,
              ...(principal?.kind === 'team'
                ? { external_member_id: principal.externalMemberId }
                : {}),
            })

            const orders: models.ListResourceCustomerOrder =
              await polar.customerPortal.orders.list(
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
