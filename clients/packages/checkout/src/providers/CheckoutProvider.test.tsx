import { act, render, screen, waitFor } from '@testing-library/react'
import { useEffect } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createCheckout } from '../test-utils/makeCheckout'

const { mockClient, mockCreateClient } = vi.hoisted(() => ({
  mockClient: {
    GET: vi.fn(),
    POST: vi.fn(),
    PATCH: vi.fn(),
  },
  mockCreateClient: vi.fn(),
}))

vi.mock('@polar-sh/client', async () => {
  const actual =
    await vi.importActual<typeof import('@polar-sh/client')>('@polar-sh/client')
  return {
    ...actual,
    createClient: mockCreateClient,
  }
})

import {
  CheckoutProvider,
  useCheckout,
  type CheckoutContextProps,
} from './CheckoutProvider'

const ok = (data: unknown) => ({
  data,
  error: undefined,
  response: new Response(null, { status: 200 }),
})

const fail = (error: { error: string; detail: unknown }, status = 422) => ({
  data: undefined,
  error,
  response: new Response(null, { status }),
})

const renderProvider = (
  props: Partial<React.ComponentProps<typeof CheckoutProvider>> = {},
) => {
  const ctxRef: { current: CheckoutContextProps | null } = { current: null }

  const Capture = () => {
    const ctx = useCheckout()
    useEffect(() => {
      ctxRef.current = ctx
    })
    return <div data-testid="ready" />
  }

  render(
    <CheckoutProvider clientSecret="cs_test" {...props}>
      <Capture />
    </CheckoutProvider>,
  )

  return () => ctxRef.current!
}

describe('CheckoutProvider', () => {
  beforeEach(() => {
    mockClient.GET.mockReset()
    mockClient.POST.mockReset()
    mockClient.PATCH.mockReset()
    mockCreateClient.mockReset()
    mockCreateClient.mockImplementation(() => mockClient)
  })

  describe('baseUrl resolution', () => {
    it('uses production by default', () => {
      renderProvider({ initialCheckout: createCheckout() })
      expect(mockCreateClient).toHaveBeenCalledWith('https://api.polar.sh')
    })

    it('uses sandbox when server=sandbox', () => {
      renderProvider({ server: 'sandbox', initialCheckout: createCheckout() })
      expect(mockCreateClient).toHaveBeenCalledWith(
        'https://sandbox-api.polar.sh',
      )
    })

    it('uses production when server=production', () => {
      renderProvider({
        server: 'production',
        initialCheckout: createCheckout(),
      })
      expect(mockCreateClient).toHaveBeenCalledWith('https://api.polar.sh')
    })

    it('uses serverURL when provided (stripping trailing /v1)', () => {
      renderProvider({
        serverURL: 'https://custom.example.com/v1',
        initialCheckout: createCheckout(),
      })
      expect(mockCreateClient).toHaveBeenCalledWith(
        'https://custom.example.com',
      )
    })

    it('uses serverURL verbatim when it has no /v1 suffix', () => {
      renderProvider({
        serverURL: 'https://custom.example.com',
        initialCheckout: createCheckout(),
      })
      expect(mockCreateClient).toHaveBeenCalledWith(
        'https://custom.example.com',
      )
    })
  })

  describe('initial render', () => {
    it('renders children immediately when initialCheckout is provided', () => {
      const initialCheckout = createCheckout({ id: 'ch_initial' })
      const getCtx = renderProvider({ initialCheckout })

      expect(screen.getByTestId('ready')).toBeInTheDocument()
      expect(getCtx().checkout.id).toBe('ch_initial')
      expect(mockClient.GET).not.toHaveBeenCalled()
    })

    it('fetches the checkout and renders children once it resolves', async () => {
      const fetched = createCheckout({ id: 'ch_fetched' })
      mockClient.GET.mockResolvedValue(ok(fetched))

      const getCtx = renderProvider()

      await waitFor(() => {
        expect(screen.getByTestId('ready')).toBeInTheDocument()
      })
      expect(getCtx().checkout.id).toBe('ch_fetched')
      expect(mockClient.GET).toHaveBeenCalledWith(
        '/v1/checkouts/client/{client_secret}',
        { params: { path: { client_secret: 'cs_test' } } },
      )
    })
  })

  describe('refresh', () => {
    it('calls GET and updates the checkout on success', async () => {
      const initialCheckout = createCheckout({ id: 'ch_initial' })
      const refreshed = createCheckout({ id: 'ch_refreshed' })
      mockClient.GET.mockResolvedValue(ok(refreshed))

      const getCtx = renderProvider({ initialCheckout })

      await act(async () => {
        const result = await getCtx().refresh()
        expect(result.ok).toBe(true)
      })

      expect(getCtx().checkout.id).toBe('ch_refreshed')
    })

    it('returns an error Result when the API rejects', async () => {
      const initialCheckout = createCheckout({ id: 'ch_initial' })
      mockClient.GET.mockResolvedValue(
        fail({ error: 'ResourceNotFound', detail: 'not found' }, 404),
      )

      const getCtx = renderProvider({ initialCheckout })

      await act(async () => {
        const result = await getCtx().refresh()
        expect(result.ok).toBe(false)
      })

      expect(getCtx().checkout.id).toBe('ch_initial')
    })
  })

  describe('update', () => {
    it('calls PATCH and updates the checkout on success', async () => {
      const initialCheckout = createCheckout({ id: 'ch_initial' })
      const updated = createCheckout({ id: 'ch_updated' })
      mockClient.PATCH.mockResolvedValue(ok(updated))

      const getCtx = renderProvider({ initialCheckout })

      await act(async () => {
        const result = await getCtx().update({
          customer_email: 'a@b.com',
        })
        expect(result.ok).toBe(true)
      })

      expect(getCtx().checkout.id).toBe('ch_updated')
      expect(mockClient.PATCH).toHaveBeenCalledWith(
        '/v1/checkouts/client/{client_secret}',
        expect.objectContaining({
          params: { path: { client_secret: 'cs_test' } },
          body: { customer_email: 'a@b.com' },
        }),
      )
    })

    it('returns an error Result when the API rejects', async () => {
      const initialCheckout = createCheckout({ id: 'ch_initial' })
      mockClient.PATCH.mockResolvedValue(
        fail({
          error: 'PolarRequestValidationError',
          detail: [
            {
              type: 'value_error',
              loc: ['body', 'customer_email'],
              msg: 'Invalid',
              input: 'bad',
            },
          ],
        }),
      )

      const getCtx = renderProvider({ initialCheckout })

      await act(async () => {
        const result = await getCtx().update({ customer_email: 'bad' })
        expect(result.ok).toBe(false)
        if (!result.ok && result.error) {
          expect(result.error.error).toBe('PolarRequestValidationError')
        }
      })

      expect(getCtx().checkout.id).toBe('ch_initial')
    })
  })

  describe('confirm', () => {
    it('calls POST and updates the checkout on success', async () => {
      const initialCheckout = createCheckout({ id: 'ch_initial' })
      const confirmed = createCheckout({ id: 'ch_confirmed' })
      mockClient.POST.mockResolvedValue(ok(confirmed))

      const getCtx = renderProvider({ initialCheckout })

      await act(async () => {
        const result = await getCtx().confirm({
          customer_email: 'a@b.com',
        } as Parameters<CheckoutContextProps['confirm']>[0])
        expect(result.ok).toBe(true)
      })

      expect(getCtx().checkout.id).toBe('ch_confirmed')
      expect(mockClient.POST).toHaveBeenCalledWith(
        '/v1/checkouts/client/{client_secret}/confirm',
        expect.objectContaining({
          params: { path: { client_secret: 'cs_test' } },
        }),
      )
    })

    it('returns an error Result when the API rejects', async () => {
      const initialCheckout = createCheckout({ id: 'ch_initial' })
      mockClient.POST.mockResolvedValue(
        fail({ error: 'PaymentError', detail: 'card declined' }, 400),
      )

      const getCtx = renderProvider({ initialCheckout })

      await act(async () => {
        const result = await getCtx().confirm({
          customer_email: 'a@b.com',
        } as Parameters<CheckoutContextProps['confirm']>[0])
        expect(result.ok).toBe(false)
        if (!result.ok && result.error) {
          expect(result.error.error).toBe('PaymentError')
        }
      })

      expect(getCtx().checkout.id).toBe('ch_initial')
    })
  })
})
