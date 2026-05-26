import { schemas } from '@polar-sh/client'
import { describe, expect, it } from 'vitest'
import { groupBenefitGrants } from './groupBenefitGrants'

type Grant = schemas['CustomerBenefitGrant']

let nextId = 0
const uid = (prefix: string): string => {
  nextId += 1
  return `${prefix}-${nextId}`
}

const subscriptionSummary = (
  id: string,
  product_name: string,
): schemas['CustomerBenefitGrantSubscriptionSummary'] => ({ id, product_name })

const grant = ({
  benefitId,
  type = 'downloadables',
  subscriptionId,
  productName,
  orderId,
  grantedAt = '2024-01-01T00:00:00Z',
  id = uid('grant'),
}: {
  benefitId: string
  type?: schemas['BenefitType']
  subscriptionId?: string
  productName?: string
  orderId?: string
  grantedAt?: string
  id?: string
}): Grant => {
  // The discriminator on CustomerBenefitGrant is `benefit.type`; the test
  // only exercises the fields the grouping helper reads, so the rest of
  // the payload is a best-effort cast.
  return {
    id,
    created_at: grantedAt,
    modified_at: grantedAt,
    granted_at: grantedAt,
    revoked_at: null,
    customer_id: 'customer-1',
    benefit_id: benefitId,
    subscription_id: subscriptionId ?? null,
    order_id: orderId ?? null,
    subscription:
      subscriptionId && productName
        ? subscriptionSummary(subscriptionId, productName)
        : null,
    order:
      orderId && productName
        ? { id: orderId, product_name: productName }
        : null,
    is_granted: true,
    is_revoked: false,
    benefit: { type } as Grant['benefit'],
    properties: {} as Grant['properties'],
    customer: {} as Grant['customer'],
  } as Grant
}

describe('groupBenefitGrants', () => {
  it('puts a single-subscription downloadable under that subscription', () => {
    const g = grant({
      benefitId: 'b1',
      subscriptionId: 's1',
      productName: 'Pro Plan',
    })
    const result = groupBenefitGrants([g])
    expect(result.shared).toEqual([])
    expect(result.bySubscription).toHaveLength(1)
    expect(result.bySubscription[0].subscription.product_name).toBe('Pro Plan')
    expect(result.bySubscription[0].grants).toEqual([g])
  })

  it('puts an order-only grant in the shared bucket', () => {
    const g = grant({
      benefitId: 'b1',
      orderId: 'o1',
      productName: 'One-time Pack',
    })
    const result = groupBenefitGrants([g])
    expect(result.shared).toEqual([g])
    expect(result.bySubscription).toEqual([])
  })

  it('collapses the same downloadable benefit granted by two subscriptions into the shared bucket', () => {
    const benefitId = 'b1'
    const g1 = grant({
      benefitId,
      subscriptionId: 's1',
      productName: 'Pro',
      grantedAt: '2024-01-01T00:00:00Z',
    })
    const g2 = grant({
      benefitId,
      subscriptionId: 's2',
      productName: 'Team',
      grantedAt: '2024-06-01T00:00:00Z',
    })
    const result = groupBenefitGrants([g1, g2])
    expect(result.bySubscription).toEqual([])
    expect(result.shared).toHaveLength(1)
    // The most-recent grant wins as the renderable.
    expect(result.shared[0].id).toBe(g2.id)
  })

  it('collapses two grants from the same subscription into one card under that subscription', () => {
    const benefitId = 'b1'
    const g1 = grant({
      benefitId,
      subscriptionId: 's1',
      productName: 'Pro',
      grantedAt: '2024-01-01T00:00:00Z',
    })
    const g2 = grant({
      benefitId,
      subscriptionId: 's1',
      productName: 'Pro',
      grantedAt: '2024-06-01T00:00:00Z',
    })
    const result = groupBenefitGrants([g1, g2])
    expect(result.shared).toEqual([])
    expect(result.bySubscription).toHaveLength(1)
    expect(result.bySubscription[0].grants).toHaveLength(1)
    expect(result.bySubscription[0].grants[0].id).toBe(g2.id)
  })

  it('does not dedup license_keys: two grants by the same subscription become two cards', () => {
    const g1 = grant({
      benefitId: 'b1',
      type: 'license_keys',
      subscriptionId: 's1',
      productName: 'Pro',
    })
    const g2 = grant({
      benefitId: 'b1',
      type: 'license_keys',
      subscriptionId: 's1',
      productName: 'Pro',
    })
    const result = groupBenefitGrants([g1, g2])
    expect(result.bySubscription).toHaveLength(1)
    expect(result.bySubscription[0].grants).toHaveLength(2)
  })

  it('does not dedup discord grants across subscriptions: one card per subscription', () => {
    const g1 = grant({
      benefitId: 'b1',
      type: 'discord',
      subscriptionId: 's1',
      productName: 'Pro',
    })
    const g2 = grant({
      benefitId: 'b1',
      type: 'discord',
      subscriptionId: 's2',
      productName: 'Team',
    })
    const result = groupBenefitGrants([g1, g2])
    expect(result.shared).toEqual([])
    expect(result.bySubscription).toHaveLength(2)
    expect(result.bySubscription.flatMap((b) => b.grants)).toHaveLength(2)
  })

  it('keeps meter_credit grants distinct (stack-relevant)', () => {
    const g1 = grant({
      benefitId: 'b1',
      type: 'meter_credit',
      subscriptionId: 's1',
      productName: 'Pro',
    })
    const g2 = grant({
      benefitId: 'b1',
      type: 'meter_credit',
      subscriptionId: 's1',
      productName: 'Pro',
    })
    const result = groupBenefitGrants([g1, g2])
    expect(result.bySubscription).toHaveLength(1)
    expect(result.bySubscription[0].grants).toHaveLength(2)
  })

  it('sorts subscription buckets alphabetically by product name', () => {
    const grants = [
      grant({
        benefitId: 'b-z',
        subscriptionId: 's-z',
        productName: 'Zeta',
      }),
      grant({
        benefitId: 'b-a',
        subscriptionId: 's-a',
        productName: 'Alpha',
      }),
      grant({
        benefitId: 'b-m',
        subscriptionId: 's-m',
        productName: 'Mid',
      }),
    ]
    const result = groupBenefitGrants(grants)
    expect(
      result.bySubscription.map((b) => b.subscription.product_name),
    ).toEqual(['Alpha', 'Mid', 'Zeta'])
  })
})
