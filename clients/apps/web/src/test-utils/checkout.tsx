import CheckoutPage from '@/app/(checkout)/checkout/[clientSecret]/CheckoutPage'
import { CheckoutConfirmation } from '@/components/Checkout/CheckoutConfirmation'
import type { ProductCheckoutPublic } from '@polar-sh/checkout/guards'
import {
  CheckoutFormProvider,
  CheckoutProvider,
} from '@polar-sh/checkout/providers'
import {
  createCheckout,
  createFreePrice,
  createSeatBasedPrice,
} from '@polar-sh/checkout/test-utils'
import type { schemas } from '@polar-sh/client'
import { fireEvent, screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import {
  renderWithProviders,
  type ProviderOptions,
  type ProvidersRenderResult,
} from './render'
import { API_URL, server } from './server'

export const CLIENT_SECRET = 'polar_c_test'
export const CHECKOUT_URL = `http://localhost:3000/checkout/${CLIENT_SECRET}`
export const DISTINCT_ID = 'distinct_test'
export const CUSTOMER_SESSION_TOKEN = 'cst_test'

type CheckoutDiscount = NonNullable<ProductCheckoutPublic['discount']>

export const createWebCheckout = (
  overrides: Partial<ProductCheckoutPublic> = {},
): ProductCheckoutPublic => {
  const base = createCheckout()
  const checkout = createCheckout({
    client_secret: CLIENT_SECRET,
    url: CHECKOUT_URL,
    success_url: `${CHECKOUT_URL}/confirmation`,
    payment_processor: 'stripe',
    payment_processor_metadata: { publishable_key: 'pk_test_polar' },
    organization: {
      ...base.organization,
      name: 'Polar Penguin',
      slug: 'polar-penguin',
    },
    ...overrides,
  })
  if (!overrides.products) {
    checkout.products = [checkout.product]
  }
  return checkout
}

export const freeProductCheckout = (): Partial<ProductCheckoutPublic> => ({
  product_price: createFreePrice(),
  amount: 0,
  discount_amount: 0,
  net_amount: 0,
  total_amount: 0,
  is_free_product_price: true,
  is_payment_required: false,
  is_payment_form_required: false,
  is_payment_setup_required: false,
  customer_email: 'jane@example.com',
})

export const percentageDiscount = (
  code: string,
  basisPoints: number,
): schemas['CheckoutDiscountPercentageOnceForeverDuration'] => ({
  id: `discount_${code}`,
  name: `${basisPoints / 100}% off`,
  code,
  type: 'percentage',
  duration: 'forever',
  basis_points: basisPoints,
})

const withDiscount = (
  checkout: ProductCheckoutPublic,
  discount: CheckoutDiscount | null,
): ProductCheckoutPublic => {
  const discountAmount = !discount
    ? 0
    : 'basis_points' in discount
      ? Math.round((checkout.amount * discount.basis_points) / 10000)
      : Math.min(discount.amount, checkout.amount)
  const netAmount = checkout.amount - discountAmount
  return {
    ...checkout,
    discount,
    discount_amount: discountAmount,
    net_amount: netAmount,
    total_amount: netAmount + (checkout.tax_amount ?? 0),
  }
}

export const paymentReady: schemas['OrganizationPaymentStatus'] = {
  payment_ready: true,
  organization_status: 'active',
  onboarding_resubmission_requested_at: null,
}

export interface ApiRequest {
  method: string
  path: string
  body: unknown
  authorization: string | null
}

type UpdateResponder = (
  body: schemas['CheckoutUpdatePublic'],
  checkout: ProductCheckoutPublic,
) => ProductCheckoutPublic | Response

type ConfirmResponder = (
  body: schemas['CheckoutConfirmStripe'],
  checkout: ProductCheckoutPublic,
) => schemas['CheckoutPublicConfirmed'] | Response

export interface StreamEvent {
  key: string
  payload: Record<string, unknown>
}

export const FULFILLED: StreamEvent[] = [
  { key: 'checkout.updated', payload: { status: 'succeeded' } },
  { key: 'checkout.order_created', payload: {} },
  { key: 'checkout.webhook_event_delivered', payload: { status: 'succeeded' } },
]

type SeatAssignResponder = (body: {
  email: string
  checkout_id: string
  immediate_claim: boolean
}) => Record<string, unknown> | Response

export interface CheckoutApi {
  readonly checkout: ProductCheckoutPublic
  readonly requests: ApiRequest[]
  set: (changes: Partial<ProductCheckoutPublic>) => void
  onUpdate: (respond: UpdateResponder) => void
  onConfirm: (respond: ConfirmResponder) => void
  onAssignSeat: (respond: SeatAssignResponder) => void
  grantBenefits: (grants: schemas['CustomerBenefitGrant'][]) => void
  emitCheckoutEvent: (event: StreamEvent) => void
  emitCustomerEvent: (event: StreamEvent) => void
}

export interface ServeCheckoutOptions {
  paymentStatus?: schemas['OrganizationPaymentStatus']
  discounts?: Record<string, CheckoutDiscount>
  fulfillment?: StreamEvent[]
  benefitGrants?: schemas['CustomerBenefitGrant'][]
}

const validationError = (field: string, message: string) =>
  HttpResponse.json(
    {
      error: 'PolarRequestValidationError',
      detail: [
        {
          loc: ['body', field],
          msg: message,
          type: 'value_error',
          input: null,
        },
      ],
    },
    { status: 422 },
  )

const createEventStream = (initialEvents: StreamEvent[]) => {
  const encoder = new TextEncoder()
  const connections = new Set<ReadableStreamDefaultController<Uint8Array>>()
  const encode = (event: StreamEvent) =>
    encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
  return {
    respond: () => {
      let connection: ReadableStreamDefaultController<Uint8Array> | undefined
      return new HttpResponse(
        new ReadableStream<Uint8Array>({
          start(controller) {
            connection = controller
            connections.add(controller)
            initialEvents.forEach((event) => controller.enqueue(encode(event)))
          },
          cancel() {
            if (connection) {
              connections.delete(connection)
            }
          },
        }),
        { headers: { 'Content-Type': 'text/event-stream' } },
      )
    },
    push: (event: StreamEvent) => {
      connections.forEach((controller) => controller.enqueue(encode(event)))
    },
  }
}

export const serveCheckout = (
  initial: ProductCheckoutPublic,
  {
    paymentStatus = paymentReady,
    discounts = {},
    fulfillment = FULFILLED,
    benefitGrants = [],
  }: ServeCheckoutOptions = {},
): CheckoutApi => {
  let current = initial
  let grants = benefitGrants
  const requests: ApiRequest[] = []
  const checkoutStream = createEventStream(fulfillment)
  const customerStream = createEventStream([])

  let respondToUpdate: UpdateResponder = (body, checkout) => {
    const { discount_code, ...fields } = body
    let next: ProductCheckoutPublic = {
      ...checkout,
      ...Object.fromEntries(
        Object.entries(fields).filter(([key]) => key in checkout),
      ),
    }
    if (discount_code === null) {
      next = withDiscount(next, null)
    } else if (discount_code !== undefined) {
      const discount = discounts[discount_code]
      if (!discount) {
        return validationError('discount_code', 'Discount code is invalid')
      }
      next = withDiscount(next, discount)
    }
    return next
  }

  let respondToConfirm: ConfirmResponder = (_body, checkout) => ({
    ...checkout,
    status: 'confirmed',
    customer_session_token: CUSTOMER_SESSION_TOKEN,
  })

  let respondToAssignSeat: SeatAssignResponder = () => ({})

  const record = async (request: Request) => {
    const body =
      request.method === 'GET'
        ? undefined
        : await request
            .clone()
            .json()
            .catch(() => undefined)
    requests.push({
      method: request.method,
      path: new URL(request.url).pathname,
      body,
      authorization: request.headers.get('authorization'),
    })
    return body
  }

  server.use(
    http.get(`${API_URL}/v1/checkouts/client/:secret`, async ({ request }) => {
      await record(request)
      return HttpResponse.json(current)
    }),
    http.patch(
      `${API_URL}/v1/checkouts/client/:secret`,
      async ({ request }) => {
        const body = await record(request)
        const result = respondToUpdate(body, current)
        if (result instanceof Response) return result
        current = result
        return HttpResponse.json(current)
      },
    ),
    http.post(
      `${API_URL}/v1/checkouts/client/:secret/confirm`,
      async ({ request }) => {
        const body = await record(request)
        const result = respondToConfirm(body, current)
        if (result instanceof Response) return result
        current = { ...current, status: result.status }
        return HttpResponse.json(result)
      },
    ),
    http.post(
      `${API_URL}/v1/checkouts/client/:secret/opened`,
      async ({ request }) => {
        await record(request)
        return new HttpResponse(null, { status: 204 })
      },
    ),
    http.get(`${API_URL}/v1/checkouts/client/:secret/stream`, () =>
      checkoutStream.respond(),
    ),
    http.get(`${API_URL}/v1/customer-portal/customers/stream`, () =>
      customerStream.respond(),
    ),
    http.get(
      `${API_URL}/v1/customer-portal/benefit-grants/`,
      async ({ request }) => {
        await record(request)
        return HttpResponse.json({
          items: grants,
          pagination: { total_count: grants.length, max_page: 1 },
        })
      },
    ),
    http.post(`${API_URL}/v1/customer-portal/seats`, async ({ request }) => {
      const body = await record(request)
      const result = respondToAssignSeat(body)
      if (result instanceof Response) return result
      return HttpResponse.json(result)
    }),
    http.get(
      `${API_URL}/v1/organizations/:id/payment-status`,
      async ({ request }) => {
        await record(request)
        return HttpResponse.json(paymentStatus)
      },
    ),
  )

  return {
    get checkout() {
      return current
    },
    requests,
    set: (changes) => {
      current = { ...current, ...changes }
    },
    onUpdate: (respond) => {
      respondToUpdate = respond
    },
    onConfirm: (respond) => {
      respondToConfirm = respond
    },
    onAssignSeat: (respond) => {
      respondToAssignSeat = respond
    },
    grantBenefits: (next) => {
      grants = next
    },
    emitCheckoutEvent: checkoutStream.push,
    emitCustomerEvent: customerStream.push,
  }
}

export interface CheckoutRenderResult extends ProvidersRenderResult {
  api: CheckoutApi
  checkout: ProductCheckoutPublic
}

export interface RenderCheckoutOptions
  extends ProviderOptions, ServeCheckoutOptions {
  checkout?: Partial<ProductCheckoutPublic>
  embed?: boolean
  theme?: 'light' | 'dark'
  distinctId?: string | null
}

export const renderCheckout = ({
  checkout: overrides,
  embed = false,
  theme = 'light',
  distinctId = DISTINCT_ID,
  paymentStatus,
  discounts,
  fulfillment,
  benefitGrants,
  ...providerOptions
}: RenderCheckoutOptions = {}): CheckoutRenderResult => {
  const checkout = createWebCheckout(overrides)
  const api = serveCheckout(checkout, {
    paymentStatus,
    discounts,
    fulfillment,
    benefitGrants,
  })
  document.cookie = distinctId
    ? `polar_distinct_id=${distinctId}; path=/`
    : 'polar_distinct_id=; max-age=0; path=/'

  const result = renderWithProviders(
    <CheckoutProvider
      clientSecret={checkout.client_secret}
      initialCheckout={checkout}
      serverURL={API_URL}
    >
      <CheckoutFormProvider locale="en">
        <CheckoutPage embed={embed} theme={theme} locale="en" />
      </CheckoutFormProvider>
    </CheckoutProvider>,
    {
      pathname: `/checkout/${checkout.client_secret}`,
      searchParams: embed ? 'embed=true' : '',
      ...providerOptions,
    },
  )

  return { ...result, api, checkout }
}

export const applyDiscountCode = (code: string) => {
  const toggle = screen.queryByRole('button', { name: 'Add discount code' })
  if (toggle) {
    fireEvent.click(toggle)
  }
  const input = screen.getByPlaceholderText('Discount code')
  fireEvent.change(input, { target: { value: code } })
  fireEvent.keyDown(input, { key: 'Enter' })
  return input
}

export const submitCheckout = (label: string | RegExp) =>
  fireEvent.click(screen.getByRole('button', { name: label }))

export const getDiscountCodeButton = (): HTMLButtonElement => {
  let container = screen.getByPlaceholderText('Discount code').parentElement
  while (container && !container.querySelector('button')) {
    container = container.parentElement
  }
  const button = container?.querySelector('button')
  if (!button) {
    throw new Error('No button rendered next to the discount code input')
  }
  return button
}

export const seatBasedCheckout = (
  seats: number,
): Partial<ProductCheckoutPublic> => ({
  id: 'checkout_1',
  product_price: createSeatBasedPrice(),
  seats,
})

export const customBenefit = {
  id: 'benefit_1',
  type: 'custom',
  description: 'Community access',
  created_at: '2026-01-01T00:00:00Z',
  modified_at: null,
  organization_id: 'org_1',
  selectable: true,
  deletable: true,
  metadata: {},
  properties: { note: 'Welcome aboard!' },
} as unknown as ProductCheckoutPublic['product']['benefits'][number]

export const createBenefitGrant = (
  overrides: Record<string, unknown> = {},
): schemas['CustomerBenefitGrant'] =>
  ({
    id: 'grant_1',
    created_at: '2026-01-01T00:00:00Z',
    modified_at: null,
    granted_at: '2026-01-01T00:00:00Z',
    revoked_at: null,
    customer_id: 'customer_1',
    member_id: null,
    benefit_id: customBenefit.id,
    subscription_id: null,
    order_id: 'order_1',
    is_granted: true,
    is_revoked: false,
    customer: {
      id: 'customer_1',
      email: 'jane@example.com',
      name: 'Jane',
      oauth_accounts: {},
    },
    benefit: customBenefit,
    properties: {},
    ...overrides,
  }) as unknown as schemas['CustomerBenefitGrant']

export interface RenderConfirmationOptions
  extends ProviderOptions, ServeCheckoutOptions {
  checkout?: Partial<ProductCheckoutPublic>
  embed?: boolean
  theme?: 'light' | 'dark'
  customerSessionToken?: string
  disabled?: boolean
}

export const renderConfirmation = ({
  checkout: overrides,
  embed = false,
  theme = 'light',
  customerSessionToken = CUSTOMER_SESSION_TOKEN,
  disabled,
  paymentStatus,
  discounts,
  fulfillment,
  benefitGrants,
  ...providerOptions
}: RenderConfirmationOptions = {}): CheckoutRenderResult => {
  const checkout = createWebCheckout({ status: 'succeeded', ...overrides })
  const api = serveCheckout(checkout, {
    paymentStatus,
    discounts,
    fulfillment,
    benefitGrants,
  })

  const result = renderWithProviders(
    <CheckoutConfirmation
      checkout={checkout}
      embed={embed}
      theme={theme}
      locale="en"
      customerSessionToken={customerSessionToken}
      disabled={disabled}
    />,
    {
      pathname: `/checkout/${checkout.client_secret}/confirmation`,
      searchParams: `customer_session_token=${customerSessionToken}`,
      ...providerOptions,
    },
  )

  return { ...result, api, checkout }
}
