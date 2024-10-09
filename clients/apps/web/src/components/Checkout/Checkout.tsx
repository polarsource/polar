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
import { ShadowBoxOnMd } from 'polarkit/components/ui/atoms/shadowbox'
import { useCallback, useState } from 'react'
import { FormProvider, useForm } from 'react-hook-form'
import { CheckoutForm } from './CheckoutForm'
import { CheckoutInfo } from './CheckoutInfo'

export interface CheckoutProps {
  organization: Organization
  checkout: CheckoutPublic
}

export const Checkout = ({
  checkout: _checkout,
  organization,
}: CheckoutProps) => {
  const [checkout, setCheckout] = useState(_checkout)
  const form = useForm<CheckoutUpdatePublic>({ defaultValues: checkout })
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

  return (
    <ShadowBoxOnMd className="md:dark:border-polar-700 dark:divide-polar-700 flex w-full max-w-7xl flex-col gap-y-24 divide-gray-100 md:flex-row md:items-stretch md:gap-y-0 md:divide-x md:border md:border-gray-100 md:p-0">
      <FormProvider {...form}>
        <CheckoutInfo
          organization={organization}
          checkout={checkout}
          onCheckoutUpdate={onCheckoutUpdate}
        />
        <CheckoutForm
          checkout={checkout}
          onCheckoutUpdate={onCheckoutUpdate}
          onCheckoutConfirm={onCheckoutConfirm}
        />
      </FormProvider>
    </ShadowBoxOnMd>
  )
}
