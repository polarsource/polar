import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { ProductCheckoutPublic } from '../guards'
import { createCheckout } from '../test-utils/makeCheckout'
import CheckoutTrialHeroPrice from './CheckoutTrialHeroPrice'

const trialProduct = {
  id: 'prod_1',
  name: 'Test Product',
  recurring_interval: 'year' as const,
  recurring_interval_count: null,
  is_recurring: true,
  trial_interval: 'month' as const,
  trial_interval_count: 1,
  visibility: 'public' as const,
  prices: [],
  benefits: [],
  medias: [],
  description: null,
  is_archived: false,
  organization_id: 'org_1',
  created_at: new Date().toISOString(),
  modified_at: null,
}

function createTrialCheckout(
  overrides: Partial<ProductCheckoutPublic> = {},
): ProductCheckoutPublic {
  return createCheckout({
    amount: 9999,
    net_amount: 9999,
    total_amount: 9999,
    active_trial_interval: 'month',
    active_trial_interval_count: 1,
    trial_end: '2026-04-05T00:00:00Z',
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
        active_trial_interval: 'day',
        active_trial_interval_count: 7,
        product: {
          ...trialProduct,
          trial_interval: 'day',
          trial_interval_count: 7,
        },
      })

      render(<CheckoutTrialHeroPrice checkout={checkout} locale="en" />)

      expect(screen.getByText('7 days free')).toBeInTheDocument()
    })

    it('renders "1 day free" for single day trial', () => {
      const checkout = createTrialCheckout({
        active_trial_interval: 'day',
        active_trial_interval_count: 1,
        product: {
          ...trialProduct,
          trial_interval: 'day',
          trial_interval_count: 1,
        },
      })

      render(<CheckoutTrialHeroPrice checkout={checkout} locale="en" />)

      expect(screen.getByText('1 day free')).toBeInTheDocument()
    })

    it('converts weeks to days — "14 days free" for 2 week trial', () => {
      const checkout = createTrialCheckout({
        active_trial_interval: 'week',
        active_trial_interval_count: 2,
        product: {
          ...trialProduct,
          trial_interval: 'week',
          trial_interval_count: 2,
        },
      })

      render(<CheckoutTrialHeroPrice checkout={checkout} locale="en" />)

      expect(screen.getByText('14 days free')).toBeInTheDocument()
    })

    it('renders "1 year free" for 1 year trial', () => {
      const checkout = createTrialCheckout({
        active_trial_interval: 'year',
        active_trial_interval_count: 1,
        product: {
          ...trialProduct,
          trial_interval: 'year',
          trial_interval_count: 1,
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
        net_amount: 999,
        total_amount: 999,
        product: {
          ...trialProduct,
          recurring_interval: 'month',
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
        discount_amount: 5000,
        net_amount: 4999,
        total_amount: 4999,
        discount: {
          id: 'disc_1',
          name: '50% off',
          type: 'percentage',
          duration: 'forever',
          code: null,
          basis_points: 5000,
        } as ProductCheckoutPublic['discount'],
      })

      const { container } = render(
        <CheckoutTrialHeroPrice checkout={checkout} locale="en" />,
      )

      expect(container.textContent).toContain('$49.99/year')
    })

    it('shows "starting" date when trial_end is set', () => {
      const checkout = createTrialCheckout({
        trial_end: '2026-04-05T00:00:00Z',
      })

      const { container } = render(
        <CheckoutTrialHeroPrice checkout={checkout} locale="en" />,
      )

      expect(container.textContent).toContain('starting')
      expect(container.textContent).toContain('April')
      expect(container.textContent).toContain('2026')
    })

    it('omits date when trial_end is null', () => {
      const checkout = createTrialCheckout({ trial_end: null })

      const { container } = render(
        <CheckoutTrialHeroPrice checkout={checkout} locale="en" />,
      )

      expect(container.textContent).toContain('Then')
      expect(container.textContent).not.toContain('starting')
    })
  })

  describe('recurring interval count', () => {
    it('reflects quarterly billing (month x3) instead of "/month"', () => {
      const checkout = createTrialCheckout({
        amount: 4106,
        net_amount: 4106,
        total_amount: 4106,
        active_trial_interval: 'day',
        active_trial_interval_count: 7,
        product: {
          ...trialProduct,
          recurring_interval: 'month',
          recurring_interval_count: 3,
          trial_interval: 'day',
          trial_interval_count: 7,
        },
      })

      const { container } = render(
        <CheckoutTrialHeroPrice checkout={checkout} locale="en" />,
      )

      expect(container.textContent).toContain('$41.06 / 3rd mo')
      expect(container.textContent).not.toMatch(/\$41\.06\/month/)
    })

    it('keeps "/month" when recurring_interval_count is 1', () => {
      const checkout = createTrialCheckout({
        amount: 999,
        net_amount: 999,
        total_amount: 999,
        product: {
          ...trialProduct,
          recurring_interval: 'month',
          recurring_interval_count: 1,
        },
      })

      const { container } = render(
        <CheckoutTrialHeroPrice checkout={checkout} locale="en" />,
      )

      expect(container.textContent).toContain('$9.99/month')
    })

    it('reflects bi-yearly billing (year x2)', () => {
      const checkout = createTrialCheckout({
        amount: 19999,
        net_amount: 19999,
        total_amount: 19999,
        product: {
          ...trialProduct,
          recurring_interval: 'year',
          recurring_interval_count: 2,
        },
      })

      const { container } = render(
        <CheckoutTrialHeroPrice checkout={checkout} locale="en" />,
      )

      expect(container.textContent).toContain('$199.99 / 2nd yr')
    })
  })
})
