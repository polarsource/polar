'use client'

import { PolarCore } from '@polar-sh/sdk/core'
import { checkoutsClientConfirm } from '@polar-sh/sdk/funcs/checkoutsClientConfirm'
import { checkoutsClientGet } from '@polar-sh/sdk/funcs/checkoutsClientGet'
import { checkoutsClientUpdate } from '@polar-sh/sdk/funcs/checkoutsClientUpdate'
import type { CheckoutConfirmStripe } from '@polar-sh/sdk/models/components/checkoutconfirmstripe'
import type { CheckoutPublic } from '@polar-sh/sdk/models/components/checkoutpublic'
import type { CheckoutPublicConfirmed } from '@polar-sh/sdk/models/components/checkoutpublicconfirmed'
import type { CheckoutUpdatePublic } from '@polar-sh/sdk/models/components/checkoutupdatepublic'
import type { AlreadyActiveSubscriptionError } from '@polar-sh/sdk/models/errors/alreadyactivesubscriptionerror'
import type {
  ConnectionError,
  InvalidRequestError,
  RequestAbortedError,
  RequestTimeoutError,
  UnexpectedClientError,
} from '@polar-sh/sdk/models/errors/httpclienterrors'
import type { HTTPValidationError } from '@polar-sh/sdk/models/errors/httpvalidationerror'
import type { NotOpenCheckout } from '@polar-sh/sdk/models/errors/notopencheckout.js'
import type { ExpiredCheckoutError } from '@polar-sh/sdk/models/errors/expiredcheckouterror'
import type { PaymentError } from '@polar-sh/sdk/models/errors/paymenterror.js'
import type { ResourceNotFound } from '@polar-sh/sdk/models/errors/resourcenotfound'
import type { SDKError } from '@polar-sh/sdk/models/errors/sdkerror'
import type { SDKValidationError } from '@polar-sh/sdk/models/errors/sdkvalidationerror'
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

/**
 * Redirects to a new checkout session when the client secret changes.
 * This happens when the backend recreates an expired session.
 */
const redirectToNewSession = (newClientSecret: string) => {
  const currentPath = window.location.pathname
  const searchParams = window.location.search
  
  // Replace the old client secret in the URL with the new one
  const newPath = currentPath.replace(
    /\/checkout\/[^\/]+/,
    `/checkout/${newClientSecret}`
  )
  
  // Perform the redirect
  window.location.href = `${newPath}${searchParams}`
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
          // Check if the returned checkout has a different client secret
          // This indicates the backend recreated an expired session
          if (value.clientSecret !== clientSecret) {
            redirectToNewSession(value.clientSecret)
            return
          }
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
      // Check for client secret change on refresh
      if (result.value.clientSecret !== clientSecret) {
        redirectToNewSession(result.value.clientSecret)
        return result
      }
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
        // Check for client secret change on update
        if (result.value.clientSecret !== clientSecret) {
          redirectToNewSession(result.value.clientSecret)
          return result
        }
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
        // Check for client secret change on confirm
        if (result.value.clientSecret !== clientSecret) {
          redirectToNewSession(result.value.clientSecret)
          return result
        }
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
