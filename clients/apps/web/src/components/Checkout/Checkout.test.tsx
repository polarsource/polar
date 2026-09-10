import {
  createCheckout,
  createCustomPrice,
} from '@polar-sh/checkout/test-utils'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  applyDiscountCode,
  CHECKOUT_URL,
  CUSTOMER_SESSION_TOKEN,
  DISTINCT_ID,
  freeProductCheckout,
  renderCheckout,
  submitCheckout,
} from '@/test-utils/checkout'
import { stubLocationReload } from '@/test-utils/location'
import { apiError } from '@/test-utils/server'
import { setViewport } from '@/test-utils/viewport'

describe('Checkout page', () => {
  it('renders the product and reports the checkout as opened', async () => {
    const { api, posthog } = renderCheckout()

    expect(screen.getByText('Test Product')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /pay/i })).toBeEnabled()

    await waitFor(() =>
      expect(api.requests).toContainEqual(
        expect.objectContaining({
          method: 'POST',
          path: '/v1/checkouts/client/polar_c_test/opened',
          body: { distinct_id: DISTINCT_ID },
        }),
      ),
    )
    expect(posthog.events.map((e) => e.event)).toContain(
      'storefront:checkout:page:view',
    )
  })

  it('blocks payment when the organization has been denied', async () => {
    renderCheckout({
      paymentStatus: {
        payment_ready: false,
        organization_status: 'denied',
        onboarding_resubmission_requested_at: null,
      } as never,
    })

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /pay/i })).toBeDisabled(),
    )
    expect(
      screen.getAllByText('Payments are currently unavailable').length,
    ).toBeGreaterThan(0)
  })

  describe('collapsed order summary experiment', () => {
    const mobile = { width: 375, coarsePointer: true }
    const exposures = (
      events: { event: string; properties?: Record<string, unknown> }[],
    ) =>
      events.filter(
        (e) =>
          e.event === '$feature_flag_called' &&
          e.properties?.$feature_flag === 'checkout_collapsed_order_summary',
      )

    it('collapses the summary on mobile for the treatment and records exposure', async () => {
      setViewport(mobile)
      const { posthog } = renderCheckout({
        experiments: { checkout_collapsed_order_summary: 'treatment' },
      })

      expect(
        screen.getByRole('button', { name: /order summary/i }),
      ).toHaveAttribute('aria-expanded', 'false')
      await waitFor(() => expect(exposures(posthog.events)).toHaveLength(1))
      expect(exposures(posthog.events)[0].properties).toMatchObject({
        $feature_flag_response: 'treatment',
      })
    })

    it('records exposure for control without collapsing', async () => {
      setViewport(mobile)
      const { posthog } = renderCheckout({
        experiments: { checkout_collapsed_order_summary: 'control' },
      })

      expect(
        screen.queryByRole('button', { name: /order summary/i }),
      ).not.toBeInTheDocument()
      await waitFor(() => expect(exposures(posthog.events)).toHaveLength(1))
    })

    it('does not expose desktop visitors', async () => {
      const { posthog } = renderCheckout({
        experiments: { checkout_collapsed_order_summary: 'treatment' },
      })

      await waitFor(() =>
        expect(posthog.events.map((e) => e.event)).toContain(
          'storefront:checkout:page:view',
        ),
      )
      expect(exposures(posthog.events)).toHaveLength(0)
    })

    it('does not expose or collapse pay-what-you-want checkouts', async () => {
      setViewport(mobile)
      const { posthog } = renderCheckout({
        checkout: { product_price: createCustomPrice() },
        experiments: { checkout_collapsed_order_summary: 'treatment' },
      })

      expect(
        screen.queryByRole('button', { name: /order summary/i }),
      ).not.toBeInTheDocument()
      await waitFor(() =>
        expect(posthog.events.map((e) => e.event)).toContain(
          'storefront:checkout:page:view',
        ),
      )
      expect(exposures(posthog.events)).toHaveLength(0)
    })
  })

  it('confirms a free checkout and sends the customer to the confirmation page', async () => {
    const { api, router } = renderCheckout({ checkout: freeProductCheckout() })

    submitCheckout('Get for free')

    await waitFor(() =>
      expect(router.push).toHaveBeenCalledWith(
        `${CHECKOUT_URL}/confirmation?customer_session_token=${CUSTOMER_SESSION_TOKEN}`,
      ),
    )
    expect(api.requests).toContainEqual(
      expect.objectContaining({
        method: 'POST',
        path: '/v1/checkouts/client/polar_c_test/confirm',
      }),
    )
  })

  it('reloads the page when the checkout has expired', async () => {
    const reload = stubLocationReload()
    const { api } = renderCheckout()
    api.onUpdate(() =>
      apiError(410, 'ExpiredCheckoutError', 'The checkout has expired'),
    )

    applyDiscountCode('HALF50')

    await waitFor(() => expect(reload).toHaveBeenCalled())
  })

  it('lets free products through in test mode while explaining the limitation', async () => {
    renderCheckout({
      checkout: freeProductCheckout(),
      paymentStatus: {
        payment_ready: false,
        organization_status: 'created',
        onboarding_resubmission_requested_at: null,
      },
    })

    expect(
      (await screen.findAllByText('Polar Penguin is in test mode')).length,
    ).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'Get for free' })).toBeEnabled()
  })

  it('sends the customer to the portal login when no session comes back', async () => {
    const { api, router } = renderCheckout({ checkout: freeProductCheckout() })
    api.onConfirm((_body, checkout) => ({
      ...checkout,
      status: 'confirmed',
      customer_session_token: null,
    }))

    submitCheckout('Get for free')

    await waitFor(() =>
      expect(router.push).toHaveBeenCalledWith(
        '/polar-penguin/portal/request?email=jane%40example.com',
      ),
    )
  })

  it('redirects to a merchant success URL only after fulfillment', async () => {
    const { router } = renderCheckout({
      checkout: {
        ...freeProductCheckout(),
        success_url: 'https://merchant.example/thanks',
      },
    })

    submitCheckout('Get for free')

    await waitFor(() =>
      expect(router.push).toHaveBeenCalledWith(
        `https://merchant.example/thanks?customer_session_token=${CUSTOMER_SESSION_TOKEN}`,
      ),
    )
  })

  it('clears the submit-button loading state after an embed + external-URL success resolves without navigating', async () => {
    const { router } = renderCheckout({
      embed: true,
      checkout: {
        ...freeProductCheckout(),
        success_url: 'https://merchant.example/thanks',
      },
    })

    submitCheckout('Get for free')

    await waitFor(() => expect(router.push).not.toHaveBeenCalled())

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Get for free' }),
      ).toBeEnabled(),
    )
  })

  it('offers a gallery when the product has several images', () => {
    renderCheckout({
      checkout: {
        product: {
          ...createCheckout().product,
          medias: [
            { id: 'media_1', public_url: 'https://cdn.example/one.png' },
            { id: 'media_2', public_url: 'https://cdn.example/two.png' },
          ] as never,
        },
      },
    })

    expect(screen.getByText('+1')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('img', { name: 'Test Product' }))
    expect(screen.getByRole('dialog')).toHaveTextContent('Test Product')
  })
})
