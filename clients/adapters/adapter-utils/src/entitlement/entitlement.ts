import type { Customer } from '@polar-sh/sdk/models/components/customer'
import type { WebhookBenefitGrantCreatedPayload } from '@polar-sh/sdk/models/components/webhookbenefitgrantcreatedpayload'
import type { WebhookBenefitGrantRevokedPayload } from '@polar-sh/sdk/models/components/webhookbenefitgrantrevokedpayload'
import type { WebhookBenefitGrantUpdatedPayload } from '@polar-sh/sdk/models/components/webhookbenefitgrantupdatedpayload'

export type EntitlementProperties = Record<string, string>

export type EntitlementHandler = (
  payload:
    | WebhookBenefitGrantCreatedPayload
    | WebhookBenefitGrantUpdatedPayload
    | WebhookBenefitGrantRevokedPayload,
) => Promise<void>

export interface EntitlementContext<T extends EntitlementProperties> {
  customer: Customer
  properties: T
  payload:
    | WebhookBenefitGrantCreatedPayload
    | WebhookBenefitGrantUpdatedPayload
    | WebhookBenefitGrantRevokedPayload
}

export class EntitlementStrategy<T extends EntitlementProperties> {
  private grantCallbacks: ((
    context: EntitlementContext<T>,
  ) => Promise<void>)[] = []

  private revokeCallbacks: ((
    context: EntitlementContext<T>,
  ) => Promise<void>)[] = []

  public grant(callback: (context: EntitlementContext<T>) => Promise<void>) {
    this.grantCallbacks.push(callback)
    return this
  }

  public revoke(callback: (context: EntitlementContext<T>) => Promise<void>) {
    this.revokeCallbacks.push(callback)
    return this
  }

  public handler(slug: string): EntitlementHandler {
    return async (
      payload:
        | WebhookBenefitGrantCreatedPayload
        | WebhookBenefitGrantUpdatedPayload
        | WebhookBenefitGrantRevokedPayload,
    ) => {
      if (payload.data.benefit.description === slug) {
        switch (payload.type) {
          case 'benefit_grant.created':
          case 'benefit_grant.updated':
            await Promise.all(
              this.grantCallbacks.map((callback) =>
                callback({
                  customer: payload.data.customer,
                  properties: payload.data.properties as T,
                  payload,
                }),
              ),
            )
            break
          case 'benefit_grant.revoked':
            await Promise.all(
              this.revokeCallbacks.map((callback) =>
                callback({
                  customer: payload.data.customer,
                  properties: payload.data.properties as T,
                  payload,
                }),
              ),
            )
            break
        }
      }
    }
  }
}

export class Entitlements {
  static handlers = [] as EntitlementHandler[]

  static use<T extends EntitlementProperties = EntitlementProperties>(
    slug: string,
    strategy: EntitlementStrategy<T>,
  ) {
    this.handlers.push(strategy.handler(slug))

    return this
  }
}
