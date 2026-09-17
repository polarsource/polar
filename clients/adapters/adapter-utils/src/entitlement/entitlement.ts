import type { models, webhooks } from '@polar-sh/sdk/2026-04'

export type EntitlementProperties = Record<string, string>

type EntitlementPayload =
  | webhooks.WebhookBenefitGrantCreatedPayload
  | webhooks.WebhookBenefitGrantRevokedPayload

export type EntitlementHandler = (payload: EntitlementPayload) => Promise<void>

export interface EntitlementContext<T extends EntitlementProperties> {
  customer: models.Customer
  properties: T
  payload: EntitlementPayload
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
    return async (payload: EntitlementPayload) => {
      if (payload.data.benefit.description === slug) {
        switch (payload.type) {
          case 'benefit_grant.created':
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
