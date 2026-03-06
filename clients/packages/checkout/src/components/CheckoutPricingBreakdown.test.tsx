import type { CheckoutPublic } from '@polar-sh/sdk/models/components/checkoutpublic'
import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  createBaseCheckout,
  createCheckout,
  createMeteredPrice,
} from '../test-utils/makeCheckout'
import CheckoutPricingBreakdown from './CheckoutPricingBreakdown'

function getRowValue(label: string): string {
  const row = screen.getByTestId(`detail-row-${label}`)
  return within(row).getAllByRole('generic').pop()?.textContent?.trim() ?? ''
}

describe('CheckoutPricingBreakdown', () => {
  describe('basic product, no tax, no discount', () => {
    it('shows subtotal and total as the same amount', () => {
      const checkout = createBaseCheckout({
        amount: 999,
        netAmount: 999,
        taxAmount: null,
        totalAmount: 999,
      })

      render(<CheckoutPricingBreakdown checkout={checkout} locale="en" />)

      expect(getRowValue('Subtotal')).toBe('$9.99')
      expect(getRowValue('Taxes')).toBe('—')
      expect(getRowValue('Total')).toBe('$9.99')
    })
  })

  describe('with taxes, no discount', () => {
    it('shows subtotal, tax amount, and total correctly', () => {
      const checkout = createBaseCheckout({
        amount: 999,
        netAmount: 999,
        taxAmount: 250,
        totalAmount: 1249,
      })

      render(<CheckoutPricingBreakdown checkout={checkout} locale="en" />)

      expect(getRowValue('Subtotal')).toBe('$9.99')
      expect(getRowValue('Taxes')).toBe('$2.50')
      expect(getRowValue('Total')).toBe('$12.49')
    })
  })

  describe('with discount, no tax', () => {
    it('shows subtotal, discount, taxable amount, and total', () => {
      const checkout = createBaseCheckout({
        amount: 2000,
        discountAmount: 400,
        netAmount: 1600,
        taxAmount: null,
        totalAmount: 1600,
        discount: {
          id: 'disc_1',
          name: '20% off',
          type: 'percentage',
          duration: 'once',
          code: null,
          basisPoints: 2000,
        } as CheckoutPublic['discount'],
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
        discountAmount: 400,
        netAmount: 1600,
        taxAmount: 400,
        totalAmount: 2000,
        discount: {
          id: 'disc_1',
          name: '20% off',
          type: 'percentage',
          duration: 'once',
          code: null,
          basisPoints: 2000,
        } as CheckoutPublic['discount'],
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
        netAmount: 999,
        taxAmount: 0,
        totalAmount: 999,
      })

      render(<CheckoutPricingBreakdown checkout={checkout} locale="en" />)

      expect(getRowValue('Taxes')).toBe('$0')
    })
  })

  describe('free product', () => {
    it('renders nothing', () => {
      const checkout = createBaseCheckout({
        amount: 0,
        netAmount: 0,
        totalAmount: 0,
        isFreeProductPrice: true,
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
        discountAmount: 999,
        netAmount: 0,
        taxAmount: 0,
        totalAmount: 0,
        discount: {
          id: 'disc_1',
          name: '100% off',
          type: 'percentage',
          duration: 'once',
          code: null,
          basisPoints: 10000,
        } as CheckoutPublic['discount'],
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
        netAmount: 999,
        taxAmount: null,
        totalAmount: 999,
        product: {
          ...createCheckout().product,
          recurringInterval: 'month',
          recurringIntervalCount: 1,
          isRecurring: true,
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
        netAmount: 4999,
        taxAmount: null,
        totalAmount: 4999,
        product: {
          ...createCheckout().product,
          recurringInterval: 'year',
          recurringIntervalCount: 1,
          isRecurring: true,
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
        discountAmount: 500,
        netAmount: 1500,
        taxAmount: null,
        totalAmount: 1500,
        discount: {
          id: 'disc_1',
          name: '$5 off',
          type: 'fixed',
          duration: 'once',
          code: null,
          amount: 500,
          currency: 'usd',
        } as CheckoutPublic['discount'],
      })

      render(<CheckoutPricingBreakdown checkout={checkout} locale="en" />)

      expect(getRowValue('$5 off')).toBe('-$5')
    })
  })

  describe('discount duration - repeating months', () => {
    it('shows duration text for repeating discount on monthly product', () => {
      const checkout = createCheckout({
        amount: 2000,
        discountAmount: 400,
        netAmount: 1600,
        taxAmount: null,
        totalAmount: 1600,
        product: {
          ...createCheckout().product,
          recurringInterval: 'month',
          recurringIntervalCount: 1,
          isRecurring: true,
        },
        discount: {
          id: 'disc_1',
          name: '20% off',
          type: 'percentage',
          duration: 'repeating',
          durationInMonths: 3,
          code: null,
          basisPoints: 2000,
        } as CheckoutPublic['discount'],
      })

      render(<CheckoutPricingBreakdown checkout={checkout} locale="en" />)

      expect(screen.getByText(/for the first 3 months/i)).toBeInTheDocument()
    })
  })

  describe('discount duration - once on monthly', () => {
    it('shows "for the first month" for once duration', () => {
      const checkout = createCheckout({
        amount: 2000,
        discountAmount: 400,
        netAmount: 1600,
        taxAmount: null,
        totalAmount: 1600,
        product: {
          ...createCheckout().product,
          recurringInterval: 'month',
          recurringIntervalCount: 1,
          isRecurring: true,
        },
        discount: {
          id: 'disc_1',
          name: '20% off',
          type: 'percentage',
          duration: 'once',
          code: null,
          basisPoints: 2000,
        } as CheckoutPublic['discount'],
      })

      render(<CheckoutPricingBreakdown checkout={checkout} locale="en" />)

      expect(screen.getByText(/for the first month/i)).toBeInTheDocument()
    })
  })

  describe('discount duration - forever', () => {
    it('shows no duration text for forever discount', () => {
      const checkout = createCheckout({
        amount: 2000,
        discountAmount: 400,
        netAmount: 1600,
        taxAmount: null,
        totalAmount: 1600,
        product: {
          ...createCheckout().product,
          recurringInterval: 'month',
          recurringIntervalCount: 1,
          isRecurring: true,
        },
        discount: {
          id: 'disc_1',
          name: '20% off',
          type: 'percentage',
          duration: 'forever',
          code: null,
          basisPoints: 2000,
        } as CheckoutPublic['discount'],
      })

      render(<CheckoutPricingBreakdown checkout={checkout} locale="en" />)

      expect(screen.queryByText(/for the first/i)).not.toBeInTheDocument()
    })
  })

  describe('trial section', () => {
    it('shows "Total after trial" and "Due today" $0', () => {
      const checkout = createBaseCheckout({
        amount: 999,
        netAmount: 999,
        taxAmount: null,
        totalAmount: 999,
        activeTrialInterval: 'month',
        activeTrialIntervalCount: 1,
        trialEnd: new Date('2026-04-05T00:00:00Z'),
      })

      render(<CheckoutPricingBreakdown checkout={checkout} locale="en" />)

      expect(screen.getByText('Total when trial ends')).toBeInTheDocument()
      expect(screen.getByText('Total due today')).toBeInTheDocument()
      expect(
        screen.getByTestId('detail-row-Total due today').textContent,
      ).toContain('$0')
      // Should NOT show "Total when discount expires" when there's no discount
      expect(
        screen.queryByText('Total when discount expires'),
      ).not.toBeInTheDocument()
    })

    it('shows "Total after discount" when there is an expiring discount', () => {
      const checkout = createBaseCheckout({
        amount: 999,
        discountAmount: 500,
        netAmount: 499,
        taxAmount: null,
        totalAmount: 499,
        activeTrialInterval: 'month',
        activeTrialIntervalCount: 1,
        trialEnd: new Date('2026-04-05T00:00:00Z'),
        discount: {
          id: 'disc_1',
          name: '50% off',
          type: 'percentage',
          duration: 'once',
          code: null,
          basisPoints: 5000,
        } as CheckoutPublic['discount'],
      })

      render(<CheckoutPricingBreakdown checkout={checkout} locale="en" />)

      expect(screen.getByText('Total when discount expires')).toBeInTheDocument()
      expect(screen.getByText('Total when trial ends')).toBeInTheDocument()
      expect(screen.getByText('Total due today')).toBeInTheDocument()
    })
  })

  describe('metered prices in breakdown', () => {
    it('shows additional metered usage row', () => {
      const meteredPrice = createMeteredPrice({
        id: 'price_metered_1',
        meter: { id: 'meter_1', name: 'API Calls' },
      })
      const checkout = createCheckout({
        amount: 999,
        netAmount: 999,
        taxAmount: null,
        totalAmount: 999,
        prices: {
          prod_1: [createCheckout().productPrice, meteredPrice],
        },
      })

      render(<CheckoutPricingBreakdown checkout={checkout} locale="en" />)

      expect(screen.getByText(/additional metered usage/i)).toBeInTheDocument()
      expect(screen.getByTestId('detail-row-API Calls')).toBeInTheDocument()
    })
  })

  describe('no currency set', () => {
    it('shows "Free" text', () => {
      const checkout = createBaseCheckout({
        amount: 0,
        netAmount: 0,
        totalAmount: 0,
        currency: null as unknown as string,
      })

      render(<CheckoutPricingBreakdown checkout={checkout} locale="en" />)

      expect(screen.getByText('Free')).toBeInTheDocument()
    })
  })
})
