import { AuthContext } from '@/providers/auth'
import { api } from '@/utils/api'
import { UserRead } from '@polar-sh/sdk'
import { useCallback, useContext, useEffect, useState } from 'react'

export const useClientSideLoadedUser = (): {
  user: UserRead | undefined
  loaded: boolean
} => {
  const { user: contextUser, setUser: setContextUser } = useContext(AuthContext)
  const [loaded, setLoaded] = useState(false)

  const loadUser = useCallback(async (): Promise<undefined> => {
    if (contextUser) {
      setLoaded(true)
      return
    }

    try {
      const user = await api.users.getAuthenticated()
      setContextUser(user)
    } catch {
    } finally {
      setLoaded(true)
    }
  }, [contextUser, setContextUser])

  useEffect(() => {
    loadUser()
  }, [loadUser])

  return {
    user: contextUser,
    loaded,
  }
}
