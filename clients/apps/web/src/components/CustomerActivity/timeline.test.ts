import { schemas } from '@polar-sh/client'
import { isValidElement } from 'react'
import { describe, expect, it } from 'vitest'
import { CustomerActivityTimelineEventIcon } from './CustomerActivityTimelineEventIcon'
import { CUSTOMER_ACTIVITY_TIMELINE, type TimelineEvent } from './event-config'
import { buildTimelineItems } from './timeline-builder'

const createEvent = ({
  id,
  name,
  timestamp,
  metadata = {},
  parentId,
}: {
  id: string
  name: schemas['SystemEvent']['name']
  timestamp: string
  metadata?: Record<string, unknown>
  parentId?: string
}): schemas['Event'] =>
  ({
    id,
    timestamp,
    organization_id: 'org-1',
    customer_id: 'customer-1',
    customer: null,
    external_customer_id: null,
    child_count: 0,
    label: name,
    source: 'system',
    name,
    metadata,
    parent_id: parentId,
  }) as unknown as schemas['Event']

describe('timeline constants', () => {
  it('includes customer and balance dispute events in the timeline allowlist', () => {
    const eventNames = Array.from(CUSTOMER_ACTIVITY_TIMELINE.EVENT_NAMES)

    expect(eventNames).toContain('customer.created')
    expect(eventNames).toContain('balance.dispute')
    expect(eventNames).toContain('balance.dispute_reversal')
  })
})

describe('buildTimelineItems', () => {
  it('groups consecutive events with the same name', () => {
    const items = buildTimelineItems({
      events: [
        createEvent({
          id: 'refund-1',
          name: 'order.refunded',
          timestamp: '2026-04-18T10:00:00Z',
        }),
        createEvent({
          id: 'refund-2',
          name: 'order.refunded',
          timestamp: '2026-04-18T09:00:00Z',
        }),
      ],
    })

    expect(items).toHaveLength(1)
    expect(items[0]?.kind).toBe('group')

    if (items[0]?.kind === 'group') {
      expect(items[0].items).toHaveLength(2)
    }
  })

  it('does not group matching events when they are not consecutive', () => {
    const items = buildTimelineItems({
      events: [
        createEvent({
          id: 'refund-1',
          name: 'order.refunded',
          timestamp: '2026-04-18T10:00:00Z',
        }),
        createEvent({
          id: 'voided-1',
          name: 'order.voided',
          timestamp: '2026-04-18T09:30:00Z',
        }),
        createEvent({
          id: 'refund-2',
          name: 'order.refunded',
          timestamp: '2026-04-18T09:00:00Z',
        }),
      ],
    })

    const groups = items.filter((item) => item.kind === 'group')
    expect(groups).toHaveLength(0)
  })

  it('groups subscription renewals only when paid status matches', () => {
    const items = buildTimelineItems({
      events: [
        createEvent({
          id: 'renewal-paid-1',
          name: 'subscription.cycled',
          timestamp: '2026-04-18T10:00:00Z',
          metadata: { subscription_id: 'sub-a', product_id: 'product-1' },
        }),
        createEvent({
          id: 'renewal-paid-2',
          name: 'subscription.cycled',
          timestamp: '2026-04-18T09:00:00Z',
          metadata: { subscription_id: 'sub-b', product_id: 'product-2' },
        }),
        createEvent({
          id: 'renewal-unpaid-1',
          name: 'subscription.cycled',
          timestamp: '2026-04-18T08:00:00Z',
          metadata: { subscription_id: 'sub-a', product_id: 'product-1' },
        }),
        createEvent({
          id: 'renewal-unpaid-2',
          name: 'subscription.cycled',
          timestamp: '2026-04-18T07:00:00Z',
          metadata: { subscription_id: 'sub-a', product_id: 'product-1' },
        }),
        createEvent({
          id: 'paid-1',
          name: 'order.paid',
          timestamp: '2026-04-18T06:00:00Z',
          parentId: 'renewal-paid-1',
        }),
        createEvent({
          id: 'paid-2',
          name: 'order.paid',
          timestamp: '2026-04-18T05:00:00Z',
          parentId: 'renewal-paid-2',
        }),
      ],
    })

    const renewalGroups = items.filter((item) => {
      return item.kind === 'group' && item.title.includes('renewed')
    })

    expect(renewalGroups).toHaveLength(2)

    if (renewalGroups[0]?.kind === 'group') {
      expect(renewalGroups[0].items).toHaveLength(2)
      expect(renewalGroups[0].title).toContain('2 subscriptions renewed')
      expect(renewalGroups[0].title).not.toContain('(not paid)')
    }

    if (renewalGroups[1]?.kind === 'group') {
      expect(renewalGroups[1].items).toHaveLength(2)
      expect(renewalGroups[1].title).toContain('(not paid)')
    }
  })

  it('marks only unpaid subscription start events and keeps standalone order.paid entries', () => {
    const items = buildTimelineItems({
      events: [
        createEvent({
          id: 'started-paid',
          name: 'subscription.created',
          timestamp: '2026-04-18T10:00:00Z',
          metadata: { subscription_id: 'sub-a', product_id: 'product-1' },
        }),
        createEvent({
          id: 'started-unpaid',
          name: 'subscription.created',
          timestamp: '2026-04-18T09:00:00Z',
          metadata: { subscription_id: 'sub-b', product_id: 'product-2' },
        }),
        createEvent({
          id: 'paid-order',
          name: 'order.paid',
          timestamp: '2026-04-18T08:00:00Z',
          metadata: { subscription_id: 'sub-a', billing_type: 'recurring' },
        }),
        createEvent({
          id: 'standalone-paid-order',
          name: 'order.paid',
          timestamp: '2026-04-18T07:00:00Z',
          metadata: { billing_type: 'one_time' },
        }),
      ],
    })

    const paidStartedEvent = items.find(
      (item) => item.kind === 'event' && item.id === 'started-paid',
    )
    const unpaidStartedEvent = items.find(
      (item) => item.kind === 'event' && item.id === 'started-unpaid',
    )

    expect(paidStartedEvent?.kind).toBe('event')
    expect(unpaidStartedEvent?.kind).toBe('event')

    if (paidStartedEvent?.kind === 'event') {
      expect(paidStartedEvent.description).toBeUndefined()
    }

    if (unpaidStartedEvent?.kind === 'event') {
      expect(unpaidStartedEvent.description).toBe('Not paid')
    }

    expect(items.some((item) => item.id === 'paid-order')).toBe(false)
    expect(items.some((item) => item.id === 'standalone-paid-order')).toBe(true)
  })
})

describe('timeline icon tones', () => {
  it('uses danger tone classes for subscription.canceled and order.refunded', () => {
    ;(['subscription.canceled', 'order.refunded'] as const).forEach((name) => {
      const icon = CustomerActivityTimelineEventIcon({
        event: {
          event: createEvent({
            id: `${name}-id`,
            name,
            timestamp: '2026-04-18T10:00:00Z',
          }) as TimelineEvent,
          parentEvent: null,
          isLinkedOrderPaid: false,
          subscriptionPaymentStatus: null,
        },
      })

      expect(isValidElement(icon)).toBe(true)

      if (isValidElement<{ className?: string }>(icon)) {
        expect(icon.props.className).toContain('bg-rose-100')
      }
    })
  })

  it('uses positive tone when seats increase and warning tone when seats decrease', () => {
    const increasedSeatsIcon = CustomerActivityTimelineEventIcon({
      event: {
        event: createEvent({
          id: 'seats-increase-id',
          name: 'subscription.seats_updated',
          timestamp: '2026-04-18T10:00:00Z',
          metadata: { old_seats: 2, new_seats: 5 },
        }) as TimelineEvent,
        parentEvent: null,
        isLinkedOrderPaid: false,
        subscriptionPaymentStatus: null,
      },
    })

    const decreasedSeatsIcon = CustomerActivityTimelineEventIcon({
      event: {
        event: createEvent({
          id: 'seats-decrease-id',
          name: 'subscription.seats_updated',
          timestamp: '2026-04-18T09:00:00Z',
          metadata: { old_seats: 5, new_seats: 2 },
        }) as TimelineEvent,
        parentEvent: null,
        isLinkedOrderPaid: false,
        subscriptionPaymentStatus: null,
      },
    })

    expect(isValidElement(increasedSeatsIcon)).toBe(true)
    expect(isValidElement(decreasedSeatsIcon)).toBe(true)

    if (isValidElement<{ className?: string }>(increasedSeatsIcon)) {
      expect(increasedSeatsIcon.props.className).toContain('bg-emerald-100')
    }

    if (isValidElement<{ className?: string }>(decreasedSeatsIcon)) {
      expect(decreasedSeatsIcon.props.className).toContain('bg-amber-100')
    }
  })
})
