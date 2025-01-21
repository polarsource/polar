'use client'

import {
  CheckoutFormProvider,
  CheckoutProvider,
  useCheckout,
  useCheckoutForm,
} from '@polar-sh/checkout/providers'
import type { PolarCore } from '@polar-sh/sdk/core'
import type { CheckoutConfirmStripe } from '@polar-sh/sdk/models/components/checkoutconfirmstripe'
import type { CheckoutPublic } from '@polar-sh/sdk/models/components/checkoutpublic'
import type { CheckoutPublicConfirmed } from '@polar-sh/sdk/models/components/checkoutpublicconfirmed'
import type { CheckoutUpdatePublic } from '@polar-sh/sdk/models/components/checkoutupdatepublic'
import type { Stripe, StripeElements } from '@stripe/stripe-js'
import React, { createContext } from 'react'
import { useForm, type UseFormReturn } from 'react-hook-form'

import { getServerURL } from '@/utils/api'
import { useTheme } from 'next-themes'
import CheckoutLayout from './CheckoutLayout'

const CheckoutContextLayout = ({
  embed,
  theme,
  children,
}: React.PropsWithChildren<{ embed?: boolean; theme?: 'light' | 'dark' }>) => {
  const { checkout } = useCheckout()
  return (
    <CheckoutLayout checkout={checkout} embed={embed === true} theme={theme}>
      {children}
    </CheckoutLayout>
  )
}

interface CheckoutContextProps {
  checkout: CheckoutPublic
  client: PolarCore
  form: UseFormReturn<CheckoutUpdatePublic>
  update: (data: CheckoutUpdatePublic) => Promise<CheckoutPublic>
  confirm: (
    data: CheckoutConfirmStripe,
    stripe: Stripe | null,
    elements: StripeElements | null,
  ) => Promise<CheckoutPublicConfirmed>
  loading: boolean
  loadingLabel: string | undefined
  embed: boolean
  theme: 'light' | 'dark'
}

const stub = (): never => {
  throw new Error(
    'You forgot to wrap your component in <CheckoutContextProvider>.',
  )
}

export const CheckoutContext =
  // @ts-ignore
  createContext<CheckoutContextProps>(stub)

const CheckoutContextProviderInner = ({
  embed: _embed,
  theme: _theme,
  children,
}: React.PropsWithChildren<{
  embed?: boolean
  theme?: 'light' | 'dark'
}>) => {
  const { checkout, form, update, confirm, loading, loadingLabel } =
    useCheckoutForm()
  const { client } = useCheckout()
  const embed = _embed === true

  const { resolvedTheme } = useTheme()
  const theme = _theme || (resolvedTheme as 'light' | 'dark')

  return (
    <CheckoutContext.Provider
      value={{
        checkout,
        client,
        form,
        update,
        confirm,
        loading,
        loadingLabel,
        embed,
        theme,
      }}
    >
      {children}
    </CheckoutContext.Provider>
  )
}

const CheckoutContextProvider = ({
  clientSecret,
  embed,
  theme,
  prefilledParameters,
  children,
}: React.PropsWithChildren<{
  clientSecret: string
  prefilledParameters?: Record<string, string>
  embed?: boolean
  theme?: 'light' | 'dark'
}>) => {
  return (
    <CheckoutProvider clientSecret={clientSecret} serverURL={getServerURL()}>
      <CheckoutFormProvider prefilledParameters={prefilledParameters}>
        <CheckoutContextLayout embed={embed} theme={theme}>
          <CheckoutContextProviderInner embed={embed} theme={theme}>
            {children}
          </CheckoutContextProviderInner>
        </CheckoutContextLayout>
      </CheckoutFormProvider>
    </CheckoutProvider>
  )
}

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
  const form = useForm<CheckoutUpdatePublic>({ defaultValues: checkout })

  const embed = _embed === true

  const { resolvedTheme } = useTheme()
  const theme = _theme || (resolvedTheme as 'light' | 'dark')

  return (
    <CheckoutContext.Provider
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
    </CheckoutContext.Provider>
  )
}

const useCheckoutContext = (): CheckoutContextProps => {
  return React.useContext(CheckoutContext)
}

export {
  CheckoutContextProvider,
  DummyCheckoutContextProvider,
  useCheckoutContext,
}
