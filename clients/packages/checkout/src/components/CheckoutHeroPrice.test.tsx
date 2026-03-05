import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { ProductCheckoutPublic } from '../guards'
import {
  createCheckout,
  createCustomPrice,
  createFreePrice,
  createSeatBasedPrice,
} from '../test-utils/makeCheckout'
import CheckoutHeroPrice from './CheckoutHeroPrice'

describe('CheckoutHeroPrice', () => {
  describe('fixed price, no discount, no tax', () => {
    it('renders total_amount', () => {
      const checkout = createCheckout({
        amount: 999,
        net_amount: 999,
        total_amount: 999,
        tax_amount: null,
      })

      render(<CheckoutHeroPrice checkout={checkout} locale="en" />)

      expect(screen.getByText('$9.99')).toBeInTheDocument()
    })
  })

  describe('fixed price, no discount, with tax', () => {
    it('renders total_amount (includes tax)', () => {
      const checkout = createCheckout({
        amount: 999,
        net_amount: 999,
        tax_amount: 250,
        total_amount: 1249,
      })

      render(<CheckoutHeroPrice checkout={checkout} locale="en" />)

      expect(screen.getByText('$12.49')).toBeInTheDocument()
    })
  })

  describe('fixed price, with discount, no tax', () => {
    it('renders total_amount (discounted price)', () => {
      const checkout = createCheckout({
        amount: 1999,
        discount_amount: 400,
        net_amount: 1599,
        tax_amount: null,
        total_amount: 1599,
        discount: {
          id: 'disc_1',
          name: '20% off',
          type: 'percentage',
          duration: 'once',
          code: null,
          basis_points: 2000,
        } as ProductCheckoutPublic['discount'],
      })

      render(<CheckoutHeroPrice checkout={checkout} locale="en" />)

      expect(screen.getByText('$15.99')).toBeInTheDocument()
    })
  })

  describe('fixed price, with discount and tax', () => {
    it('renders total_amount (includes tax)', () => {
      const checkout = createCheckout({
        amount: 1999,
        discount_amount: 400,
        net_amount: 1599,
        tax_amount: 400,
        total_amount: 1999,
        discount: {
          id: 'disc_1',
          name: '20% off',
          type: 'percentage',
          duration: 'once',
          code: null,
          basis_points: 2000,
        } as ProductCheckoutPublic['discount'],
      })

      render(<CheckoutHeroPrice checkout={checkout} locale="en" />)

      expect(screen.getByText('$19.99')).toBeInTheDocument()
    })
  })

  describe('custom (PWYW) price', () => {
    it('renders total_amount', () => {
      const checkout = createCheckout({
        amount: 1550,
        net_amount: 1550,
        total_amount: 1550,
        product_price: createCustomPrice({ preset_amount: 1550 }),
      })

      render(<CheckoutHeroPrice checkout={checkout} locale="en" />)

      expect(screen.getByText('$15.50')).toBeInTheDocument()
    })
  })

  describe('seat-based pricing', () => {
    it('renders total_amount', () => {
      const checkout = createCheckout({
        amount: 3147,
        net_amount: 3147,
        tax_amount: null,
        total_amount: 3147,
        product_price: createSeatBasedPrice(),
      })

      render(<CheckoutHeroPrice checkout={checkout} locale="en" />)

      expect(screen.getByText('$31.47')).toBeInTheDocument()
    })
  })

  describe('free product', () => {
    it('renders $0', () => {
      const checkout = createCheckout({
        amount: 0,
        net_amount: 0,
        total_amount: 0,
        is_free_product_price: true,
        product_price: createFreePrice(),
      })

      render(<CheckoutHeroPrice checkout={checkout} locale="en" />)

      expect(screen.getByText('$0')).toBeInTheDocument()
    })
  })

  describe('trial, no discount', () => {
    it('renders trial duration as hero and recurring price in subtitle', () => {
      const trialEnd = new Date('2026-04-05T00:00:00Z')
      const checkout = createCheckout({
        amount: 9999,
        netAmount: 9999,
        totalAmount: 9999,
        activeTrialInterval: 'month',
        activeTrialIntervalCount: 1,
        trialEnd,
        product: {
          id: 'prod_1',
          name: 'Test Product',
          recurringInterval: 'year',
          recurringIntervalCount: null,
          isRecurring: true,
          trialInterval: 'month',
          trialIntervalCount: 1,
          visibility: 'public',
          prices: [],
          benefits: [],
          medias: [],
          description: null,
          isArchived: false,
          organizationId: 'org_1',
          createdAt: new Date(),
          modifiedAt: null,
        },
      })

      const { container } = render(
        <CheckoutHeroPrice checkout={checkout} locale="en" />,
      )

      expect(screen.getByText('1 month free')).toBeInTheDocument()
      expect(container.textContent).toContain('$99.99/year')
    })
  })

  describe('trial with forever discount', () => {
    it('renders trial hero with discounted recurring price', () => {
      const trialEnd = new Date('2026-04-05T00:00:00Z')
      const checkout = createCheckout({
        amount: 9999,
        discountAmount: 5000,
        netAmount: 4999,
        totalAmount: 4999,
        activeTrialInterval: 'month',
        activeTrialIntervalCount: 1,
        trialEnd,
        discount: {
          id: 'disc_1',
          name: '50% off',
          type: 'percentage',
          duration: 'forever',
          code: null,
          basisPoints: 5000,
        } as ProductCheckoutPublic['discount'],
        product: {
          id: 'prod_1',
          name: 'Test Product',
          recurringInterval: 'year',
          recurringIntervalCount: null,
          isRecurring: true,
          trialInterval: 'month',
          trialIntervalCount: 1,
          visibility: 'public',
          prices: [],
          benefits: [],
          medias: [],
          description: null,
          isArchived: false,
          organizationId: 'org_1',
          createdAt: new Date(),
          modifiedAt: null,
        },
      })

      const { container } = render(
        <CheckoutHeroPrice checkout={checkout} locale="en" />,
      )

      expect(screen.getByText('1 month free')).toBeInTheDocument()
      expect(container.textContent).toContain('$49.99/year')
      // Should NOT show the full price since discount is forever
      expect(container.textContent).not.toContain('$99.99')
    })
  })

  describe('trial with once discount', () => {
    it('renders trial hero with discounted price and full price after', () => {
      const trialEnd = new Date('2026-04-05T00:00:00Z')
      const checkout = createCheckout({
        amount: 9999,
        discountAmount: 5000,
        netAmount: 4999,
        totalAmount: 4999,
        activeTrialInterval: 'month',
        activeTrialIntervalCount: 1,
        trialEnd,
        discount: {
          id: 'disc_1',
          name: '50% off',
          type: 'percentage',
          duration: 'once',
          code: null,
          basisPoints: 5000,
        } as ProductCheckoutPublic['discount'],
        product: {
          id: 'prod_1',
          name: 'Test Product',
          recurringInterval: 'year',
          recurringIntervalCount: null,
          isRecurring: true,
          trialInterval: 'month',
          trialIntervalCount: 1,
          visibility: 'public',
          prices: [],
          benefits: [],
          medias: [],
          description: null,
          isArchived: false,
          organizationId: 'org_1',
          createdAt: new Date(),
          modifiedAt: null,
        },
      })

      const { container } = render(
        <CheckoutHeroPrice checkout={checkout} locale="en" />,
      )

      expect(screen.getByText('1 month free')).toBeInTheDocument()
      expect(container.textContent).toContain('$49.99/year')
      // Shows the undiscounted price since discount is "once"
      expect(container.textContent).toContain('$99.99/year')
    })
  })

  describe('trial with days', () => {
    it('renders "7 days free"', () => {
      const checkout = createCheckout({
        amount: 999,
        netAmount: 999,
        totalAmount: 999,
        activeTrialInterval: 'day',
        activeTrialIntervalCount: 7,
        trialEnd: new Date('2026-03-12T00:00:00Z'),
        product: {
          id: 'prod_1',
          name: 'Test Product',
          recurringInterval: 'month',
          recurringIntervalCount: null,
          isRecurring: true,
          trialInterval: 'day',
          trialIntervalCount: 7,
          visibility: 'public',
          prices: [],
          benefits: [],
          medias: [],
          description: null,
          isArchived: false,
          organizationId: 'org_1',
          createdAt: new Date(),
          modifiedAt: null,
        },
      })

      const { container } = render(
        <CheckoutHeroPrice checkout={checkout} locale="en" />,
      )

      expect(screen.getByText('7 days free')).toBeInTheDocument()
      expect(container.textContent).toContain('$9.99/month')
    })
  })

  describe('trial with weeks (converted to days)', () => {
    it('renders "14 days free" for 2 week trial', () => {
      const checkout = createCheckout({
        amount: 999,
        netAmount: 999,
        totalAmount: 999,
        activeTrialInterval: 'week',
        activeTrialIntervalCount: 2,
        trialEnd: new Date('2026-03-19T00:00:00Z'),
        product: {
          id: 'prod_1',
          name: 'Test Product',
          recurringInterval: 'month',
          recurringIntervalCount: null,
          isRecurring: true,
          trialInterval: 'week',
          trialIntervalCount: 2,
          visibility: 'public',
          prices: [],
          benefits: [],
          medias: [],
          description: null,
          isArchived: false,
          organizationId: 'org_1',
          createdAt: new Date(),
          modifiedAt: null,
        },
      })

      render(<CheckoutHeroPrice checkout={checkout} locale="en" />)

      expect(screen.getByText('14 days free')).toBeInTheDocument()
    })
  })
})
