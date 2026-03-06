import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { ProductCheckoutPublic } from '../guards'
import { createCheckout } from '../test-utils/makeCheckout'
import CheckoutTrialHeroPrice from './CheckoutTrialHeroPrice'

const trialProduct = {
  id: 'prod_1',
  name: 'Test Product',
  recurringInterval: 'year' as const,
  recurringIntervalCount: null,
  isRecurring: true,
  trialInterval: 'month' as const,
  trialIntervalCount: 1,
  visibility: 'public' as const,
  prices: [],
  benefits: [],
  medias: [],
  description: null,
  isArchived: false,
  organizationId: 'org_1',
  createdAt: new Date(),
  modifiedAt: null,
}

function createTrialCheckout(
  overrides: Partial<ProductCheckoutPublic> = {},
): ProductCheckoutPublic {
  return createCheckout({
    amount: 9999,
    netAmount: 9999,
    totalAmount: 9999,
    activeTrialInterval: 'month',
    activeTrialIntervalCount: 1,
    trialEnd: new Date('2026-04-05T00:00:00Z'),
    product: trialProduct,
    ...overrides,
  })
}

describe('CheckoutTrialHeroPrice', () => {
  describe('trial duration label', () => {
    it('renders "1 month free" for 1 month trial', () => {
      const checkout = createTrialCheckout()

      render(<CheckoutTrialHeroPrice checkout={checkout} locale="en" />)

      expect(screen.getByText('1 month free')).toBeInTheDocument()
    })

    it('renders "7 days free" for 7 day trial', () => {
      const checkout = createTrialCheckout({
        activeTrialInterval: 'day',
        activeTrialIntervalCount: 7,
        product: { ...trialProduct, trialInterval: 'day', trialIntervalCount: 7 },
      })

      render(<CheckoutTrialHeroPrice checkout={checkout} locale="en" />)

      expect(screen.getByText('7 days free')).toBeInTheDocument()
    })

    it('renders "1 day free" for single day trial', () => {
      const checkout = createTrialCheckout({
        activeTrialInterval: 'day',
        activeTrialIntervalCount: 1,
        product: { ...trialProduct, trialInterval: 'day', trialIntervalCount: 1 },
      })

      render(<CheckoutTrialHeroPrice checkout={checkout} locale="en" />)

      expect(screen.getByText('1 day free')).toBeInTheDocument()
    })

    it('converts weeks to days — "14 days free" for 2 week trial', () => {
      const checkout = createTrialCheckout({
        activeTrialInterval: 'week',
        activeTrialIntervalCount: 2,
        product: {
          ...trialProduct,
          trialInterval: 'week',
          trialIntervalCount: 2,
        },
      })

      render(<CheckoutTrialHeroPrice checkout={checkout} locale="en" />)

      expect(screen.getByText('14 days free')).toBeInTheDocument()
    })

    it('renders "1 year free" for 1 year trial', () => {
      const checkout = createTrialCheckout({
        activeTrialInterval: 'year',
        activeTrialIntervalCount: 1,
        product: {
          ...trialProduct,
          trialInterval: 'year',
          trialIntervalCount: 1,
        },
      })

      render(<CheckoutTrialHeroPrice checkout={checkout} locale="en" />)

      expect(screen.getByText('1 year free')).toBeInTheDocument()
    })
  })

  describe('recurring price subtitle', () => {
    it('shows recurring price with interval', () => {
      const checkout = createTrialCheckout()

      const { container } = render(
        <CheckoutTrialHeroPrice checkout={checkout} locale="en" />,
      )

      expect(container.textContent).toContain('$99.99/year')
    })

    it('shows monthly recurring price', () => {
      const checkout = createTrialCheckout({
        amount: 999,
        netAmount: 999,
        totalAmount: 999,
        product: {
          ...trialProduct,
          recurringInterval: 'month',
        },
      })

      const { container } = render(
        <CheckoutTrialHeroPrice checkout={checkout} locale="en" />,
      )

      expect(container.textContent).toContain('$9.99/month')
    })

    it('shows discounted recurring price when discount is applied', () => {
      const checkout = createTrialCheckout({
        amount: 9999,
        discountAmount: 5000,
        netAmount: 4999,
        totalAmount: 4999,
        discount: {
          id: 'disc_1',
          name: '50% off',
          type: 'percentage',
          duration: 'forever',
          code: null,
          basisPoints: 5000,
        } as ProductCheckoutPublic['discount'],
      })

      const { container } = render(
        <CheckoutTrialHeroPrice checkout={checkout} locale="en" />,
      )

      expect(container.textContent).toContain('$49.99/year')
    })

    it('shows "starting" date when trialEnd is set', () => {
      const checkout = createTrialCheckout({
        trialEnd: new Date('2026-04-05T00:00:00Z'),
      })

      const { container } = render(
        <CheckoutTrialHeroPrice checkout={checkout} locale="en" />,
      )

      expect(container.textContent).toContain('starting')
      expect(container.textContent).toContain('April')
      expect(container.textContent).toContain('2026')
    })

    it('omits date when trialEnd is null', () => {
      const checkout = createTrialCheckout({ trialEnd: null })

      const { container } = render(
        <CheckoutTrialHeroPrice checkout={checkout} locale="en" />,
      )

      expect(container.textContent).toContain('Then')
      expect(container.textContent).not.toContain('starting')
    })
  })
})
