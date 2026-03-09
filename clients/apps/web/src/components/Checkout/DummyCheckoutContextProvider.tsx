'use client'

import type { schemas } from '@polar-sh/client'
import React from 'react'
import { useForm } from 'react-hook-form'

import {
  CheckoutContext,
  CheckoutFormContext,
  type Result,
} from '@polar-sh/checkout/providers'
import { useTheme } from 'next-themes'

const DummyCheckoutContextProvider = ({
  checkout,
  embed: _embed,
  theme: _theme,
  children,
}: React.PropsWithChildren<{
  checkout: schemas['CheckoutPublic']
  embed?: boolean
  theme?: 'light' | 'dark'
}>) => {
  const form = useForm<schemas['CheckoutUpdatePublic']>({
    defaultValues: {
      ...checkout,
      customer_billing_address: checkout.customer_billing_address as
        | schemas['AddressInput']
        | null,
      allow_trial: undefined,
    },
  })

  const embed = _embed === true

  const { resolvedTheme } = useTheme()
  const theme = _theme || (resolvedTheme as 'light' | 'dark')

  return (
    <CheckoutContext.Provider
      value={{
        checkout,
        refresh: async () =>
          ({ ok: true, value: checkout }) as Result<schemas['CheckoutPublic']>,
        update: async () =>
          ({ ok: true, value: checkout }) as Result<schemas['CheckoutPublic']>,
        confirm: async () =>
          ({
            ok: true,
            value: checkout as schemas['CheckoutPublicConfirmed'],
          }) as Result<schemas['CheckoutPublicConfirmed']>,
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        client: {},
      }}
    >
      <CheckoutFormContext.Provider
        value={{
          checkout,
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          client: {},
          form,
          update: async () => checkout,
          confirm: async () => checkout as schemas['CheckoutPublicConfirmed'],
          loading: false,
          embed: embed === true,
          theme,
        }}
      >
        {children}
      </CheckoutFormContext.Provider>
    </CheckoutContext.Provider>
  )
}

export { DummyCheckoutContextProvider }
