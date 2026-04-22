'use client'

import {
  ClientResponseError,
  createClient,
  unwrap,
  type Client,
  type operations,
  type schemas,
} from '@polar-sh/client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'

// Mimicking the SDK error handling pattern, for now.
// Extract non-200 status codes from a responses object
type ResponseMap = Record<number, { content?: { 'application/json': unknown } }>

type ErrorCodes<T extends ResponseMap> = Exclude<keyof T, 200 | 201 | 202 | 204>

type ErrorTypes<T extends ResponseMap> = Extract<
  T[ErrorCodes<T>] extends { content: { 'application/json': infer R } }
    ? R
    : never,
  { error: string }
>['error']

type SuccessBody<T extends ResponseMap> = T[200] extends {
  content: { 'application/json': infer R }
}
  ? R
  : never

type APIError<T extends keyof operations> = {
  error: ErrorTypes<operations[T]['responses']>
  detail: string
}

type ValidationError = {
  error: 'PolarRequestValidationError' | 'RequestValidationError'
  detail: { input: unknown; loc: string[]; msg: string; type: string }[]
}

export type ErrorResponse<T extends keyof operations> =
  | APIError<T>
  | ValidationError

export type Result<T extends keyof operations> =
  | { ok: true; error: never; value: SuccessBody<operations[T]['responses']> }
  | {
      ok: false
      error: ErrorResponse<T> | null
      value: never
    }

const checkoutsClientGet = async (
  api: Client,
  path: operations['checkouts:client_get']['parameters']['path'],
): Promise<Result<'checkouts:client_get'>> => {
  try {
    const checkout = await unwrap(
      api.GET('/v1/checkouts/client/{client_secret}', {
        params: { path },
      }),
    )

    return { ok: true, value: checkout } as Result<'checkouts:client_get'>
  } catch (error) {
    if (error instanceof ClientResponseError) {
      return {
        ok: false,
        error: error.error as ErrorResponse<'checkouts:client_get'>,
      } as Result<'checkouts:client_get'>
    }

    return { ok: false, error: null } as Result<'checkouts:client_get'>
  }
}

const checkoutsClientConfirm = async (
  api: Client,
  path: operations['checkouts:client_confirm']['parameters']['path'],
  body: operations['checkouts:client_confirm']['requestBody']['content']['application/json'],
): Promise<Result<'checkouts:client_confirm'>> => {
  try {
    const confirmedCheckout = await unwrap(
      api.POST('/v1/checkouts/client/{client_secret}/confirm', {
        params: { path },
        body,
      }),
    )

    return {
      ok: true,
      value: confirmedCheckout,
    } as Result<'checkouts:client_confirm'>
  } catch (error) {
    if (error instanceof ClientResponseError) {
      return {
        ok: false,
        error: error.error as ErrorResponse<'checkouts:client_confirm'>,
      } as Result<'checkouts:client_confirm'>
    }

    return {
      ok: false,
      error: null,
    } as Result<'checkouts:client_confirm'>
  }
}

const checkoutsClientUpdate = async (
  api: Client,
  path: operations['checkouts:client_update']['parameters']['path'],
  body: operations['checkouts:client_update']['requestBody']['content']['application/json'],
): Promise<Result<'checkouts:client_update'>> => {
  try {
    const updatedCheckout = await unwrap(
      api.PATCH('/v1/checkouts/client/{client_secret}', {
        params: { path },
        body,
      }),
    )

    return {
      ok: true,
      value: updatedCheckout,
    } as Result<'checkouts:client_update'>
  } catch (error) {
    if (error instanceof ClientResponseError) {
      return {
        ok: false,
        error: error.error as ErrorResponse<'checkouts:client_update'>,
      } as Result<'checkouts:client_update'>
    }
    return { ok: false, error: null } as Result<'checkouts:client_update'>
  }
}

const stub = (): never => {
  throw new Error('You forgot to wrap your component in <CheckoutProvider>.')
}

export interface CheckoutContextProps {
  checkout: schemas['CheckoutPublic']
  refresh: () => Promise<Result<'checkouts:client_get'>>
  update: (
    data: schemas['CheckoutUpdatePublic'],
  ) => Promise<Result<'checkouts:client_update'>>
  confirm: (
    data: schemas['CheckoutConfirmStripe'],
  ) => Promise<Result<'checkouts:client_confirm'>>
  client: Client
}

// @ts-expect-error - Allow to throw an error if the context is used without a provider
export const CheckoutContext = createContext<CheckoutContextProps>(stub)

interface CheckoutProviderProps {
  clientSecret: string
  initialCheckout?: schemas['CheckoutPublic']
  server?: 'production' | 'sandbox'
  serverURL?: string
}

export const CheckoutProvider = ({
  clientSecret,
  initialCheckout,
  serverURL,
  server,
  children,
}: React.PropsWithChildren<CheckoutProviderProps>) => {
  const client = useMemo(() => {
    const baseUrl = (() => {
      if (serverURL) {
        return serverURL.replace(/\/v1\/?$/, '')
      }

      switch (server) {
        case 'sandbox': {
          return 'https://sandbox-api.polar.sh'
        }

        case 'production':
        case undefined: {
          return 'https://api.polar.sh'
        }

        default:
          throw new Error(`Unknown server: '${server}'`)
      }
    })()

    return createClient(baseUrl)
  }, [server, serverURL])

  const [checkout, setCheckout] = useState<schemas['CheckoutPublic'] | null>(
    initialCheckout ?? null,
  )

  useEffect(() => {
    if (initialCheckout) {
      return
    }
    checkoutsClientGet(client, {
      client_secret: clientSecret,
    })
      .then((result) => {
        if (result.ok) {
          setCheckout(result.value)
        }
      })
      .catch((error) => {
        throw error
      })
  }, [client, clientSecret, initialCheckout])

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
