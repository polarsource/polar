import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ProductCheckoutPublic } from '../guards'
import {
  createCheckout,
  createFixedPrice,
  createMeteredPrice,
  createSeatBasedPrice,
} from '../test-utils/makeCheckout'
import CheckoutProductSwitcher from './CheckoutProductSwitcher'

const themePreset = {} as Parameters<
  typeof CheckoutProductSwitcher
>[0]['themePreset']

const noopUpdate = vi.fn().mockResolvedValue({} as ProductCheckoutPublic)

describe('CheckoutProductSwitcher', () => {
  describe('single product', () => {
    it('returns null', () => {
      const checkout = createCheckout({
        products: [createCheckout().product],
        prices: {
          prod_1: [createFixedPrice()],
        },
      })

      const { container } = render(
        <CheckoutProductSwitcher
          checkout={checkout}
          update={noopUpdate}
          themePreset={themePreset}
          locale="en"
        />,
      )

      expect(container.innerHTML).toBe('')
    })
  })

  describe('multiple products', () => {
    it('renders radio items with product names', () => {
      const product1 = {
        ...createCheckout().product,
        id: 'prod_1',
        name: 'Basic Plan',
      }
      const product2 = {
        ...createCheckout().product,
        id: 'prod_2',
        name: 'Pro Plan',
      }
      const price1 = createFixedPrice({
        id: 'price_1',
        product_id: 'prod_1',
        price_amount: 999,
      })
      const price2 = createFixedPrice({
        id: 'price_2',
        product_id: 'prod_2',
        price_amount: 2999,
      })

      const checkout = createCheckout({
        product: product1,
        product_price: price1,
        products: [product1, product2],
        prices: {
          prod_1: [price1],
          prod_2: [price2],
        },
      })

      render(
        <CheckoutProductSwitcher
          checkout={checkout}
          update={noopUpdate}
          themePreset={themePreset}
          locale="en"
        />,
      )

      expect(screen.getByText('Basic Plan')).toBeInTheDocument()
      expect(screen.getByText('Pro Plan')).toBeInTheDocument()
    })

    it('shows billing description for one-time products', () => {
      const product1 = {
        ...createCheckout().product,
        id: 'prod_1',
        name: 'Basic',
        recurring_interval: null,
      }
      const product2 = {
        ...createCheckout().product,
        id: 'prod_2',
        name: 'Pro',
        recurring_interval: null,
      }
      const price1 = createFixedPrice({
        id: 'price_1',
        product_id: 'prod_1',
      })
      const price2 = createFixedPrice({
        id: 'price_2',
        product_id: 'prod_2',
      })

      const checkout = createCheckout({
        product: product1,
        product_price: price1,
        products: [product1, product2],
        prices: {
          prod_1: [price1],
          prod_2: [price2],
        },
      })

      render(
        <CheckoutProductSwitcher
          checkout={checkout}
          update={noopUpdate}
          themePreset={themePreset}
          locale="en"
        />,
      )

      const descriptions = screen.getAllByText('One-time purchase')
      expect(descriptions.length).toBe(2)
    })

    it('shows billing description for monthly recurring products', () => {
      const product1 = {
        ...createCheckout().product,
        id: 'prod_1',
        name: 'Monthly',
        recurring_interval: 'month' as const,
        recurring_interval_count: 1,
        is_recurring: true,
        meter_interval: null,
        meter_interval_count: null,
      }
      const product2 = {
        ...createCheckout().product,
        id: 'prod_2',
        name: 'Yearly',
        recurring_interval: 'year' as const,
        recurring_interval_count: 1,
        is_recurring: true,
        meter_interval: null,
        meter_interval_count: null,
      }
      const price1 = createFixedPrice({
        id: 'price_1',
        product_id: 'prod_1',
      })
      const price2 = createFixedPrice({
        id: 'price_2',
        product_id: 'prod_2',
      })

      const checkout = createCheckout({
        product: product1,
        product_price: price1,
        products: [product1, product2],
        prices: {
          prod_1: [price1],
          prod_2: [price2],
        },
      })

      render(
        <CheckoutProductSwitcher
          checkout={checkout}
          update={noopUpdate}
          themePreset={themePreset}
          locale="en"
        />,
      )

      expect(screen.getByText(/billed monthly/i)).toBeInTheDocument()
      expect(screen.getByText(/billed yearly/i)).toBeInTheDocument()
    })
  })

  describe('seat-based price shows netAmount when selected', () => {
    it('shows computed amount for selected seat-based product', () => {
      const seatPrice = createSeatBasedPrice({ id: 'price_seat' })
      const product1 = {
        ...createCheckout().product,
        id: 'prod_1',
        name: 'Seat Product',
      }
      const product2 = {
        ...createCheckout().product,
        id: 'prod_2',
        name: 'Other Product',
      }
      const fixedPrice = createFixedPrice({
        id: 'price_2',
        product_id: 'prod_2',
        price_amount: 549,
      })

      const checkout = createCheckout({
        product: product1,
        product_price: seatPrice,
        net_amount: 3147,
        total_amount: 3147,
        products: [product1, product2],
        prices: {
          prod_1: [seatPrice],
          prod_2: [fixedPrice],
        },
      })

      render(
        <CheckoutProductSwitcher
          checkout={checkout}
          update={noopUpdate}
          themePreset={themePreset}
          locale="en"
        />,
      )

      expect(screen.getByText('$31.47')).toBeInTheDocument()

      expect(screen.getByText('$5.49')).toBeInTheDocument()
    })
  })

  describe('product with metered and seat-based prices', () => {
    const teamProduct = {
      ...createCheckout().product,
      id: 'prod_team',
      name: 'Team',
    }
    const starterProduct = {
      ...createCheckout().product,
      id: 'prod_starter',
      name: 'Starter',
    }
    const meteredPrice = createMeteredPrice({
      id: 'price_metered',
      product_id: 'prod_team',
    })
    const seatPrice = createSeatBasedPrice({
      id: 'price_seat',
      product_id: 'prod_team',
    })
    const starterPrice = createFixedPrice({
      id: 'price_starter',
      product_id: 'prod_starter',
      price_amount: 1900,
    })
    const prices = {
      prod_team: [meteredPrice, seatPrice],
      prod_starter: [starterPrice],
    }

    const renderSwitcher = (checkout: ProductCheckoutPublic) =>
      render(
        <CheckoutProductSwitcher
          checkout={checkout}
          update={noopUpdate}
          themePreset={themePreset}
          locale="en"
        />,
      )

    it('checks the selected product and shows its seat price', () => {
      renderSwitcher(
        createCheckout({
          product: teamProduct,
          product_id: 'prod_team',
          product_price: seatPrice,
          net_amount: 1000,
          products: [teamProduct, starterProduct],
          prices,
        }),
      )

      const [teamRadio, starterRadio] = screen.getAllByRole('radio')
      expect(teamRadio).toBeChecked()
      expect(starterRadio).not.toBeChecked()
      expect(screen.getByText('$10')).toBeInTheDocument()
      expect(screen.queryByText(/unit/)).not.toBeInTheDocument()
    })

    it('shows the seat price when the product is not selected', () => {
      renderSwitcher(
        createCheckout({
          product: starterProduct,
          product_id: 'prod_starter',
          product_price: starterPrice,
          products: [teamProduct, starterProduct],
          prices,
        }),
      )

      const [teamRadio, starterRadio] = screen.getAllByRole('radio')
      expect(teamRadio).not.toBeChecked()
      expect(starterRadio).toBeChecked()
      expect(screen.getByText(/From/)).toHaveTextContent('From $10')
      expect(screen.queryByText(/unit/)).not.toBeInTheDocument()
    })
  })
})
