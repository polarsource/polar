import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ProductCheckoutPublic } from '../guards'
import {
  createCheckout,
  createFixedPrice,
  createUnitBasedPrice,
} from '../test-utils/makeCheckout'
import CheckoutUnitSelector from './CheckoutUnitSelector'

const unitDefaults: Partial<ProductCheckoutPublic> = {
  amount: 3000,
  net_amount: 3000,
  tax_amount: null,
  total_amount: 3000,
  units: 3,
  min_units: null,
  max_units: null,
  product_price: createUnitBasedPrice({
    tiers: {
      type: 'volume',
      tiers: [{ bound: null, unit_amount: '1000' }],
    },
    minimum_units: 1,
    maximum_units: null,
  }),
}

function createUnitCheckout(
  overrides: Partial<ProductCheckoutPublic> = {},
): ProductCheckoutPublic {
  return createCheckout({ ...unitDefaults, ...overrides })
}

const noopUpdate = vi.fn().mockResolvedValue({} as ProductCheckoutPublic)

describe('CheckoutUnitSelector', () => {
  beforeEach(() => {
    noopUpdate.mockClear()
  })

  describe('returns null for non-unit-based pricing', () => {
    it('renders nothing for fixed price', () => {
      const checkout = createCheckout({
        product_price: createFixedPrice(),
      })

      const { container } = render(
        <CheckoutUnitSelector
          checkout={checkout}
          update={noopUpdate}
          locale="en"
        />,
      )

      expect(container.innerHTML).toBe('')
    })
  })

  describe('compact layout', () => {
    it('renders the Units label without throwing', () => {
      const checkout = createUnitCheckout()

      render(
        <CheckoutUnitSelector
          checkout={checkout}
          update={noopUpdate}
          locale="en"
          compact
        />,
      )

      expect(screen.getByText('Units')).toBeInTheDocument()
      expect(
        screen.getByLabelText('Click to edit unit count'),
      ).toHaveTextContent('3')
    })
  })

  describe('default layout', () => {
    it('shows the unit selector heading and total', () => {
      const checkout = createUnitCheckout({
        net_amount: 3000,
      })

      render(
        <CheckoutUnitSelector
          checkout={checkout}
          update={noopUpdate}
          locale="en"
        />,
      )

      expect(screen.getByText('Number of units')).toBeInTheDocument()
      expect(screen.getByTestId('headline-price')).toHaveTextContent('$30')
    })

    it('uses the merchant-defined unit label', () => {
      const price = createUnitBasedPrice({
        unit_label: { en: { '=1': 'device', other: 'devices' } },
      })
      const checkout = createUnitCheckout({
        product_price: price,
        prices: { prod_1: [price] },
      })

      render(
        <CheckoutUnitSelector
          checkout={checkout}
          update={noopUpdate}
          locale="en"
        />,
      )

      expect(screen.getByText('Number of devices')).toBeInTheDocument()
    })

    it('increments the unit quantity', async () => {
      render(
        <CheckoutUnitSelector
          checkout={createUnitCheckout()}
          update={noopUpdate}
          locale="en"
        />,
      )

      fireEvent.click(screen.getByLabelText('Increase units'))

      await waitFor(() => {
        expect(noopUpdate).toHaveBeenCalledWith({ units: 4 })
      })
    })

    it('updates a directly entered quantity', async () => {
      render(
        <CheckoutUnitSelector
          checkout={createUnitCheckout()}
          update={noopUpdate}
          locale="en"
        />,
      )

      fireEvent.click(screen.getByLabelText('Click to edit unit count'))
      const input = screen.getByRole('textbox')
      fireEvent.change(input, { target: { value: '7' } })
      fireEvent.blur(input)

      await waitFor(() => {
        expect(noopUpdate).toHaveBeenCalledWith({ units: 7 })
      })
    })
  })

  describe('compact layout with a custom label', () => {
    it('title-cases the merchant plural noun', () => {
      const price = createUnitBasedPrice({
        unit_label: { en: { '=1': 'device', other: 'devices' } },
      })
      const checkout = createUnitCheckout({
        product_price: price,
        prices: { prod_1: [price] },
      })

      render(
        <CheckoutUnitSelector
          checkout={checkout}
          update={noopUpdate}
          locale="en"
          compact
        />,
      )

      expect(screen.getByText('Devices')).toBeInTheDocument()
    })
  })
})
