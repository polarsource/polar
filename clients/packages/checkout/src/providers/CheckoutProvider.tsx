'use client'

import type { schemas } from '@polar-sh/client'
import { PolarCore } from '@polar-sh/sdk/core'
import { checkoutsClientConfirm } from '@polar-sh/sdk/funcs/checkoutsClientConfirm'
import { checkoutsClientGet } from '@polar-sh/sdk/funcs/checkoutsClientGet'
import { checkoutsClientUpdate } from '@polar-sh/sdk/funcs/checkoutsClientUpdate'
import type { AlreadyActiveSubscriptionError } from '@polar-sh/sdk/models/errors/alreadyactivesubscriptionerror'
import type { ExpiredCheckoutError } from '@polar-sh/sdk/models/errors/expiredcheckouterror'
import type {
  ConnectionError,
  InvalidRequestError,
  RequestAbortedError,
  RequestTimeoutError,
  UnexpectedClientError,
} from '@polar-sh/sdk/models/errors/httpclienterrors'
import type { HTTPValidationError } from '@polar-sh/sdk/models/errors/httpvalidationerror'
import type { NotOpenCheckout } from '@polar-sh/sdk/models/errors/notopencheckout.js'
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
  checkout: schemas['CheckoutPublic']
  refresh: () => Promise<
    Result<
      schemas['CheckoutPublic'],
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
    data: schemas['CheckoutUpdatePublic'],
  ) => Promise<
    Result<
      schemas['CheckoutPublic'],
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
    data: schemas['CheckoutConfirmStripe'],
  ) => Promise<
    Result<
      schemas['CheckoutPublicConfirmed'],
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
  const client = useMemo(() => {
    const baseUrl = (() => {
      if (serverURL) {
        return serverURL
      }

      switch (server) {
        case 'sandbox': {
          return 'https://sandbox-api.polar.sh/v1/'
        }

        case 'production':
        case undefined: {
          return 'https://api.polar.sh/v1/'
        }

        default:
          throw new Error(`Unknown server: '${server}'`)
      }
    })()

    return createClient(baseUrl)
  }, [server, serverURL])

  const [checkout, setCheckout] = useState<schemas['CheckoutPublic'] | null>(
    null,
  )

  useEffect(() => {
    checkoutsClientGet(client, {
      client_secret: clientSecret,
    })
      .then((result) => {
        if (result.ok) {
          setCheckout(result.value)
        } else {
        }
      })
      .catch((error) => {
        throw error
      })
  }, [client, clientSecret])

  const refresh = useCallback(async () => {
    const result = await checkoutsClientGet(client, {
      client_secret: clientSecret,
    })

    if (result.ok) {
      setCheckout(result.value)
    }

    return result
  }, [client, clientSecret])

  const update = useCallback(
    async (data: schemas['CheckoutUpdatePublic']) => {
      const result = await checkoutsClientUpdate(
        client,
        {
          client_secret: clientSecret,
        },
        data,
      )

      if (result.ok) {
        setCheckout(result.value)
      }

      return result
    },
    [client, clientSecret],
  )

  const confirm = useCallback(
    async (data: schemas['CheckoutConfirmStripe']) => {
      const result = await checkoutsClientConfirm(
        client,
        { client_secret: clientSecret },
        data,
      )

      if (result.ok) {
        setCheckout(result.value)
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
