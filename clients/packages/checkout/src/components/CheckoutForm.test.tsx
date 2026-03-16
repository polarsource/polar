import type { schemas } from '@polar-sh/client'
import type { ThemingPresetProps } from '@polar-sh/ui/hooks/theming'
import { render, screen } from '@testing-library/react'
import { useForm } from 'react-hook-form'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { createCheckout } from '../test-utils/makeCheckout'
import CheckoutForm from './CheckoutForm'

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any
})

function FormWrapper({
  checkout,
  ...props
}: Omit<Parameters<typeof CheckoutForm>[0], 'form'>) {
  const form = useForm<schemas['CheckoutUpdatePublic']>({
    defaultValues: { customer_email: '' },
  })
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

      expect(screen.getByText(/This is a one-time charge/)).toBeInTheDocument()
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
})
