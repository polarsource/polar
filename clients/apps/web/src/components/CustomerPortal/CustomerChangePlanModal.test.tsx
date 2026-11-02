import {
  useCustomerPaymentMethods,
  useCustomerSubscriptionChangePreview,
  useCustomerUpdateSubscription,
} from '@/hooks/queries/customerPortal'
import { Client, schemas } from '@polar-sh/client'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CustomerChangePlanModal from './CustomerChangePlanModal'

vi.mock('@/hooks/queries/customerPortal', () => ({
  useCustomerPaymentMethods: vi.fn(),
  useCustomerSubscriptionChangePreview: vi.fn(),
  useCustomerUpdateSubscription: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))

vi.mock('../Products/ProductPriceLabel', () => ({
  default: () => null,
}))

const currentProduct = {
  id: 'product-monthly',
  name: 'Monthly',
  is_recurring: true,
  recurring_interval: 'month',
  recurring_interval_count: 1,
  benefits: [],
  prices: [{ amount_type: 'fixed', price_amount: 1000 }],
} as unknown as schemas['CustomerProduct']

const seatOnlyYearlyProduct = {
  id: 'product-seats-yearly',
  name: 'Team Yearly',
  is_recurring: true,
  recurring_interval: 'year',
  recurring_interval_count: 1,
  benefits: [],
  prices: [{ amount_type: 'seat_based' }],
} as unknown as schemas['CustomerProduct']

const subscription = {
  id: 'subscription-1',
  status: 'active',
  currency: 'usd',
  amount: 1000,
  product_id: currentProduct.id,
  product: currentProduct,
  recurring_interval: 'month',
  recurring_interval_count: 1,
} as unknown as schemas['CustomerSubscription']

const organization = {
  proration_behavior: 'invoice',
} as unknown as schemas['CustomerOrganization']

const mockPreview = (
  preview: { total_amount: number; due_amount: number } | undefined,
  state: { isFetching?: boolean; isError?: boolean } = {},
) =>
  vi.mocked(useCustomerSubscriptionChangePreview).mockReturnValue({
    data: preview,
    isFetching: state.isFetching ?? false,
    isError: state.isError ?? false,
  } as unknown as ReturnType<typeof useCustomerSubscriptionChangePreview>)

const immediateCycleNotice =
  /charged immediately|credit on your next invoice|from your balance/

const renderAndSelectSeatPlan = () => {
  render(
    <CustomerChangePlanModal
      api={{} as Client}
      organization={organization}
      products={[currentProduct, seatOnlyYearlyProduct]}
      subscription={subscription}
      hide={vi.fn()}
      onUserSubscriptionUpdate={vi.fn()}
    />,
  )
  fireEvent.click(screen.getByText('Team Yearly'))
}

describe('CustomerChangePlanModal', () => {
  beforeEach(() => {
    vi.mocked(useCustomerPaymentMethods).mockReturnValue({
      data: { items: [{}] },
    } as unknown as ReturnType<typeof useCustomerPaymentMethods>)
    vi.mocked(useCustomerUpdateSubscription).mockReturnValue({
      isPending: false,
    } as unknown as ReturnType<typeof useCustomerUpdateSubscription>)
  })

  it('shows an immediate charge for a seat-only plan the server charges for', () => {
    mockPreview({ total_amount: 12000, due_amount: 12000 })

    renderAndSelectSeatPlan()

    expect(useCustomerSubscriptionChangePreview).toHaveBeenLastCalledWith(
      {},
      'subscription-1',
      'product-seats-yearly',
      true,
    )
    expect(
      screen.getByText(
        "You'll be charged immediately for the new yearly plan.",
      ),
    ).toBeTruthy()
  })

  it('shows a credit when the server previews a net credit', () => {
    mockPreview({ total_amount: -500, due_amount: 0 })

    renderAndSelectSeatPlan()

    expect(
      screen.getByText(
        'Your previous payment will appear as a credit on your next invoice.',
      ),
    ).toBeTruthy()
  })

  it('shows the balance message when the balance covers the charge', () => {
    mockPreview({ total_amount: 12000, due_amount: 0 })

    renderAndSelectSeatPlan()

    expect(
      screen.getByText('The new yearly plan will be paid from your balance.'),
    ).toBeTruthy()
  })

  it.each([
    ['loading', undefined, {}],
    [
      'refetching',
      { total_amount: 12000, due_amount: 12000 },
      { isFetching: true },
    ],
    ['failed', { total_amount: 12000, due_amount: 12000 }, { isError: true }],
  ])(
    'shows no immediate-cycle notice while the preview is %s',
    (_, preview, state) => {
      mockPreview(preview, state)

      renderAndSelectSeatPlan()

      expect(screen.queryByText(immediateCycleNotice)).toBeNull()
    },
  )
})
