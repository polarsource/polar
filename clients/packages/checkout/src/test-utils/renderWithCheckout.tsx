import type { Client } from '@polar-sh/client'
import type { AcceptedLocale } from '@polar-sh/i18n'
import { render } from '@testing-library/react'
import { useEffect } from 'react'
import { useFormState } from 'react-hook-form'
import { vi } from 'vitest'
import type { ProductCheckoutPublic } from '../guards'
import {
  CheckoutFormProvider,
  useCheckoutForm,
  type CheckoutFormContextProps,
} from '../providers/CheckoutFormProvider'
import {
  CheckoutContext,
  type CheckoutContextProps,
} from '../providers/CheckoutProvider'
import { createCheckout } from './makeCheckout'

type CapturedContext = CheckoutFormContextProps & {
  errors: CheckoutFormContextProps['form']['formState']['errors']
}

interface RenderWithCheckoutOptions {
  checkout?: Partial<ProductCheckoutPublic>
  update: CheckoutContextProps['update']
  confirm?: CheckoutContextProps['confirm']
  cancelPayment?: CheckoutContextProps['cancelPayment']
  locale?: AcceptedLocale
}

export const renderWithCheckout = ({
  checkout: checkoutOverrides,
  update,
  confirm = vi.fn(),
  cancelPayment = vi.fn(),
  locale,
}: RenderWithCheckoutOptions) => {
  const checkout = createCheckout({
    // oxlint-disable-next-line typescript/no-explicit-any
    payment_processor: 'dummy' as any,
    ...checkoutOverrides,
  })

  const ctxRef: { current: CapturedContext | null } = { current: null }

  const Capture = () => {
    const ctx = useCheckoutForm()
    const formState = useFormState({ control: ctx.form.control })
    useEffect(() => {
      ctxRef.current = { ...ctx, errors: formState.errors }
    })
    return null
  }

  render(
    <CheckoutContext.Provider
      value={{
        checkout,
        refresh: vi.fn(),
        update,
        confirm,
        cancelPayment,
        client: {} as Client,
      }}
    >
      <CheckoutFormProvider locale={locale}>
        <Capture />
      </CheckoutFormProvider>
    </CheckoutContext.Provider>,
  )

  return () => ctxRef.current!
}
