import {
  handleWebhookPayload,
  type WebhooksConfig,
} from '@polar-sh/adapter-utils'
import { type Polar, webhooks as sdkWebhooks } from '@polar-sh/sdk/2026-04'
import { APIError, createAuthEndpoint } from 'better-auth/api'
import { DEFAULT_BETTER_AUTH_CREATOR_ROLE } from '../organization/roles'
import {
  MANAGED_SUBSCRIPTION_STATUSES,
  getBetterAuthOrganizationOptions,
  getOrganizationRoster,
  synchronizeOrganizationSeats,
} from '../organization/seats'
import { ensureMemberMirror } from '../organization/sync'
import type { PolarOptions } from '../types'

type WebhookRootOptions = Pick<PolarOptions, 'experimental_organizationSync'>

export interface WebhooksOptions extends Omit<
  WebhooksConfig,
  'webhookSecret' | 'entitlements'
> {
  /**
   * Webhook Secret
   */
  secret: string
}

export const webhooks =
  (options: WebhooksOptions) =>
  (polar: Polar, rootOptions?: WebhookRootOptions) => {
    return {
      polarWebhooks: createAuthEndpoint(
        '/polar/webhooks',
        {
          method: 'POST',
          metadata: {
            isAction: false,
          },
          cloneRequest: true,
        },
        async (ctx) => {
          const { secret, ...eventHandlers } = options

          if (!ctx.request?.body) {
            throw new APIError('INTERNAL_SERVER_ERROR')
          }
          if (!secret) {
            throw new APIError('INTERNAL_SERVER_ERROR', {
              message: 'Polar webhook secret not found',
            })
          }

          const buf = await ctx.request.text()
          let event: sdkWebhooks.WebhookPayload
          try {
            const headers = {
              'webhook-id': ctx.request.headers.get('webhook-id') as string,
              'webhook-timestamp': ctx.request.headers.get(
                'webhook-timestamp',
              ) as string,
              'webhook-signature': ctx.request.headers.get(
                'webhook-signature',
              ) as string,
            }

            event = await sdkWebhooks.validateEvent(buf, headers, secret)
          } catch (err: unknown) {
            if (err instanceof sdkWebhooks.PolarWebhookUnknownTypeError) {
              return ctx.json({ received: true })
            }
            if (err instanceof Error) {
              ctx.context.logger.error(`${err.message}`)
            }
            if (err instanceof sdkWebhooks.PolarWebhookVerificationError) {
              throw new APIError('FORBIDDEN', {
                message: `Webhook Error: ${err.message}`,
              })
            }
            if (err instanceof sdkWebhooks.PolarWebhookError) {
              throw new APIError('BAD_REQUEST', {
                message: `Webhook Error: ${err.message}`,
              })
            }
            throw new APIError('BAD_REQUEST', {
              message: `Webhook Error: ${err}`,
            })
          }

          try {
            const organizationOptions =
              rootOptions?.experimental_organizationSync
            if (
              organizationOptions?.enabled &&
              organizationOptions.syncSeats &&
              (event.type === 'subscription.created' ||
                event.type === 'subscription.active') &&
              event.data.customer.type === 'team' &&
              event.data.customer.external_id &&
              event.data.seats != null &&
              MANAGED_SUBSCRIPTION_STATUSES.has(event.data.status)
            ) {
              const organizationId = event.data.customer.external_id
              const organization = await ctx.context.adapter.findOne({
                model: 'organization',
                where: [{ field: 'id', value: organizationId }],
              })
              if (organization) {
                const subscription = await polar.subscriptions.get(
                  event.data.id,
                )
                if (
                  subscription.customer.type === 'team' &&
                  subscription.customer.external_id === organizationId &&
                  subscription.seats != null &&
                  MANAGED_SUBSCRIPTION_STATUSES.has(subscription.status)
                ) {
                  const betterAuthOrganizationOptions =
                    getBetterAuthOrganizationOptions(ctx.context)
                  const roster = await getOrganizationRoster(
                    ctx.context,
                    betterAuthOrganizationOptions,
                    organizationId,
                  )
                  const roleOptions = {
                    creatorRole:
                      betterAuthOrganizationOptions.creatorRole ??
                      DEFAULT_BETTER_AUTH_CREATOR_ROLE,
                    mapBetterAuthRoleToPolarRole:
                      organizationOptions.mapBetterAuthRoleToPolarRole,
                  }
                  for (const member of roster) {
                    await ensureMemberMirror(polar, roleOptions, {
                      organizationId,
                      user: member.user,
                      betterAuthRole: member.role,
                    })
                  }
                  await synchronizeOrganizationSeats({
                    authContext: ctx.context,
                    client: polar,
                    organizationId,
                    organizationOptions,
                    betterAuthOrganizationOptions,
                    subscriptions: [subscription],
                  })
                }
              }
            }

            await handleWebhookPayload(event, {
              webhookSecret: secret,
              ...eventHandlers,
            })
          } catch (e: unknown) {
            if (e instanceof Error) {
              ctx.context.logger.error(
                `Polar webhook failed. Error: ${e.message}`,
              )
            } else {
              ctx.context.logger.error(`Polar webhook failed. Error: ${e}`)
            }

            throw new APIError('INTERNAL_SERVER_ERROR', {
              message: 'Webhook error: See server logs for more information.',
            })
          }

          return ctx.json({ received: true })
        },
      ),
    }
  }
