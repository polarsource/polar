import { useCustomerSubscriptionMeterChargePreview } from '@/hooks/queries/customerPortal'
import { Client, schemas } from '@polar-sh/client'
import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { UpcomingUsageCharge } from './UpcomingUsageCharge'

vi.mock('@/hooks/queries/customerPortal', () => ({
  useCustomerSubscriptionMeterChargePreview: vi.fn(),
}))

const subscription = (amount: number) =>
  ({
    id: 'subscription-1',
    status: 'active',
    currency: 'usd',
    current_period_end: '2027-01-01T00:00:00Z',
    current_meter_period_end: '2026-11-01T00:00:00Z',
    meters: [
      { id: 'meter-1', amount, meter: { id: 'meter', name: 'API requests' } },
    ],
  }) as unknown as schemas['CustomerSubscription']

describe('UpcomingUsageCharge', () => {
  it('shows the usage charge with its discount', () => {
    vi.mocked(useCustomerSubscriptionMeterChargePreview).mockReturnValue({
      data: {
        metered_amount: 1840,
        subtotal_amount: 1840,
        discount_amount: 460,
        net_amount: 1380,
        tax_amount: 0,
        total_amount: 1380,
      },
    } as unknown as ReturnType<
      typeof useCustomerSubscriptionMeterChargePreview
    >)

    const { container } = render(
      <UpcomingUsageCharge
        subscription={subscription(1840)}
        api={{} as Client}
      />,
    )

    const text = container.textContent ?? ''
    expect(text).toContain('Upcoming Usage Charge')
    expect(text).toContain('API requests')
    expect(text).toMatch(/Discount\s*-\$4\.60/)
    expect(text).toMatch(/Estimated Total\s*\$13\.80/)
  })

  it('renders nothing without overage', () => {
    const { container } = render(
      <UpcomingUsageCharge subscription={subscription(0)} api={{} as Client} />,
    )

    expect(container.textContent).toBe('')
    expect(useCustomerSubscriptionMeterChargePreview).toHaveBeenLastCalledWith(
      {},
      'subscription-1',
      false,
    )
  })
})
