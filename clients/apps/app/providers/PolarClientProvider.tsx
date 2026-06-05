import { refreshMiddleware } from '@/auth/refreshMiddleware'
import { Client, createClient } from '@polar-sh/client'
import Constants from 'expo-constants'
import * as Updates from 'expo-updates'
import {
  createContext,
  useContext,
  useMemo,
  type PropsWithChildren,
} from 'react'
import { useSession } from './SessionProvider'

// `version` is the human-readable marketing version, but it relies on a
// developer manually bumping it. `runtimeVersion` (the fingerprint) and
// `updateId` update automatically on every build/OTA, so they're the reliable
// signal for "which exact build is calling this endpoint". `updateId` is null
// on an embedded launch (fresh install before any OTA, or in dev).
const CLIENT_VERSION_HEADERS = {
  'X-Polar-Client-Version': `mobile/${Constants.expoConfig?.version ?? 'unknown'}`,
  'X-Polar-Client-Runtime': Updates.runtimeVersion ?? 'unknown',
  'X-Polar-Client-Update': Updates.updateId ?? 'embedded',
}

const PolarClientContext = createContext<{
  polar: Client
}>({
  polar: createClient(
    process.env.EXPO_PUBLIC_POLAR_SERVER_URL ?? 'https://api.polar.sh',
    undefined,
    CLIENT_VERSION_HEADERS,
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

  const polar = useMemo(() => {
    const client = createClient(
      process.env.EXPO_PUBLIC_POLAR_SERVER_URL ?? 'https://api.polar.sh',
      session ?? '',
      CLIENT_VERSION_HEADERS,
    )
    client.use(refreshMiddleware)
    return client
  }, [session])

  return (
    <PolarClientContext.Provider value={{ polar }}>
      {children}
    </PolarClientContext.Provider>
  )
}
