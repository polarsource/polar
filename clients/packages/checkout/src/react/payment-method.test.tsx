import { cleanup, render } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { PolarPaymentMethod } from './payment-method'

const ALLOWED_ORIGIN = 'http://127.0.0.1:3000'
const CUSTOMER_SESSION_TOKEN = 'polar_cst_test_token'

beforeAll(() => {
  // @ts-expect-error - Global defined at build time by tsup
  globalThis.__POLAR_CHECKOUT_EMBED_SCRIPT_ALLOWED_ORIGINS__ = ALLOWED_ORIGIN
})

afterEach(() => {
  cleanup()
})

const post = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any,
  origin: string = ALLOWED_ORIGIN,
) => {
  window.dispatchEvent(new MessageEvent('message', { origin, data }))
}

describe('PolarPaymentMethod', () => {
  it('renders an iframe pointing at the bare embed route', () => {
    const { container } = render(
      <PolarPaymentMethod customerSessionToken={CUSTOMER_SESSION_TOKEN} />,
    )

    const iframe = container.querySelector('iframe')
    expect(iframe).not.toBeNull()

    const src = new URL(iframe!.src)
    expect(src.pathname).toBe('/embed/payment-method')
    expect(src.origin).toBe(ALLOWED_ORIGIN)
    expect(src.searchParams.get('customer_session_token')).toBe(
      CUSTOMER_SESSION_TOKEN,
    )
    expect(src.searchParams.get('embed')).toBe('true')
    expect(src.searchParams.get('embed_origin')).toBe(window.location.origin)
    expect(src.searchParams.get('mode')).toBeNull()
  })

  it('sets set_default=false when setAsDefault is explicitly false', () => {
    const { container } = render(
      <PolarPaymentMethod
        customerSessionToken={CUSTOMER_SESSION_TOKEN}
        setAsDefault={false}
      />,
    )

    const iframe = container.querySelector('iframe')!
    expect(new URL(iframe.src).searchParams.get('set_default')).toBe('false')
  })

  it('omits set_default URL param by default', () => {
    const { container } = render(
      <PolarPaymentMethod customerSessionToken={CUSTOMER_SESSION_TOKEN} />,
    )

    const iframe = container.querySelector('iframe')!
    expect(new URL(iframe.src).searchParams.get('set_default')).toBeNull()
  })

  it('uses member_session_token URL param when given a member token', () => {
    const { container } = render(
      <PolarPaymentMethod memberSessionToken="polar_mst_xyz" />,
    )

    const iframe = container.querySelector('iframe')!
    const src = new URL(iframe.src)
    expect(src.searchParams.get('member_session_token')).toBe('polar_mst_xyz')
    expect(src.searchParams.get('customer_session_token')).toBeNull()
  })

  it('sets the theme query parameter when provided', () => {
    const { container } = render(
      <PolarPaymentMethod
        customerSessionToken={CUSTOMER_SESSION_TOKEN}
        theme="dark"
      />,
    )

    const iframe = container.querySelector('iframe')!
    expect(new URL(iframe.src).searchParams.get('theme')).toBe('dark')
  })

  it('forwards lifecycle events to props', () => {
    const onLoaded = vi.fn()
    const onConfirmed = vi.fn()
    const onSuccess = vi.fn()
    const onError = vi.fn()

    render(
      <PolarPaymentMethod
        customerSessionToken={CUSTOMER_SESSION_TOKEN}
        onLoaded={onLoaded}
        onConfirmed={onConfirmed}
        onSuccess={onSuccess}
        onError={onError}
      />,
    )

    post({ type: 'POLAR_PAYMENT_METHOD', event: 'loaded' })
    expect(onLoaded).toHaveBeenCalledTimes(1)

    post({ type: 'POLAR_PAYMENT_METHOD', event: 'confirmed' })
    expect(onConfirmed).toHaveBeenCalledTimes(1)

    post({
      type: 'POLAR_PAYMENT_METHOD',
      event: 'success',
      paymentMethodId: 'pm_abc',
    })
    expect(onSuccess).toHaveBeenCalledWith('pm_abc')

    post({
      type: 'POLAR_PAYMENT_METHOD',
      event: 'error',
      code: 'unauthorized',
    })
    expect(onError).toHaveBeenCalledWith('unauthorized')
  })

  it('updates iframe height in response to resize messages', () => {
    const { container } = render(
      <PolarPaymentMethod customerSessionToken={CUSTOMER_SESSION_TOKEN} />,
    )

    post({
      type: 'POLAR_PAYMENT_METHOD',
      event: 'resize',
      height: 480.4,
    })

    const iframe = container.querySelector('iframe')!
    expect(iframe.style.height).toBe('481px')
  })

  it('ignores messages from disallowed origins', () => {
    const onSuccess = vi.fn()

    render(
      <PolarPaymentMethod
        customerSessionToken={CUSTOMER_SESSION_TOKEN}
        onSuccess={onSuccess}
      />,
    )

    post(
      {
        type: 'POLAR_PAYMENT_METHOD',
        event: 'success',
        paymentMethodId: 'pm_evil',
      },
      'https://evil.com',
    )

    expect(onSuccess).not.toHaveBeenCalled()
  })

  it('ignores messages with the wrong protocol type', () => {
    const onSuccess = vi.fn()

    render(
      <PolarPaymentMethod
        customerSessionToken={CUSTOMER_SESSION_TOKEN}
        onSuccess={onSuccess}
      />,
    )

    post({
      type: 'POLAR_CHECKOUT',
      event: 'success',
      paymentMethodId: 'pm_other',
    })

    expect(onSuccess).not.toHaveBeenCalled()
  })

  it('removes the iframe on unmount', () => {
    const { container, unmount } = render(
      <PolarPaymentMethod customerSessionToken={CUSTOMER_SESSION_TOKEN} />,
    )
    expect(container.querySelector('iframe')).not.toBeNull()

    unmount()

    expect(container.querySelector('iframe')).toBeNull()
  })

  it('uses the latest callback props without re-mounting the iframe', () => {
    const firstSuccess = vi.fn()
    const secondSuccess = vi.fn()

    const { rerender, container } = render(
      <PolarPaymentMethod
        customerSessionToken={CUSTOMER_SESSION_TOKEN}
        onSuccess={firstSuccess}
      />,
    )
    const iframe = container.querySelector('iframe')

    rerender(
      <PolarPaymentMethod
        customerSessionToken={CUSTOMER_SESSION_TOKEN}
        onSuccess={secondSuccess}
      />,
    )
    expect(container.querySelector('iframe')).toBe(iframe)

    post({
      type: 'POLAR_PAYMENT_METHOD',
      event: 'success',
      paymentMethodId: 'pm_latest',
    })

    expect(firstSuccess).not.toHaveBeenCalled()
    expect(secondSuccess).toHaveBeenCalledWith('pm_latest')
  })
})
