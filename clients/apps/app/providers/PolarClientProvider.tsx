import { Client, createClient } from '@polar-sh/client'
import { createContext, useContext, type PropsWithChildren } from 'react'
import { useSession } from './SessionProvider'

const PolarClientContext = createContext<{
  polar: Client
}>({
  polar: createClient(
    process.env.EXPO_PUBLIC_POLAR_SERVER_URL ?? 'https://api.polar.sh',
  ),
})

export function usePolarClient() {
  const value = useContext(PolarClientContext)
  if (process.env.NODE_ENV !== 'production') {
    if (!value) {
      throw new Error(
        'usePolarClient must be wrapped in a <PolarClientProvider />',
      )
    }
  }
  return value
}

export function PolarClientProvider({ children }: PropsWithChildren) {
  const { session } = useSession()

  const polar = createClient(
    process.env.EXPO_PUBLIC_POLAR_SERVER_URL ?? 'https://api.polar.sh',
    session ?? '',
  )

  return (
    <PolarClientContext.Provider
      value={{
        polar,
      }}
    >
      {children}
    </PolarClientContext.Provider>
  )
}
