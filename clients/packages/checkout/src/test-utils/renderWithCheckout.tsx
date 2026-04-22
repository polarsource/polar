import type { Client } from '@polar-sh/client'
import type { AcceptedLocale } from '@polar-sh/i18n'
import { render } from '@testing-library/react'
import { useEffect } from 'react'
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

interface RenderWithCheckoutOptions {
  checkout?: Partial<ProductCheckoutPublic>
  update: CheckoutContextProps['update']
  confirm?: CheckoutContextProps['confirm']
  locale?: AcceptedLocale
}

export const renderWithCheckout = ({
  checkout: checkoutOverrides,
  update,
  confirm = vi.fn(),
  locale,
}: RenderWithCheckoutOptions) => {
  const checkout = createCheckout({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    payment_processor: 'dummy' as any,
    ...checkoutOverrides,
  })

  const ctxRef: { current: CheckoutFormContextProps | null } = { current: null }

  const Capture = () => {
    const ctx = useCheckoutForm()
    useEffect(() => {
      ctxRef.current = ctx
    })
    void ctx.form.formState.errors
    return null
  }

  render(
    <CheckoutContext.Provider
      value={{
        checkout,
        refresh: vi.fn(),
        update,
        confirm,
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
