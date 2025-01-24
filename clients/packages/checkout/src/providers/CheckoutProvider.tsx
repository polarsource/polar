'use client'

import { PolarCore } from '@polar-sh/sdk/core'
import { checkoutsCustomClientConfirm } from '@polar-sh/sdk/funcs/checkoutsCustomClientConfirm'
import { checkoutsCustomClientGet } from '@polar-sh/sdk/funcs/checkoutsCustomClientGet'
import { checkoutsCustomClientUpdate } from '@polar-sh/sdk/funcs/checkoutsCustomClientUpdate'
import type { CheckoutConfirmStripe } from '@polar-sh/sdk/models/components/checkoutconfirmstripe'
import type { CheckoutPublic } from '@polar-sh/sdk/models/components/checkoutpublic'
import type { CheckoutPublicConfirmed } from '@polar-sh/sdk/models/components/checkoutpublicconfirmed'
import type { CheckoutUpdatePublic } from '@polar-sh/sdk/models/components/checkoutupdatepublic'
import type errors from '@polar-sh/sdk/models/errors'
import type {
  ConnectionError,
  InvalidRequestError,
  RequestAbortedError,
  RequestTimeoutError,
  SDKError,
  SDKValidationError,
  UnexpectedClientError,
} from '@polar-sh/sdk/models/errors'
import type { Result } from '@polar-sh/sdk/types/fp'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'

const stub = (): never => {
  throw new Error('You forgot to wrap your component in <CheckoutProvider>.')
}

export interface CheckoutContextProps {
  checkout: CheckoutPublic
  refresh: () => Promise<
    Result<
      CheckoutPublic,
      | errors.ResourceNotFound
      | errors.HTTPValidationError
      | SDKError
      | SDKValidationError
      | UnexpectedClientError
      | InvalidRequestError
      | RequestAbortedError
      | RequestTimeoutError
      | ConnectionError
    >
  >
  update: (
    data: CheckoutUpdatePublic,
  ) => Promise<
    Result<
      CheckoutPublic,
      | errors.ResourceNotFound
      | errors.HTTPValidationError
      | SDKError
      | SDKValidationError
      | UnexpectedClientError
      | InvalidRequestError
      | RequestAbortedError
      | RequestTimeoutError
      | ConnectionError
    >
  >
  confirm: (
    data: CheckoutConfirmStripe,
  ) => Promise<
    Result<
      CheckoutPublicConfirmed,
      | errors.ResourceNotFound
      | errors.HTTPValidationError
      | SDKError
      | SDKValidationError
      | UnexpectedClientError
      | InvalidRequestError
      | RequestAbortedError
      | RequestTimeoutError
      | ConnectionError
    >
  >
  client: PolarCore
}

// @ts-ignore
export const CheckoutContext = createContext<CheckoutContextProps>(stub)

interface CheckoutProviderProps {
  clientSecret: string
  server?: 'production' | 'sandbox'
  serverURL?: string
  onCheckoutConfirmed?: (checkout: CheckoutPublicConfirmed) => void
}

export const CheckoutProvider = ({
  clientSecret,
  serverURL,
  server,
  children,
}: React.PropsWithChildren<CheckoutProviderProps>) => {
  const client = useMemo(
    () => new PolarCore({ server, serverURL }),
    [server, serverURL],
  )
  const [checkout, setCheckout] = useState<CheckoutPublic | null>(null)

  useEffect(() => {
    checkoutsCustomClientGet(client, { clientSecret }).then(
      ({ ok, value, error }) => {
        if (ok) {
          setCheckout(value)
        } else {
          throw error
        }
      },
    )
  }, [client, clientSecret])

  const refresh = useCallback(async () => {
    const result = await checkoutsCustomClientGet(client, { clientSecret })
    if (result.ok) {
      setCheckout(result.value)
    }
    return result
  }, [client, clientSecret])

  const update = useCallback(
    async (data: CheckoutUpdatePublic) => {
      const result = await checkoutsCustomClientUpdate(client, {
        clientSecret: clientSecret,
        checkoutUpdatePublic: data,
      })
      if (result.ok) {
        setCheckout(result.value)
      }
      return result
    },
    [client, clientSecret],
  )

  const confirm = useCallback(
    async (data: CheckoutConfirmStripe) => {
      const result = await checkoutsCustomClientConfirm(client, {
        clientSecret: clientSecret,
        checkoutConfirmStripe: data,
      })
      if (result.ok) {
        setCheckout(
          result.value as CheckoutPublicConfirmed & { status: 'confirmed' },
        )
      }
      return result
    },
    [client, clientSecret],
  )

  if (!checkout) {
    return null
  }

  return (
    <CheckoutContext.Provider
      value={{
        checkout,
        refresh,
        update,
        confirm,
        client,
      }}
    >
      {children}
    </CheckoutContext.Provider>
  )
}

export const useCheckout = () => {
  return useContext(CheckoutContext)
}
