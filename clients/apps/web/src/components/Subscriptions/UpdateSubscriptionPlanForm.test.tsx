import { useDiscount } from '@/hooks/queries'
import { schemas } from '@polar-sh/client'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { UpdateSubscriptionPlanForm } from './UpdateSubscriptionPlanForm'

const mutateAsync = vi.fn()

vi.mock('@/hooks/queries', () => ({
  useProduct: () => ({ data: undefined }),
  useDiscount: vi.fn(),
}))

vi.mock('@/hooks/queries/subscriptions', () => ({
  useUpdateSubscription: () => ({ mutateAsync, isPending: false }),
}))

vi.mock('@/utils/trial-change', () => ({
  useTrialChangeOutcome: () => null,
}))

vi.mock('../Products/ProductCombobox', () => ({
  ProductCombobox: ({ onChange }: { onChange: (id: string) => void }) => (
    <button type="button" onClick={() => onChange('product-2')}>
      Pick product
    </button>
  ),
}))

vi.mock('../Settings/ProrationBehavior', () => ({
  ProrationBehavior: () => null,
}))

vi.mock('../Shared/AmountLabel', () => ({ default: () => null }))

vi.mock('./SubscriptionDiscountField', () => ({
  SubscriptionDiscountField: () => null,
}))

vi.mock('./UpdateSubscriptionChangeSummary', () => ({
  UpdateSubscriptionChangeSummary: () => null,
}))

vi.mock('../Toast/use-toast', () => ({ toast: vi.fn() }))

const subscription = {
  id: 'subscription-1',
  status: 'active',
  product_id: 'product-1',
  discount_id: 'discount-1',
  amount: 1000,
  currency: 'usd',
  recurring_interval: 'month',
  recurring_interval_count: 1,
  prices: [],
  product: { name: 'Starter', organization_id: 'org-1' },
} as unknown as schemas['Subscription']

const organization = {
  subscription_settings: { proration_behavior: 'prorate' },
} as unknown as schemas['Organization']

const mockCurrentDiscount = (products: { id: string }[]) =>
  vi.mocked(useDiscount).mockReturnValue({
    data: { id: 'discount-1', products },
  } as unknown as ReturnType<typeof useDiscount>)

const submitProductChange = async () => {
  render(
    <UpdateSubscriptionPlanForm
      subscription={subscription}
      organization={organization}
    />,
  )
  fireEvent.click(screen.getByText('Pick product'))
  fireEvent.click(screen.getByRole('button', { name: 'Update Subscription' }))
  await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1))
  return mutateAsync.mock.calls[0][0]
}

describe('UpdateSubscriptionPlanForm', () => {
  beforeEach(() => {
    mutateAsync.mockReset()
    mutateAsync.mockResolvedValue({ error: undefined })
  })

  it('removes the discount when the new product is not eligible for it', async () => {
    mockCurrentDiscount([{ id: 'product-1' }])

    expect(await submitProductChange()).toEqual({
      product_id: 'product-2',
      proration_behavior: 'prorate',
      discount_id: null,
    })
  })

  it('keeps the discount when the new product is eligible for it', async () => {
    mockCurrentDiscount([])

    expect(await submitProductChange()).toEqual({
      product_id: 'product-2',
      proration_behavior: 'prorate',
    })
  })
})
