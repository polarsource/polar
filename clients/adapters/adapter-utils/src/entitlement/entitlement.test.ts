import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { models, webhooks } from '@polar-sh/sdk/2026-04'
import { Entitlements, EntitlementStrategy } from './entitlement'
import { handleWebhookPayload } from '../webhooks/webhooks'

describe('EntitlementStrategy', () => {
  it('should run grant on handler', () => {
    const onGrant = vi.fn()
    const onRevoke = vi.fn()

    const entitlement = new EntitlementStrategy<{ test: string }>().grant(
      onGrant,
    )

    expect(entitlement).toBeDefined()

    const payload = {
      type: 'benefit_grant.created',
      timestamp: new Date().toISOString(),
      data: {
        id: '123',
        created_at: new Date().toISOString(),
        modified_at: new Date().toISOString(),
        is_granted: true,
        benefit_id: '123',
        customer_id: '123',
        subscription_id: '123',
        order_id: '123',
        user_id: '123',
        is_revoked: false,
        properties: { test: 'test' },
        customer: {
          email: 'test@test.com',
          id: '123',
          created_at: new Date().toISOString(),
          modified_at: new Date().toISOString(),
          deleted_at: null,
          metadata: {},
          email_verified: true,
          billing_address: {
            line1: '123',
            line2: '123',
            city: '123',
            state: '123',
            postal_code: '123',
            country: 'US',
          },
          name: 'Test',
          tax_id: ['123'],
          organization_id: '123',
          avatar_url: '123',
        },
        benefit: {
          id: '123',
          created_at: new Date().toISOString(),
          modified_at: new Date().toISOString(),
          selectable: true,
          description: 'test',
        } as unknown as models.Benefit,
      },
    } as unknown as webhooks.WebhookBenefitGrantCreatedPayload

    entitlement.handler('test')(payload)

    expect(onGrant).toHaveBeenCalledWith({
      payload,
      customer: payload.data.customer,
      properties: payload.data.properties,
    })

    expect(onRevoke).not.toHaveBeenCalled()
  })

  it('should run revoke on handler', () => {
    const onGrant = vi.fn()
    const onRevoke = vi.fn()

    const entitlement = new EntitlementStrategy<{ test: string }>()
      .grant(onGrant)
      .revoke(onRevoke)

    const payload = {
      type: 'benefit_grant.revoked',
      timestamp: new Date().toISOString(),
      data: {
        id: '123',
        created_at: new Date().toISOString(),
        modified_at: new Date().toISOString(),
        is_granted: false,
        benefit_id: '123',
        customer_id: '123',
        benefit: { description: 'test' },
      },
    } as unknown as webhooks.WebhookBenefitGrantRevokedPayload

    entitlement.handler('test')(payload)

    expect(onGrant).not.toHaveBeenCalled()

    expect(onRevoke).toHaveBeenCalledWith({
      payload,
      customer: payload.data.customer,
      properties: payload.data.properties,
    })
  })
})

const buildGrantPayload = (slug: string) =>
  ({
    type: 'benefit_grant.created',
    data: {
      customer: {},
      benefit: { description: slug, properties: {} },
      properties: {},
    },
  }) as unknown as webhooks.WebhookBenefitGrantCreatedPayload

const buildRevokePayload = (slug: string) =>
  ({
    type: 'benefit_grant.revoked',
    data: {
      customer: {},
      benefit: { description: slug },
    },
  }) as unknown as webhooks.WebhookBenefitGrantRevokedPayload

describe('Entitlements static registry', () => {
  beforeEach(() => {
    Entitlements.handlers.clear()
  })

  it('fires the grant callback exactly once per webhook after repeated use calls', async () => {
    const onGrant = vi.fn()
    const strategy = new EntitlementStrategy().grant(onGrant)

    Entitlements.use('slug-a', strategy)
    Entitlements.use('slug-a', strategy)
    Entitlements.use('slug-a', strategy)

    await handleWebhookPayload(buildGrantPayload('slug-a'), {
      webhookSecret: 'test',
      entitlements: Entitlements,
    })

    expect(onGrant).toHaveBeenCalledTimes(1)
  })

  it('fires the revoke callback exactly once per webhook after repeated use calls', async () => {
    const onRevoke = vi.fn()
    const strategy = new EntitlementStrategy().revoke(onRevoke)

    Entitlements.use('slug-a', strategy)
    Entitlements.use('slug-a', strategy)

    await handleWebhookPayload(buildRevokePayload('slug-a'), {
      webhookSecret: 'test',
      entitlements: Entitlements,
    })

    expect(onRevoke).toHaveBeenCalledTimes(1)
  })

  it('overwrites the handler when use is called again with the same slug', async () => {
    const onGrantA = vi.fn()
    const onGrantB = vi.fn()

    Entitlements.use('slug-a', new EntitlementStrategy().grant(onGrantA))
    Entitlements.use('slug-a', new EntitlementStrategy().grant(onGrantB))

    expect(Entitlements.handlers.size).toBe(1)

    await handleWebhookPayload(buildGrantPayload('slug-a'), {
      webhookSecret: 'test',
      entitlements: Entitlements,
    })

    expect(onGrantA).not.toHaveBeenCalled()
    expect(onGrantB).toHaveBeenCalledTimes(1)
  })

  it('registers and dispatches distinct handlers for distinct slugs', async () => {
    const onGrantA = vi.fn()
    const onGrantB = vi.fn()

    Entitlements.use('slug-a', new EntitlementStrategy().grant(onGrantA))
    Entitlements.use('slug-b', new EntitlementStrategy().grant(onGrantB))

    expect(Entitlements.handlers.size).toBe(2)

    await handleWebhookPayload(buildGrantPayload('slug-a'), {
      webhookSecret: 'test',
      entitlements: Entitlements,
    })

    expect(onGrantA).toHaveBeenCalledTimes(1)
    expect(onGrantB).not.toHaveBeenCalled()

    await handleWebhookPayload(buildGrantPayload('slug-b'), {
      webhookSecret: 'test',
      entitlements: Entitlements,
    })

    expect(onGrantA).toHaveBeenCalledTimes(1)
    expect(onGrantB).toHaveBeenCalledTimes(1)
  })
})
