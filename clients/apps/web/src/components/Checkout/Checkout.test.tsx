import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createCheckout } from '@polar-sh/checkout/test-utils'
import type { schemas } from '@polar-sh/client'
import Checkout from './Checkout'

vi.mock('@/experiments/constants', () => ({
  DISTINCT_ID_COOKIE: 'test_distinct_id',
}))

vi.mock('@/hooks/checkout', () => ({
  useCheckoutConfirmedRedirect: () => vi.fn(),
}))

vi.mock('@/hooks/posthog', () => ({
  usePostHog: () => ({ capture: vi.fn() }),
}))

vi.mock('@/hooks/queries/org', () => ({
  useOrganizationPaymentStatus: () => ({
    data: { payment_ready: true, organization_status: 'active' },
  }),
}))

vi.mock('@/utils/api', () => ({
  getServerURL: () => 'https://api.example.com',
}))

const mockCheckout = createCheckout()

vi.mock('@polar-sh/checkout/hooks', () => ({
  useCheckoutFulfillmentListener: () => [vi.fn(), undefined],
}))

vi.mock('@polar-sh/checkout/providers', () => ({
  useCheckout: () => ({ client: {} }),
  useCheckoutForm: () => ({
    checkout: mockCheckout,
    form: { control: {}, watch: vi.fn(), setValue: vi.fn() },
    update: vi.fn(async (d: schemas['CheckoutUpdatePublic']) => mockCheckout),
    confirm: vi.fn(),
    loading: false,
    loadingLabel: undefined,
    isUpdatePending: false,
  }),
}))

vi.mock('next-themes', () => ({
  useTheme: () => ({ resolvedTheme: 'light' }),
}))

vi.mock('./CheckoutEmbedView', () => ({
  CheckoutEmbedView: () => <div data-testid="embed-view">Embed</div>,
}))

vi.mock('./CheckoutFullPageView', () => ({
  CheckoutFullPageView: () => <div data-testid="fullpage-view">FullPage</div>,
}))

// Mock fetch for the opened tracking call
vi.stubGlobal(
  'fetch',
  vi.fn(() => Promise.resolve()),
)

describe('Checkout', () => {
  it('renders full-page view by default', () => {
    render(<Checkout />)
    expect(screen.getByTestId('fullpage-view')).toBeInTheDocument()
  })

  it('renders embed view when embed is true', () => {
    render(<Checkout embed={true} />)
    expect(screen.getByTestId('embed-view')).toBeInTheDocument()
  })

  it('does not render embed view when embed is false', () => {
    render(<Checkout embed={false} />)
    expect(screen.queryByTestId('embed-view')).not.toBeInTheDocument()
    expect(screen.getByTestId('fullpage-view')).toBeInTheDocument()
  })
})
