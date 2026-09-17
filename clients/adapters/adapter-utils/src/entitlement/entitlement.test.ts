import { describe, it, expect, vi } from 'vitest'
import type { models, webhooks } from '@polar-sh/sdk/2026-04'
import { EntitlementStrategy } from './entitlement'

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
