import { schemas } from '@polar-sh/client'
import { render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createBaseCheckout,
  createCheckout,
  createMeteredPrice,
  createSeatBasedPrice,
} from '../test-utils/makeCheckout'
import CheckoutPricingBreakdown from './CheckoutPricingBreakdown'

function getRowValue(label: string): string {
  const row = screen.getByTestId(`detail-row-${label}`)
  return within(row).getAllByRole('generic').pop()?.textContent?.trim() ?? ''
}

function createDiscountedCheckout({
  interval,
  intervalCount,
  discount,
  trial,
}: {
  interval: 'day' | 'week' | 'month' | 'year' | null
  intervalCount?: number
  discount: schemas['CheckoutPublic']['discount']
  trial?: boolean
}) {
  return interval
    ? createCheckout({
        amount: 999,
        discount_amount: 500,
        net_amount: 499,
        tax_amount: null,
        total_amount: 499,
        product: {
          ...createCheckout().product,
          recurring_interval: interval,
          recurring_interval_count: intervalCount ?? 1,
          is_recurring: true,
        },
        discount,
        ...(trial && {
          active_trial_interval: 'month',
          active_trial_interval_count: 1,
          trial_end: new Date('2026-04-05T00:00:00Z').toISOString(),
        }),
      })
    : createBaseCheckout({
        amount: 999,
        discount_amount: 500,
        net_amount: 499,
        tax_amount: null,
        total_amount: 499,
        discount,
      })
}

const onceDiscount = {
  id: 'disc_1',
  name: '50% off',
  type: 'percentage',
  duration: 'once',
  code: null,
  basis_points: 5000,
} satisfies schemas['CheckoutPublic']['discount']

const repeatingDiscount = (durationInMonths: number) =>
  ({
    id: 'disc_1',
    name: '50% off',
    type: 'percentage',
    duration: 'repeating',
    duration_in_months: durationInMonths,
    code: null,
    basis_points: 5000,
  }) satisfies schemas['CheckoutPublic']['discount']

describe('CheckoutPricingBreakdown', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  describe('basic product, no tax, no discount', () => {
    it('shows subtotal and total as the same amount', () => {
      const checkout = createBaseCheckout({
        amount: 999,
        net_amount: 999,
        tax_amount: null,
        total_amount: 999,
      })

      render(<CheckoutPricingBreakdown checkout={checkout} locale="en" />)

      expect(getRowValue('Subtotal')).toBe('$9.99')
      expect(getRowValue('Taxes')).toBe('—')
      expect(getRowValue('Total')).toBe('$9.99')
    })
  })

  describe('with exclusive taxes, no discount', () => {
    it('shows subtotal, tax amount, and total correctly', () => {
      const checkout = createBaseCheckout({
        amount: 999,
        net_amount: 999,
        tax_amount: 250,
        tax_behavior: 'exclusive',
        total_amount: 1249,
      })

      render(<CheckoutPricingBreakdown checkout={checkout} locale="en" />)

      expect(getRowValue('Subtotal')).toBe('$9.99')
      expect(getRowValue('Taxes')).toBe('$2.50')
      expect(getRowValue('Total')).toBe('$12.49')
    })
  })

  describe('with inclusive taxes', () => {
    it('shows "Taxes (included)" label', () => {
      const checkout = createBaseCheckout({
        amount: 999,
        net_amount: 799,
        tax_amount: 200,
        tax_behavior: 'inclusive',
        total_amount: 999,
      })

      render(<CheckoutPricingBreakdown checkout={checkout} locale="en" />)

      expect(getRowValue('Taxes (included)')).toBe('$2')
      expect(getRowValue('Total')).toBe('$9.99')
    })
  })

  describe('with discount, no tax', () => {
    it('shows subtotal, discount, taxable amount, and total', () => {
      const checkout = createBaseCheckout({
        amount: 2000,
        discount_amount: 400,
        net_amount: 1600,
        tax_amount: null,
        total_amount: 1600,
        discount: {
          id: 'disc_1',
          name: '20% off',
          type: 'percentage',
          duration: 'once',
          code: null,
          basis_points: 2000,
        } satisfies schemas['CheckoutPublic']['discount'],
      })

      render(<CheckoutPricingBreakdown checkout={checkout} locale="en" />)

      expect(getRowValue('Subtotal')).toBe('$20')
      expect(getRowValue('20% off (-20%)')).toBe('-$4')
      expect(getRowValue('Taxable amount')).toBe('$16')
      expect(getRowValue('Taxes')).toBe('—')
      expect(getRowValue('Total')).toBe('$16')
    })
  })

  describe('with discount and taxes', () => {
    it('shows all breakdown rows correctly', () => {
      const checkout = createBaseCheckout({
        amount: 2000,
        discount_amount: 400,
        net_amount: 1600,
        tax_amount: 400,
        total_amount: 2000,
        discount: {
          id: 'disc_1',
          name: '20% off',
          type: 'percentage',
          duration: 'once',
          code: null,
          basis_points: 2000,
        } satisfies schemas['CheckoutPublic']['discount'],
      })

      render(<CheckoutPricingBreakdown checkout={checkout} locale="en" />)

      expect(getRowValue('Subtotal')).toBe('$20')
      expect(getRowValue('20% off (-20%)')).toBe('-$4')
      expect(getRowValue('Taxable amount')).toBe('$16')
      expect(getRowValue('Taxes')).toBe('$4')
      expect(getRowValue('Total')).toBe('$20')
    })
  })

  describe('zero tax (calculated)', () => {
    it('shows $0 for taxes, not em-dash', () => {
      const checkout = createBaseCheckout({
        amount: 999,
        net_amount: 999,
        tax_amount: 0,
        total_amount: 999,
      })

      render(<CheckoutPricingBreakdown checkout={checkout} locale="en" />)

      expect(getRowValue('Taxes')).toBe('$0')
    })
  })

  describe('free product', () => {
    it('renders nothing', () => {
      const checkout = createBaseCheckout({
        amount: 0,
        net_amount: 0,
        total_amount: 0,
        is_free_product_price: true,
      })

      const { container } = render(
        <CheckoutPricingBreakdown checkout={checkout} locale="en" />,
      )

      expect(container.innerHTML).toBe('')
    })
  })

  describe('100% discount', () => {
    it('shows $0 total', () => {
      const checkout = createBaseCheckout({
        amount: 999,
        discount_amount: 999,
        net_amount: 0,
        tax_amount: 0,
        total_amount: 0,
        discount: {
          id: 'disc_1',
          name: '100% off',
          type: 'percentage',
          duration: 'once',
          code: null,
          basis_points: 10000,
        } satisfies schemas['CheckoutPublic']['discount'],
      })

      render(<CheckoutPricingBreakdown checkout={checkout} locale="en" />)

      expect(getRowValue('Subtotal')).toBe('$9.99')
      expect(getRowValue('Total')).toBe('$0')
    })
  })

  describe('monthly recurring product', () => {
    it('shows "Every month" as total label', () => {
      const checkout = createCheckout({
        amount: 999,
        net_amount: 999,
        tax_amount: null,
        total_amount: 999,
        product: {
          ...createCheckout().product,
          recurring_interval: 'month',
          recurring_interval_count: 1,
          is_recurring: true,
        },
      })

      render(<CheckoutPricingBreakdown checkout={checkout} locale="en" />)

      expect(screen.getByTestId('detail-row-Monthly')).toBeInTheDocument()
    })
  })

  describe('yearly recurring product', () => {
    it('shows "Every year" as total label', () => {
      const checkout = createCheckout({
        amount: 4999,
        net_amount: 4999,
        tax_amount: null,
        total_amount: 4999,
        product: {
          ...createCheckout().product,
          recurring_interval: 'year',
          recurring_interval_count: 1,
          is_recurring: true,
        },
      })

      render(<CheckoutPricingBreakdown checkout={checkout} locale="en" />)

      expect(screen.getByTestId('detail-row-Yearly')).toBeInTheDocument()
    })
  })

  describe('fixed amount discount', () => {
    it('shows discount name without percentage', () => {
      const checkout = createBaseCheckout({
        amount: 2000,
        discount_amount: 500,
        net_amount: 1500,
        tax_amount: null,
        total_amount: 1500,
        discount: {
          id: 'disc_1',
          name: '$5 off',
          type: 'fixed',
          duration: 'once',
          code: null,
          amount: 500,
          currency: 'usd',
          amounts: { usd: 500 },
        } satisfies schemas['CheckoutPublic']['discount'],
      })

      render(<CheckoutPricingBreakdown checkout={checkout} locale="en" />)

      expect(getRowValue('$5 off')).toBe('-$5')
    })
  })

  describe('discount end date on discount line', () => {
    it('shows "Until" date for once discount on monthly product', () => {
      const checkout = createCheckout({
        amount: 2000,
        discount_amount: 400,
        net_amount: 1600,
        tax_amount: null,
        total_amount: 1600,
        product: {
          ...createCheckout().product,
          recurring_interval: 'month',
          recurring_interval_count: 1,
          is_recurring: true,
        },
        discount: {
          id: 'disc_1',
          name: '20% off',
          type: 'percentage',
          duration: 'once',
          code: null,
          basis_points: 2000,
        } satisfies schemas['CheckoutPublic']['discount'],
      })

      render(<CheckoutPricingBreakdown checkout={checkout} locale="en" />)

      expect(screen.getByText(/Until/i)).toBeInTheDocument()
    })

    it('shows "Until" date for repeating discount', () => {
      const checkout = createCheckout({
        amount: 2000,
        discount_amount: 400,
        net_amount: 1600,
        tax_amount: null,
        total_amount: 1600,
        product: {
          ...createCheckout().product,
          recurring_interval: 'month',
          recurring_interval_count: 1,
          is_recurring: true,
        },
        discount: {
          id: 'disc_1',
          name: '20% off',
          type: 'percentage',
          duration: 'repeating',
          duration_in_months: 3,
          code: null,
          basis_points: 2000,
        } satisfies schemas['CheckoutPublic']['discount'],
      })

      render(<CheckoutPricingBreakdown checkout={checkout} locale="en" />)

      expect(screen.getByText(/Until/i)).toBeInTheDocument()
    })

    it('does not show "Until" for forever discount', () => {
      const checkout = createCheckout({
        amount: 2000,
        discount_amount: 400,
        net_amount: 1600,
        tax_amount: null,
        total_amount: 1600,
        product: {
          ...createCheckout().product,
          recurring_interval: 'month',
          recurring_interval_count: 1,
          is_recurring: true,
        },
        discount: {
          id: 'disc_1',
          name: '20% off',
          type: 'percentage',
          duration: 'forever',
          code: null,
          basis_points: 2000,
        } satisfies schemas['CheckoutPublic']['discount'],
      })

      render(<CheckoutPricingBreakdown checkout={checkout} locale="en" />)

      expect(screen.queryByText(/Until/i)).not.toBeInTheDocument()
    })
  })

  describe('trial section', () => {
    it('shows the regular total row with trial active', () => {
      const checkout = createCheckout({
        amount: 999,
        net_amount: 999,
        tax_amount: null,
        total_amount: 999,
        active_trial_interval: 'month',
        active_trial_interval_count: 1,
        trial_end: new Date('2026-04-05T00:00:00Z').toISOString(),
        product: {
          ...createCheckout().product,
          recurring_interval: 'month',
          recurring_interval_count: 1,
          is_recurring: true,
        },
      })

      render(<CheckoutPricingBreakdown checkout={checkout} locale="en" />)

      expect(screen.getByTestId('detail-row-Monthly')).toBeInTheDocument()
    })

    it('does not show "Total when trial ends" or "Total due today"', () => {
      const checkout = createBaseCheckout({
        amount: 999,
        net_amount: 999,
        tax_amount: null,
        total_amount: 999,
        active_trial_interval: 'month',
        active_trial_interval_count: 1,
        trial_end: new Date('2026-04-05T00:00:00Z').toISOString(),
      })

      render(<CheckoutPricingBreakdown checkout={checkout} locale="en" />)

      expect(
        screen.queryByText('Total when trial ends'),
      ).not.toBeInTheDocument()
      expect(screen.queryByText('Total due today')).not.toBeInTheDocument()
    })

    it('shows "Until" for once discount on recurring product with trial', () => {
      const checkout = createDiscountedCheckout({
        interval: 'month',
        discount: onceDiscount,
        trial: true,
      })
      render(<CheckoutPricingBreakdown checkout={checkout} locale="en" />)
      expect(screen.getByText(/Until/i)).toBeInTheDocument()
    })

    it('shows correct "Until" date for once discount on weekly billing', () => {
      const checkout = createDiscountedCheckout({
        interval: 'week',
        discount: onceDiscount,
      })
      render(<CheckoutPricingBreakdown checkout={checkout} locale="en" />)
      const expected = new Date()
      expected.setDate(expected.getDate() + 7)
      const month = expected.toLocaleString('en', { month: 'short' })
      expect(
        screen.getByText(new RegExp(`Until ${month} ${expected.getDate()}`)),
      ).toBeInTheDocument()
    })

    it('shows correct "Until" date for once discount on daily billing', () => {
      const checkout = createDiscountedCheckout({
        interval: 'day',
        discount: onceDiscount,
      })
      render(<CheckoutPricingBreakdown checkout={checkout} locale="en" />)
      const expected = new Date()
      expected.setDate(expected.getDate() + 1)
      const month = expected.toLocaleString('en', { month: 'short' })
      expect(
        screen.getByText(new RegExp(`Until ${month} ${expected.getDate()}`)),
      ).toBeInTheDocument()
    })

    it('hides "Until" for once discount on one-time product', () => {
      const checkout = createDiscountedCheckout({
        interval: null,
        discount: onceDiscount,
      })
      render(<CheckoutPricingBreakdown checkout={checkout} locale="en" />)
      expect(screen.queryByText(/Until/i)).not.toBeInTheDocument()
    })

    it('hides "Until" when discount period is within one billing cycle (6mo on yearly)', () => {
      const checkout = createDiscountedCheckout({
        interval: 'year',
        discount: repeatingDiscount(6),
      })
      render(<CheckoutPricingBreakdown checkout={checkout} locale="en" />)
      expect(screen.queryByText(/Until/i)).not.toBeInTheDocument()
    })

    it('shows "Until" when discount spans multiple cycles (6mo on monthly)', () => {
      const checkout = createDiscountedCheckout({
        interval: 'month',
        discount: repeatingDiscount(6),
      })
      render(<CheckoutPricingBreakdown checkout={checkout} locale="en" />)
      expect(screen.getByText(/Until/i)).toBeInTheDocument()
    })

    it('shows "Until" for weekly billing with 1mo discount', () => {
      const checkout = createDiscountedCheckout({
        interval: 'week',
        discount: repeatingDiscount(1),
      })
      render(<CheckoutPricingBreakdown checkout={checkout} locale="en" />)
      expect(screen.getByText(/Until/i)).toBeInTheDocument()
    })

    it('shows "Until" for daily billing with 1mo discount', () => {
      const checkout = createDiscountedCheckout({
        interval: 'day',
        discount: repeatingDiscount(1),
      })
      render(<CheckoutPricingBreakdown checkout={checkout} locale="en" />)
      expect(screen.getByText(/Until/i)).toBeInTheDocument()
    })

    it('hides "Until" for every-30-days billing with 1mo discount', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-04-15T00:00:00Z'))
      const checkout = createDiscountedCheckout({
        interval: 'day',
        intervalCount: 30,
        discount: repeatingDiscount(1),
      })
      render(<CheckoutPricingBreakdown checkout={checkout} locale="en" />)
      expect(screen.queryByText(/Until/i)).not.toBeInTheDocument()
    })

    it('shows "Until" for every-4-weeks billing with 1mo discount', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-05-15T00:00:00Z'))
      const checkout = createDiscountedCheckout({
        interval: 'week',
        intervalCount: 4,
        discount: repeatingDiscount(1),
      })
      render(<CheckoutPricingBreakdown checkout={checkout} locale="en" />)
      expect(screen.getByText(/Until/i)).toBeInTheDocument()
    })

    it('shows "Until" for every-2-weeks billing with 1mo discount', () => {
      const checkout = createDiscountedCheckout({
        interval: 'week',
        intervalCount: 2,
        discount: repeatingDiscount(1),
      })
      render(<CheckoutPricingBreakdown checkout={checkout} locale="en" />)
      expect(screen.getByText(/Until/i)).toBeInTheDocument()
    })
  })

  describe('metered prices in breakdown', () => {
    it('shows additional metered usage row', () => {
      const meteredPrice = createMeteredPrice({
        id: 'price_metered_1',
        meter: { id: 'meter_1', name: 'API Calls', unit: 'scalar' as const },
      })
      const checkout = createCheckout({
        amount: 999,
        net_amount: 999,
        tax_amount: null,
        total_amount: 999,
        prices: {
          prod_1: [createCheckout().product_price, meteredPrice],
        },
      })

      render(<CheckoutPricingBreakdown checkout={checkout} locale="en" />)

      expect(screen.getByText(/additional metered usage/i)).toBeInTheDocument()
      expect(screen.getByTestId('detail-row-API Calls')).toBeInTheDocument()
    })

    it('strikes through the original rate when a percentage discount is active', () => {
      const meteredPrice = createMeteredPrice({
        id: 'price_metered_1',
        unit_amount: '900',
        meter: { id: 'meter_1', name: 'Workspaces', unit: 'scalar' as const },
      })
      const checkout = createCheckout({
        amount: 999,
        discount_amount: 500,
        net_amount: 499,
        tax_amount: null,
        total_amount: 499,
        discount: {
          id: 'disc_1',
          name: 'half',
          type: 'percentage',
          duration: 'once',
          code: 'halfoff',
          basis_points: 5000,
        } satisfies schemas['CheckoutPublic']['discount'],
        prices: {
          prod_1: [createCheckout().product_price, meteredPrice],
        },
      })

      render(<CheckoutPricingBreakdown checkout={checkout} locale="en" />)

      const row = screen.getByTestId('detail-row-Workspaces')
      expect(row).toHaveTextContent('$9.00')
      expect(row).toHaveTextContent('$4.50')
      expect(within(row).getByText('$9.00')).toHaveClass('line-through')
    })

    it('does not strike through the rate for fixed-amount discounts', () => {
      const meteredPrice = createMeteredPrice({
        id: 'price_metered_1',
        unit_amount: '900',
        meter: { id: 'meter_1', name: 'Workspaces', unit: 'scalar' as const },
      })
      const checkout = createCheckout({
        amount: 999,
        discount_amount: 500,
        net_amount: 499,
        tax_amount: null,
        total_amount: 499,
        discount: {
          id: 'disc_1',
          name: '$5 off',
          type: 'fixed',
          duration: 'once',
          code: null,
          amount: 500,
          currency: 'usd',
          amounts: { usd: 500 },
        } satisfies schemas['CheckoutPublic']['discount'],
        prices: {
          prod_1: [createCheckout().product_price, meteredPrice],
        },
      })

      render(<CheckoutPricingBreakdown checkout={checkout} locale="en" />)

      const row = screen.getByTestId('detail-row-Workspaces')
      expect(row).toHaveTextContent('$9.00')
      expect(within(row).queryByText('$4.50')).not.toBeInTheDocument()
      expect(row.querySelector('.line-through')).toBeNull()
    })
  })

  describe('volume seat pricing', () => {
    it('shows single seat row above subtotal', () => {
      const checkout = createCheckout({
        amount: 5000,
        net_amount: 5000,
        tax_amount: null,
        total_amount: 5000,
        seats: 10,
        product_price: createSeatBasedPrice({
          seat_tiers: {
            seat_tier_type: 'volume',
            tiers: [{ min_seats: 1, max_seats: null, price_per_seat: 500 }],
            minimum_seats: 1,
            maximum_seats: null,
          },
        }),
      })

      render(<CheckoutPricingBreakdown checkout={checkout} locale="en" />)

      const row = screen.getByTestId('detail-row-10 seats')
      expect(row).toHaveTextContent('$5 per seat')
      expect(row).toHaveTextContent('$50')
    })
  })

  describe('graduated seat pricing', () => {
    it('shows a row per tier', () => {
      const checkout = createCheckout({
        amount: 14000,
        net_amount: 14000,
        tax_amount: null,
        total_amount: 14000,
        seats: 15,
        product_price: createSeatBasedPrice({
          seat_tiers: {
            seat_tier_type: 'graduated',
            tiers: [
              { min_seats: 1, max_seats: 10, price_per_seat: 1000 },
              { min_seats: 11, max_seats: null, price_per_seat: 800 },
            ],
            minimum_seats: 1,
            maximum_seats: null,
          },
        }),
      })

      render(<CheckoutPricingBreakdown checkout={checkout} locale="en" />)

      const tier1 = screen.getByTestId('detail-row-10 seats')
      expect(tier1).toHaveTextContent('$10 per seat')
      expect(tier1).toHaveTextContent('$100')

      const tier2 = screen.getByTestId('detail-row-5 seats')
      expect(tier2).toHaveTextContent('$8 per seat')
      expect(tier2).toHaveTextContent('$40')
    })

    it('shows single tier when seats fit in first tier', () => {
      const checkout = createCheckout({
        amount: 5000,
        net_amount: 5000,
        tax_amount: null,
        total_amount: 5000,
        seats: 5,
        product_price: createSeatBasedPrice({
          seat_tiers: {
            seat_tier_type: 'graduated',
            tiers: [
              { min_seats: 1, max_seats: 10, price_per_seat: 1000 },
              { min_seats: 11, max_seats: null, price_per_seat: 800 },
            ],
            minimum_seats: 1,
            maximum_seats: null,
          },
        }),
      })

      render(<CheckoutPricingBreakdown checkout={checkout} locale="en" />)

      const tier1 = screen.getByTestId('detail-row-5 seats')
      expect(tier1).toHaveTextContent('$10 per seat')
      expect(tier1).toHaveTextContent('$50')
      expect(screen.queryByTestId('detail-row-0 seats')).not.toBeInTheDocument()
    })
  })

  describe('no currency set', () => {
    it('shows "Free" text', () => {
      const checkout = createBaseCheckout({
        amount: 0,
        net_amount: 0,
        total_amount: 0,
        currency: null as unknown as string,
      })

      render(<CheckoutPricingBreakdown checkout={checkout} locale="en" />)

      expect(screen.getByText('Free')).toBeInTheDocument()
    })
  })
})
