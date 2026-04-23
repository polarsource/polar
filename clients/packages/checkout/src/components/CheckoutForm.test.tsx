import type { schemas } from '@polar-sh/client'
import type { ThemingPresetProps } from '@polar-sh/ui/hooks/theming'
import { act, render, screen } from '@testing-library/react'
import { useEffect } from 'react'
import type { UseFormReturn } from 'react-hook-form'
import { useForm } from 'react-hook-form'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import type { ProductCheckoutPublic } from '../guards'
import { createCheckout } from '../test-utils/makeCheckout'
import CheckoutForm from './CheckoutForm'

const { mockLoadStripe, ElementsCapture, captureOptions } = vi.hoisted(() => {
  const captureOptions = vi.fn()
  const mockLoadStripe = vi.fn(() => Promise.resolve({}))
  const ElementsCapture = ({
    children,
    options,
  }: {
    children: React.ReactNode
    options: unknown
  }) => {
    captureOptions(options)
    return <>{children}</>
  }
  return { mockLoadStripe, ElementsCapture, captureOptions }
})

const lastElementsOptions = () => {
  const calls = captureOptions.mock.calls
  return calls.length ? calls[calls.length - 1][0] : null
}

vi.mock('@stripe/stripe-js', () => ({
  loadStripe: mockLoadStripe,
}))

vi.mock('@stripe/react-stripe-js', () => ({
  Elements: ElementsCapture,
  ElementsConsumer: ({
    children,
  }: {
    children: (ctx: { stripe: unknown; elements: unknown }) => React.ReactNode
  }) => <>{children({ stripe: null, elements: null })}</>,
  PaymentElement: () => (
    <div data-testid="mock-payment-element">mock payment element</div>
  ),
}))

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any
})

afterEach(() => {
  captureOptions.mockClear()
  mockLoadStripe.mockClear()
})

function FormWrapper({
  checkout,
  defaultValues,
  onForm,
  ...props
}: Omit<Parameters<typeof CheckoutForm>[0], 'form'> & {
  defaultValues?: Partial<schemas['CheckoutUpdatePublic']>
  onForm?: (form: UseFormReturn<schemas['CheckoutUpdatePublic']>) => void
}) {
  const form = useForm<schemas['CheckoutUpdatePublic']>({
    defaultValues: { customer_email: '', ...defaultValues },
  })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => onForm?.(form), [])
  return <CheckoutForm form={form} checkout={checkout} {...props} />
}

const defaultProps = {
  update: vi.fn(async () => createCheckout()),
  confirm: vi.fn(async () => ({
    ...createCheckout(),
    status: 'confirmed' as const,
    customer_session_token: '',
  })),
  loading: false,
  loadingLabel: undefined,
  themePreset: {} as ThemingPresetProps,
}

const recurringProduct = {
  id: 'prod_1',
  name: 'Test',
  recurring_interval: 'month' as const,
  recurring_interval_count: null,
  is_recurring: true,
  trial_interval: null,
  trial_interval_count: null,
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

describe('CheckoutForm', () => {
  describe('CTA button label', () => {
    it('shows "Start trial" when trial is active', () => {
      const checkout = createCheckout({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        payment_processor: 'dummy' as any,
        active_trial_interval: 'month',
        active_trial_interval_count: 1,
        is_payment_form_required: true,
        product: {
          ...recurringProduct,
          trial_interval: 'month',
          trial_interval_count: 1,
        },
      })

      render(<FormWrapper checkout={checkout} {...defaultProps} locale="en" />)

      expect(
        screen.getByRole('button', { name: 'Start trial' }),
      ).toBeInTheDocument()
    })

    it('shows "Subscribe now" for recurring paid product', () => {
      const checkout = createCheckout({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        payment_processor: 'dummy' as any,
        is_payment_form_required: true,
        product: recurringProduct,
      })

      render(<FormWrapper checkout={checkout} {...defaultProps} locale="en" />)

      expect(
        screen.getByRole('button', { name: 'Subscribe now' }),
      ).toBeInTheDocument()
    })

    it('shows "Pay now" for one-time paid product', () => {
      const checkout = createCheckout({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        payment_processor: 'dummy' as any,
        is_payment_form_required: true,
      })

      render(<FormWrapper checkout={checkout} {...defaultProps} locale="en" />)

      expect(
        screen.getByRole('button', { name: 'Pay now' }),
      ).toBeInTheDocument()
    })

    it('shows "Get for free" when payment is not required', () => {
      const checkout = createCheckout({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        payment_processor: 'dummy' as any,
        is_payment_form_required: false,
        is_payment_required: false,
        is_free_product_price: true,
        amount: 0,
        total_amount: 0,
        net_amount: 0,
      })

      render(<FormWrapper checkout={checkout} {...defaultProps} locale="en" />)

      expect(
        screen.getByRole('button', { name: 'Get for free' }),
      ).toBeInTheDocument()
    })
  })

  describe('footer mandate text', () => {
    it('shows trial mandate for trial checkout', () => {
      const checkout = createCheckout({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        payment_processor: 'dummy' as any,
        is_payment_form_required: true,
        active_trial_interval: 'month',
        active_trial_interval_count: 1,
      })

      render(<FormWrapper checkout={checkout} {...defaultProps} locale="en" />)

      expect(
        screen.getByText(/at the end of your trial period/),
      ).toBeInTheDocument()
    })

    it('shows subscription mandate for recurring product', () => {
      const checkout = createCheckout({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        payment_processor: 'dummy' as any,
        is_payment_form_required: true,
        product: recurringProduct,
      })

      render(<FormWrapper checkout={checkout} {...defaultProps} locale="en" />)

      expect(
        screen.getByText(/on each subsequent billing date until you cancel/),
      ).toBeInTheDocument()
    })

    it('shows one-time mandate for one-time product', () => {
      const checkout = createCheckout({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        payment_processor: 'dummy' as any,
        is_payment_form_required: true,
      })

      render(<FormWrapper checkout={checkout} {...defaultProps} locale="en" />)

      expect(screen.getByText(/one-time charge/)).toBeInTheDocument()
    })

    it('shows merchant of record text for free product', () => {
      const checkout = createCheckout({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        payment_processor: 'dummy' as any,
        is_payment_form_required: false,
        is_payment_required: false,
        is_free_product_price: true,
        amount: 0,
        total_amount: 0,
        net_amount: 0,
      })

      render(<FormWrapper checkout={checkout} {...defaultProps} locale="en" />)

      expect(
        screen.getByText(/online reseller & Merchant of Record/),
      ).toBeInTheDocument()
    })
  })

  describe('disabled state', () => {
    it('disables the submit button when disabled prop is true', () => {
      const checkout = createCheckout({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        payment_processor: 'dummy' as any,
      })

      render(
        <FormWrapper
          checkout={checkout}
          {...defaultProps}
          disabled={true}
          locale="en"
        />,
      )

      expect(screen.getByRole('button')).toBeDisabled()
    })
  })

  it('resets state field when country changes', async () => {
    let form: UseFormReturn<schemas['CheckoutUpdatePublic']> | null = null
    const update = vi.fn(async () => createCheckout())
    const checkout = createCheckout({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      payment_processor: 'dummy' as any,
      billing_address_fields: {
        country: 'required',
        state: 'required',
        city: 'optional',
        postal_code: 'optional',
        line1: 'optional',
        line2: 'disabled',
      },
    })

    render(
      <FormWrapper
        checkout={checkout}
        {...defaultProps}
        update={update}
        onForm={(f) => {
          form = f
        }}
        defaultValues={{
          customer_billing_address: {
            country: 'SE',
            state: 'Stockholm',
            postal_code: '12391',
            city: 'Stockholm',
            line1: 'Foo St',
          },
        }}
        locale="en"
      />,
    )

    expect(form!.getValues('customer_billing_address.state')).toBe('Stockholm')
    expect(form!.getValues('customer_billing_address.postal_code')).toBe(
      '12391',
    )
    expect(form!.getValues('customer_billing_address.city')).toBe('Stockholm')
    expect(form!.getValues('customer_billing_address.line1')).toBe('Foo St')

    await act(async () => {
      form!.setValue('customer_billing_address.country', 'US')
    })

    await act(async () => {
      await new Promise((r) => setTimeout(r, 600))
    })

    // Only state should be reset
    expect(form!.getValues('customer_billing_address.state')).toBe('')
    expect(form!.getValues('customer_billing_address.postal_code')).toBe(
      '12391',
    )
    expect(form!.getValues('customer_billing_address.city')).toBe('Stockholm')
    expect(form!.getValues('customer_billing_address.line1')).toBe('Foo St')
  })

  it('displays validation error on billing address state field', async () => {
    let form: UseFormReturn<schemas['CheckoutUpdatePublic']> | null = null
    const checkout = createCheckout({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      payment_processor: 'dummy' as any,
      billing_address_fields: {
        country: 'required',
        state: 'required',
        city: 'optional',
        postal_code: 'optional',
        line1: 'optional',
        line2: 'disabled',
      },
    })

    render(
      <FormWrapper
        checkout={checkout}
        {...defaultProps}
        onForm={(f) => {
          form = f
        }}
        defaultValues={{
          customer_billing_address: {
            country: 'US',
            state: 'California',
          },
        }}
        locale="en"
      />,
    )

    await act(async () => {
      form!.setError('customer_billing_address.state', {
        type: 'value_error',
        message: 'Invalid US state',
      })
    })

    expect(screen.getByText('Invalid US state')).toBeInTheDocument()
  })

  it('clears billing address errors when country changes', async () => {
    let form: UseFormReturn<schemas['CheckoutUpdatePublic']> | null = null
    const checkout = createCheckout({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      payment_processor: 'dummy' as any,
      billing_address_fields: {
        country: 'required',
        state: 'required',
        city: 'optional',
        postal_code: 'optional',
        line1: 'optional',
        line2: 'disabled',
      },
    })

    render(
      <FormWrapper
        checkout={checkout}
        {...defaultProps}
        onForm={(f) => {
          form = f
        }}
        defaultValues={{
          customer_billing_address: {
            country: 'US',
            state: 'California',
          },
        }}
        locale="en"
      />,
    )

    await act(async () => {
      form!.setError('customer_billing_address.state', {
        type: 'value_error',
        message: 'Invalid US state',
      })
    })

    expect(screen.getByText('Invalid US state')).toBeInTheDocument()

    await act(async () => {
      form!.setValue('customer_billing_address.country', 'CA')
    })

    await act(async () => {
      await new Promise((r) => setTimeout(r, 600))
    })

    expect(screen.queryByText('Invalid US state')).not.toBeInTheDocument()
  })

  describe('Stripe checkout form', () => {
    const stripeCheckout = (
      overrides: Partial<ProductCheckoutPublic> = {},
    ): ProductCheckoutPublic =>
      createCheckout({
        payment_processor: 'stripe',
        payment_processor_metadata: { publishable_key: 'pk_test_123' },
        ...overrides,
      })

    it('routes to StripeCheckoutForm when payment_processor is "stripe"', () => {
      render(
        <FormWrapper
          checkout={stripeCheckout()}
          {...defaultProps}
          themePreset={{ stripe: {} } as ThemingPresetProps}
          locale="en"
        />,
      )

      expect(mockLoadStripe).toHaveBeenCalledWith('pk_test_123')
      expect(screen.getByTestId('mock-payment-element')).toBeInTheDocument()
    })

    it('does not render the PaymentElement when is_payment_form_required is false', () => {
      const checkout = stripeCheckout({
        is_payment_form_required: false,
        is_payment_required: false,
        is_free_product_price: true,
        amount: 0,
        net_amount: 0,
        total_amount: 0,
      })

      render(
        <FormWrapper
          checkout={checkout}
          {...defaultProps}
          themePreset={{ stripe: {} } as ThemingPresetProps}
          locale="en"
        />,
      )

      expect(
        screen.queryByTestId('mock-payment-element'),
      ).not.toBeInTheDocument()
    })

    it('uses subscription mode when payment setup + payment are required and total > 0', () => {
      const checkout = stripeCheckout({
        is_payment_setup_required: true,
        is_payment_required: true,
        total_amount: 1500,
        currency: 'usd',
      })

      render(
        <FormWrapper
          checkout={checkout}
          {...defaultProps}
          themePreset={{ stripe: {} } as ThemingPresetProps}
          locale="en"
        />,
      )

      expect(lastElementsOptions()).toMatchObject({
        mode: 'subscription',
        setupFutureUsage: 'off_session',
        amount: 1500,
        currency: 'usd',
      })
    })

    it('uses payment mode for one-off payments', () => {
      const checkout = stripeCheckout({
        is_payment_setup_required: false,
        is_payment_required: true,
        total_amount: 999,
        currency: 'eur',
      })

      render(
        <FormWrapper
          checkout={checkout}
          {...defaultProps}
          themePreset={{ stripe: {} } as ThemingPresetProps}
          locale="en"
        />,
      )

      expect(lastElementsOptions()).toMatchObject({
        mode: 'payment',
        amount: 999,
        currency: 'eur',
      })
    })

    it('falls back to setup mode when there is no payment to take now', () => {
      const checkout = stripeCheckout({
        is_payment_setup_required: false,
        is_payment_required: false,
        total_amount: 0,
        currency: 'usd',
      })

      render(
        <FormWrapper
          checkout={checkout}
          {...defaultProps}
          themePreset={{ stripe: {} } as ThemingPresetProps}
          locale="en"
        />,
      )

      expect(lastElementsOptions()).toMatchObject({
        mode: 'setup',
        setupFutureUsage: 'off_session',
        currency: 'usd',
      })
    })

    it('passes a converted Stripe locale through Elements options', () => {
      render(
        <FormWrapper
          checkout={stripeCheckout()}
          {...defaultProps}
          themePreset={{ stripe: {} } as ThemingPresetProps}
          locale="pt-PT"
        />,
      )

      expect(lastElementsOptions()).toMatchObject({ locale: 'pt' })
    })

    it('forwards customer_session_client_secret from payment_processor_metadata', () => {
      const checkout = stripeCheckout({
        payment_processor_metadata: {
          publishable_key: 'pk_test_123',
          customer_session_client_secret: 'cs_secret_abc',
        },
      })

      render(
        <FormWrapper
          checkout={checkout}
          {...defaultProps}
          themePreset={{ stripe: {} } as ThemingPresetProps}
          locale="en"
        />,
      )

      expect(lastElementsOptions()).toMatchObject({
        customerSessionClientSecret: 'cs_secret_abc',
      })
    })
  })
})
