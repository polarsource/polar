import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createCheckout } from '@polar-sh/checkout/test-utils'
import type { ProductCheckoutPublic } from '@polar-sh/checkout/guards'
import CheckoutBenefits from './CheckoutBenefits'

vi.mock('@/hooks/queries/customerPortal', () => ({
  useCustomerBenefitGrants: () => ({
    data: {
      items: [
        {
          id: 'grant_1',
          benefit: {
            id: 'ben_1',
            type: 'custom',
            description: 'Access to Discord',
            properties: { note: null },
          },
          properties: {},
        },
      ],
    },
    refetch: vi.fn(),
  }),
}))

vi.mock('@/hooks/sse', () => ({
  useCustomerSSE: () => ({ on: vi.fn(), off: vi.fn() }),
}))

vi.mock('@/utils/client', () => ({
  createClientSideAPI: () => ({}),
}))

describe('CheckoutBenefits', () => {
  it('renders benefit grants', () => {
    const checkout = createCheckout({
      product: {
        ...createCheckout().product,
        benefits: [
          {
            id: 'ben_1',
            type: 'custom',
            description: 'Access to Discord',
            created_at: '',
            modified_at: null,
            deletable: true,
            selectable: true,
            organization_id: 'org_1',
          },
        ],
      },
    }) as ProductCheckoutPublic

    render(<CheckoutBenefits checkout={checkout} locale="en" />)
    expect(screen.getByText('Access to Discord')).toBeInTheDocument()
  })
})
