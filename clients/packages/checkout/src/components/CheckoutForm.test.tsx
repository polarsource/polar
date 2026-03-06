import type { CheckoutUpdatePublic } from '@polar-sh/sdk/models/components/checkoutupdatepublic'
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
  } as any
})

function FormWrapper({
  checkout,
  ...props
}: Omit<Parameters<typeof CheckoutForm>[0], 'form'>) {
  const form = useForm<CheckoutUpdatePublic>({
    defaultValues: { customerEmail: '' },
  })
  return <CheckoutForm form={form} checkout={checkout} {...props} />
}

const defaultProps = {
  update: vi.fn(async () => createCheckout()),
  confirm: vi.fn(async () => ({
    ...createCheckout(),
    status: 'confirmed' as const,
    customerSessionToken: '',
  })),
  loading: false,
  loadingLabel: undefined,
  themePreset: {} as any,
}

const recurringProduct = {
  id: 'prod_1',
  name: 'Test',
  recurringInterval: 'month' as const,
  recurringIntervalCount: null,
  isRecurring: true,
  trialInterval: null,
  trialIntervalCount: null,
  visibility: 'public' as const,
  prices: [],
  benefits: [],
  medias: [],
  description: null,
  isArchived: false,
  organizationId: 'org_1',
  createdAt: new Date(),
  modifiedAt: null,
}

describe('CheckoutForm', () => {
  describe('CTA button label', () => {
    it('shows "Start trial" when trial is active', () => {
      const checkout = createCheckout({
        paymentProcessor: 'dummy' as any,
        activeTrialInterval: 'month',
        activeTrialIntervalCount: 1,
        isPaymentFormRequired: true,
        product: {
          ...recurringProduct,
          trialInterval: 'month',
          trialIntervalCount: 1,
        },
      })

      render(<FormWrapper checkout={checkout} {...defaultProps} locale="en" />)

      expect(
        screen.getByRole('button', { name: 'Start trial' }),
      ).toBeInTheDocument()
    })

    it('shows "Subscribe now" for recurring paid product', () => {
      const checkout = createCheckout({
        paymentProcessor: 'dummy' as any,
        isPaymentFormRequired: true,
        product: recurringProduct,
      })

      render(<FormWrapper checkout={checkout} {...defaultProps} locale="en" />)

      expect(
        screen.getByRole('button', { name: 'Subscribe now' }),
      ).toBeInTheDocument()
    })

    it('shows "Pay now" for one-time paid product', () => {
      const checkout = createCheckout({
        paymentProcessor: 'dummy' as any,
        isPaymentFormRequired: true,
      })

      render(<FormWrapper checkout={checkout} {...defaultProps} locale="en" />)

      expect(
        screen.getByRole('button', { name: 'Pay now' }),
      ).toBeInTheDocument()
    })

    it('shows "Get for free" when payment is not required', () => {
      const checkout = createCheckout({
        paymentProcessor: 'dummy' as any,
        isPaymentFormRequired: false,
        isPaymentRequired: false,
        isFreeProductPrice: true,
        amount: 0,
        totalAmount: 0,
        netAmount: 0,
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
        paymentProcessor: 'dummy' as any,
        isPaymentFormRequired: true,
        activeTrialInterval: 'month',
        activeTrialIntervalCount: 1,
      })

      render(<FormWrapper checkout={checkout} {...defaultProps} locale="en" />)

      expect(
        screen.getByText(/at the end of your trial period/),
      ).toBeInTheDocument()
    })

    it('shows subscription mandate for recurring product', () => {
      const checkout = createCheckout({
        paymentProcessor: 'dummy' as any,
        isPaymentFormRequired: true,
        product: recurringProduct,
      })

      render(<FormWrapper checkout={checkout} {...defaultProps} locale="en" />)

      expect(
        screen.getByText(/on each subsequent billing date until you cancel/),
      ).toBeInTheDocument()
    })

    it('shows one-time mandate for one-time product', () => {
      const checkout = createCheckout({
        paymentProcessor: 'dummy' as any,
        isPaymentFormRequired: true,
      })

      render(<FormWrapper checkout={checkout} {...defaultProps} locale="en" />)

      expect(screen.getByText(/This is a one-time charge/)).toBeInTheDocument()
    })

    it('shows merchant of record text for free product', () => {
      const checkout = createCheckout({
        paymentProcessor: 'dummy' as any,
        isPaymentFormRequired: false,
        isPaymentRequired: false,
        isFreeProductPrice: true,
        amount: 0,
        totalAmount: 0,
        netAmount: 0,
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
        paymentProcessor: 'dummy' as any,
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
