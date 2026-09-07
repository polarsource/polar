import { act, cleanup, render } from '@testing-library/react'
import type { Client, schemas } from '@polar-sh/client'
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import Checkout from './Checkout'

const testState = vi.hoisted(() => {
  const checkoutFormPropsRef: {
    current: Record<string, unknown> | null
  } = { current: null }

  const CheckoutFormMock = (props: Record<string, unknown>) => {
    checkoutFormPropsRef.current = props
    return null
  }

  return {
    checkoutFormPropsRef,
    CheckoutFormMock,
    updateImpl: vi.fn(),
    confirmImpl: vi.fn(),
    reloadMock: vi.fn(),
  }
})

const props = () =>
  testState.checkoutFormPropsRef.current as {
    update: (
      data: schemas['CheckoutUpdatePublic'],
    ) => Promise<schemas['CheckoutPublic']>
    confirm: (
      data: schemas['CheckoutConfirmStripe'],
      stripe: unknown,
      elements: unknown,
    ) => Promise<schemas['CheckoutPublicConfirmed']>
    loading: boolean
  }

vi.mock('@/components/Image/Image', () => ({ UploadImage: () => null }))
vi.mock('@/experiments/client', () => ({
  useExperiment: () => ({ isTreatment: false }),
}))
vi.mock('@/experiments/constants', () => ({
  DISTINCT_ID_COOKIE: 'distinct_id',
}))
vi.mock('@/hooks/checkout', () => ({
  useCheckoutConfirmedRedirect: () => vi.fn(),
}))
vi.mock('@/hooks/posthog', () => ({ usePostHog: () => ({ capture: vi.fn() }) }))
vi.mock('@/hooks/queries/org', () => ({
  useOrganizationPaymentStatus: () => ({ data: undefined }),
}))
vi.mock('@/utils/api', () => ({
  getServerURL: (path: string) => `http://localhost${path}`,
}))
vi.mock('@/utils/getResizedImage', () => ({
  getResizedImage: (url: string) => url,
}))

vi.mock('lucide-react', () => ({ ArrowLeft: () => null }))
vi.mock('next-themes', () => ({ useTheme: () => ({ resolvedTheme: 'light' }) }))
vi.mock('next/link', () => ({
  default: ({ children }: { children?: unknown }) => children,
}))

vi.mock('@polar-sh/checkout/components', () => ({
  CheckoutForm: testState.CheckoutFormMock,
  CheckoutHeroPrice: () => null,
  CheckoutPricingBreakdown: () => null,
  CheckoutProductSwitcher: () => null,
  CheckoutPWYWForm: () => null,
  CheckoutSeatSelector: () => null,
  CheckoutUnitSelector: () => null,
}))

vi.mock('@polar-sh/checkout/guards', () => ({
  hasProductCheckout: () => false,
  getSeatPrice: () => null,
  getUnitPrice: () => null,
}))

vi.mock('@polar-sh/checkout/hooks', () => ({
  useCheckoutFulfillmentListener: () => [false, undefined],
}))

vi.mock('@polar-sh/checkout/providers', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    useCheckout: () => ({ client: {} as Client }),
    useCheckoutForm: () => ({
      checkout: {
        client_secret: 'cs_test',
        product_id: 'prod_1',
        organization: {
          id: 'org_1',
          name: 'Org',
          slug: 'org',
          avatar_url: null,
        },
        active_trial_interval: null,
        active_trial_interval_count: null,
      } as schemas['CheckoutPublic'],
      form: { formState: { errors: {} } },
      update: testState.updateImpl,
      confirm: testState.confirmImpl,
      loading: false,
      loadingLabel: undefined,
      isUpdatePending: false,
    }),
  }
})

vi.mock('@polar-sh/orbit', () => ({ Alert: () => null, Avatar: () => null }))
vi.mock('@polar-sh/ui/components/atoms/ShadowBox', () => ({
  default: ({ children }: { children?: unknown }) => children,
}))
vi.mock('@polar-sh/ui/components/ui/dialog', () => {
  const Stub = () => null
  return {
    Dialog: Stub,
    DialogContent: Stub,
    DialogDescription: Stub,
    DialogHeader: Stub,
    DialogTitle: Stub,
    DialogTrigger: ({ children }: { children?: unknown }) => children,
  }
})
vi.mock('@polar-sh/ui/hooks/theming', () => ({ getThemePreset: () => ({}) }))

vi.mock('../Products/Slideshow', () => ({ Slideshow: () => null }))
vi.mock('./CheckoutDiscountInput', () => ({
  CheckoutDiscountInput: () => null,
}))
vi.mock('./CheckoutProductDescription', () => ({
  CheckoutProductDescription: () => null,
}))

const expiredBody = {
  type: 'error',
  status: 410,
  error: 'ExpiredCheckoutError',
  detail: 'This checkout session has expired.',
}

describe('Checkout expired-session reload', () => {
  beforeAll(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true }) as Response),
    )
  })

  afterAll(() => {
    vi.unstubAllGlobals()
  })

  beforeEach(() => {
    testState.updateImpl.mockReset()
    testState.confirmImpl.mockReset()
    testState.reloadMock.mockClear()
    testState.checkoutFormPropsRef.current = null
    Object.defineProperty(window, 'location', {
      value: {
        origin: 'http://localhost',
        href: 'http://localhost/checkout/cs_test',
        pathname: '/checkout/cs_test',
        reload: testState.reloadMock,
      },
      writable: true,
    })
    render(<Checkout embed theme="light" locale="en" />)
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('reloads the page when update rejects with an ExpiredCheckoutError body', async () => {
    testState.updateImpl.mockRejectedValueOnce(expiredBody)

    let settled = false
    await act(async () => {
      const p = props().update({} as schemas['CheckoutUpdatePublic'])
      p.finally(() => {
        settled = true
      })
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(testState.reloadMock).toHaveBeenCalledTimes(1)
    // The wrapper returns a never-resolving promise so callers (autosave,
    // seat/unit selectors, ...) don't run post-reload code that would flash
    // misleading errors before the navigation completes.
    expect(settled).toBe(false)
  })

  it('does not reload and rethrows when update rejects with a non-expired error', async () => {
    const paymentError = { error: 'PaymentError', detail: 'card declined' }
    testState.updateImpl.mockRejectedValueOnce(paymentError)

    let caught: unknown
    await act(async () => {
      try {
        await props().update({} as schemas['CheckoutUpdatePublic'])
      } catch (e) {
        caught = e
      }
    })

    expect(caught).toEqual(paymentError)
    expect(testState.reloadMock).not.toHaveBeenCalled()
  })

  it('does not reload when update resolves successfully', async () => {
    testState.updateImpl.mockResolvedValueOnce({
      id: 'ch_new',
    } as schemas['CheckoutPublic'])

    let result: unknown
    await act(async () => {
      result = await props().update({} as schemas['CheckoutUpdatePublic'])
    })

    expect(result).toEqual({ id: 'ch_new' })
    expect(testState.reloadMock).not.toHaveBeenCalled()
  })

  it('reloads the page and keeps the loading state on when confirm rejects with an ExpiredCheckoutError body', async () => {
    testState.confirmImpl.mockRejectedValueOnce(expiredBody)

    let settled = false
    await act(async () => {
      const p = props().confirm(
        {} as schemas['CheckoutConfirmStripe'],
        null,
        null,
      )
      p.finally(() => {
        settled = true
      })
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(testState.reloadMock).toHaveBeenCalledTimes(1)
    // setFullLoading(false) must not run: the loading indicator stays on so
    // the customer doesn't see a flash before the reload navigates.
    expect(props().loading).toBe(true)
    expect(settled).toBe(false)
  })

  it('does not reload, resets loading, and rethrows when confirm rejects with a non-expired error', async () => {
    const paymentError = { error: 'PaymentError', detail: 'card declined' }
    testState.confirmImpl.mockRejectedValueOnce(paymentError)

    let caught: unknown
    await act(async () => {
      try {
        await props().confirm(
          {} as schemas['CheckoutConfirmStripe'],
          null,
          null,
        )
      } catch (e) {
        caught = e
      }
    })

    expect(caught).toEqual(paymentError)
    expect(testState.reloadMock).not.toHaveBeenCalled()
    // setFullLoading(false) still runs for non-expired confirm errors.
    expect(props().loading).toBe(false)
  })

  it('does not reload when confirm resolves successfully', async () => {
    testState.confirmImpl.mockResolvedValueOnce({
      customer_session_token: 'tok',
    } as schemas['CheckoutPublicConfirmed'])

    let result: unknown
    await act(async () => {
      result = await props().confirm(
        {} as schemas['CheckoutConfirmStripe'],
        null,
        null,
      )
    })

    expect(result).toEqual({ customer_session_token: 'tok' })
    expect(testState.reloadMock).not.toHaveBeenCalled()
  })
})
