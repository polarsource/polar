import { configureRefresher, type SessionData } from '@/auth/refresher'
import { useStorageState } from '@/hooks/storage'
import { ExtensionStorage } from '@bacons/apple-targets'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  type PropsWithChildren,
} from 'react'

const ACCESS_TOKEN_KEY = 'session'
const REFRESH_TOKEN_KEY = 'session_refresh_token'
const EXPIRES_AT_KEY = 'session_expires_at'

const widgetStorage = new ExtensionStorage('group.com.polarsource.Polar')

type AuthContextValue = {
  setSession: (data: SessionData | null) => void
  session?: string | null
  refreshToken?: string | null
  expiresAt?: number | null
  isLoading: boolean
}

const AuthContext = createContext<AuthContextValue>({
  setSession: () => null,
  session: null,
  refreshToken: null,
  expiresAt: null,
  isLoading: false,
})

export function useSession() {
  const value = useContext(AuthContext)
  if (process.env.NODE_ENV !== 'production') {
    if (!value) {
      throw new Error('useSession must be wrapped in a <SessionProvider />')
    }
  }
  return value
}

export function SessionProvider({ children }: PropsWithChildren) {
  const [[isLoadingAccess, accessToken], setAccessTokenStorage] =
    useStorageState(ACCESS_TOKEN_KEY)
  const [[isLoadingRefresh, refreshToken], setRefreshTokenStorage] =
    useStorageState(REFRESH_TOKEN_KEY)
  const [[isLoadingExpires, expiresAtRaw], setExpiresAtStorage] =
    useStorageState(EXPIRES_AT_KEY)

  const expiresAt = useMemo(() => {
    if (!expiresAtRaw) return null
    const parsed = Number.parseInt(expiresAtRaw, 10)
    return Number.isFinite(parsed) ? parsed : null
  }, [expiresAtRaw])

  const isLoading = isLoadingAccess || isLoadingRefresh || isLoadingExpires

  const setSession = useCallback(
    (data: SessionData | null) => {
      if (!data) {
        setAccessTokenStorage(null)
        setRefreshTokenStorage(null)
        setExpiresAtStorage(null)
        return
      }
      setAccessTokenStorage(data.accessToken)
      setRefreshTokenStorage(data.refreshToken ?? null)
      setExpiresAtStorage(
        typeof data.expiresAt === 'number' ? String(data.expiresAt) : null,
      )
    },
    [setAccessTokenStorage, setRefreshTokenStorage, setExpiresAtStorage],
  )

  useEffect(() => {
    if (accessToken) {
      widgetStorage.set('widget_api_token', accessToken)
    }
  }, [accessToken])

  useEffect(() => {
    configureRefresher({
      accessToken: accessToken ?? null,
      refreshToken: refreshToken ?? null,
      expiresAt,
      setSession,
    })
  }, [accessToken, refreshToken, expiresAt, setSession])

  return (
    <AuthContext.Provider
      value={{
        setSession,
        session: accessToken,
        refreshToken,
        expiresAt,
        isLoading,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
