'use client'

import { api } from '@/utils/api'
import { setValidationErrors } from '@/utils/api/errors'
import {
  CheckoutConfirmStripe,
  CheckoutPublic,
  CheckoutUpdatePublic,
  Organization,
  ResponseError,
  ValidationError,
} from '@polar-sh/sdk'
import ShadowBox, {
  ShadowBoxOnMd,
} from 'polarkit/components/ui/atoms/shadowbox'
import { useCallback, useState } from 'react'
import { FormProvider, useForm } from 'react-hook-form'
import { CheckoutForm } from './CheckoutForm'
import { CheckoutInfo } from './CheckoutInfo'

export interface CheckoutProps {
  organization: Organization
  checkout: CheckoutPublic
  embed?: boolean
  theme?: 'light' | 'dark'
}

export const Checkout = ({
  checkout: _checkout,
  organization,
  embed,
  theme,
}: CheckoutProps) => {
  const [checkout, setCheckout] = useState(_checkout)
  const form = useForm<CheckoutUpdatePublic>({
    defaultValues: checkout,
    shouldUnregister: true,
  })
  const { setError } = form

  const onCheckoutUpdate = useCallback(
    async (body: CheckoutUpdatePublic): Promise<CheckoutPublic> => {
      try {
        const updatedCheckout = await api.checkouts.clientUpdate({
          clientSecret: checkout.client_secret,
          body,
        })
        setCheckout(updatedCheckout)
        return updatedCheckout
      } catch (e) {
        if (e instanceof ResponseError) {
          const body = await e.response.json()
          if (e.response.status === 422) {
            const validationErrors = body['detail'] as ValidationError[]
            setValidationErrors(validationErrors, setError)
          } else {
            setError('root', { message: e.message })
          }
        }
        throw e
      }
    },
    [checkout, setError],
  )

  const onCheckoutConfirm = useCallback(
    async (body: CheckoutConfirmStripe): Promise<CheckoutPublic> => {
      try {
        const updatedCheckout = await api.checkouts.clientConfirm({
          clientSecret: checkout.client_secret,
          body,
        })
        setCheckout(updatedCheckout)
        return updatedCheckout
      } catch (e) {
        if (e instanceof ResponseError) {
          const body = await e.response.json()
          if (e.response.status === 422) {
            const validationErrors = body['detail'] as ValidationError[]
            setValidationErrors(validationErrors, setError)
          } else {
            setError('root', { message: e.message })
          }
        }
        throw e
      }
    },
    [checkout, setError],
  )

  const ShadowBoxComponent = embed ? ShadowBox : ShadowBoxOnMd

  return (
    <ShadowBoxComponent className="md:dark:border-polar-700 dark:divide-polar-700 grid w-full auto-cols-fr grid-flow-row auto-rows-max gap-y-24 divide-transparent overflow-hidden md:grid-flow-col md:grid-rows-1 md:items-stretch md:gap-y-0 md:divide-x md:border md:border-gray-100 md:p-0">
      <FormProvider {...form}>
        {!embed && (
          <CheckoutInfo
            className="md:dark:bg-polar-900 md:bg-white"
            organization={organization}
            checkout={checkout}
            onCheckoutUpdate={onCheckoutUpdate}
          />
        )}
        <CheckoutForm
          checkout={checkout}
          onCheckoutUpdate={onCheckoutUpdate}
          onCheckoutConfirm={onCheckoutConfirm}
          theme={theme}
          embed={embed}
        />
      </FormProvider>
    </ShadowBoxComponent>
  )
}
