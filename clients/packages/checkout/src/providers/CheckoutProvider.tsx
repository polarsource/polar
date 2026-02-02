'use client'

import { PolarCore } from '@spaire/sdk/core'
import { checkoutsClientConfirm } from '@spaire/sdk/funcs/checkoutsClientConfirm'
import { checkoutsClientGet } from '@spaire/sdk/funcs/checkoutsClientGet'
import { checkoutsClientUpdate } from '@spaire/sdk/funcs/checkoutsClientUpdate'
import type { CheckoutConfirmStripe } from '@spaire/sdk/models/components/checkoutconfirmstripe'
import type { CheckoutPublic } from '@spaire/sdk/models/components/checkoutpublic'
import type { CheckoutPublicConfirmed } from '@spaire/sdk/models/components/checkoutpublicconfirmed'
import type { CheckoutUpdatePublic } from '@spaire/sdk/models/components/checkoutupdatepublic'
import type { AlreadyActiveSubscriptionError } from '@spaire/sdk/models/errors/alreadyactivesubscriptionerror'
import type { ExpiredCheckoutError } from '@spaire/sdk/models/errors/expiredcheckouterror'
import type {
  ConnectionError,
  InvalidRequestError,
  RequestAbortedError,
  RequestTimeoutError,
  UnexpectedClientError,
} from '@spaire/sdk/models/errors/httpclienterrors'
import type { HTTPValidationError } from '@spaire/sdk/models/errors/httpvalidationerror'
import type { NotOpenCheckout } from '@spaire/sdk/models/errors/notopencheckout.js'
import type { PaymentError } from '@spaire/sdk/models/errors/paymenterror.js'
import type { ResourceNotFound } from '@spaire/sdk/models/errors/resourcenotfound'
import type { SDKError } from '@spaire/sdk/models/errors/sdkerror'
import type { SDKValidationError } from '@spaire/sdk/models/errors/sdkvalidationerror'
import type { Result } from '@spaire/sdk/types/fp'
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
      | ResourceNotFound
      | ExpiredCheckoutError
      | HTTPValidationError
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
      | AlreadyActiveSubscriptionError
      | NotOpenCheckout
      | ExpiredCheckoutError
      | ResourceNotFound
      | HTTPValidationError
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
      | AlreadyActiveSubscriptionError
      | NotOpenCheckout
      | ExpiredCheckoutError
      | PaymentError
      | ResourceNotFound
      | HTTPValidationError
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
    checkoutsClientGet(client, { clientSecret }).then(
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
    const result = await checkoutsClientGet(client, { clientSecret })
    if (result.ok) {
      setCheckout(result.value)
    }
    return result
  }, [client, clientSecret])

  const update = useCallback(
    async (data: CheckoutUpdatePublic) => {
      const result = await checkoutsClientUpdate(client, {
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
      const result = await checkoutsClientConfirm(client, {
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
