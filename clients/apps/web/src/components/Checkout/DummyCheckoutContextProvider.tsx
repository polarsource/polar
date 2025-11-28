'use client'

import type { AddressInput } from '@polar-sh/sdk/models/components/addressinput'
import type { CheckoutPublic } from '@polar-sh/sdk/models/components/checkoutpublic'
import type { CheckoutPublicConfirmed } from '@polar-sh/sdk/models/components/checkoutpublicconfirmed'
import type { CheckoutUpdatePublic } from '@polar-sh/sdk/models/components/checkoutupdatepublic'
import React from 'react'
import { useForm } from 'react-hook-form'

import {
  CheckoutContext,
  CheckoutFormContext,
} from '@polar-sh/checkout/providers'
import { useTheme } from 'next-themes'

const DummyCheckoutContextProvider = ({
  checkout,
  embed: _embed,
  theme: _theme,
  children,
}: React.PropsWithChildren<{
  checkout: CheckoutPublic
  embed?: boolean
  theme?: 'light' | 'dark'
}>) => {
  const form = useForm<CheckoutUpdatePublic>({
    defaultValues: {
      ...checkout,
      customerBillingAddress:
        checkout.customerBillingAddress as AddressInput | null,
      allowTrial: undefined,
    },
  })

  const embed = _embed === true

  const { resolvedTheme } = useTheme()
  const theme = _theme || (resolvedTheme as 'light' | 'dark')

  return (
    <CheckoutContext.Provider
      value={{
        checkout,
        refresh: async () => ({
          ok: true,
          value: checkout,
          error: undefined,
        }),
        update: async () => ({
          ok: true,
          value: checkout,
          error: undefined,
        }),
        confirm: async () => ({
          ok: true,
          value: checkout as CheckoutPublicConfirmed,
          error: undefined,
        }),
        // @ts-ignore
        client: {},
      }}
    >
      <CheckoutFormContext.Provider
        value={{
          checkout,
          // @ts-ignore
          client: {},
          form,
          update: async () => checkout,
          confirm: async () => checkout as CheckoutPublicConfirmed,
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
