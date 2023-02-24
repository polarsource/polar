import { createContext, useState, useEffect, useContext } from 'react'
import { useRouter } from 'next/router'
import { Session, session } from '../hooks/session'

export const authContext = createContext()

export const useProvideAuth = () => {
  const [authenticated, setAuthenticated] = useState(session.authenticated)

  session.onAuthChange((s: Session) => {
    setAuthenticated(s.authenticated)
  })

  useEffect(() => {
    session.signin()
  }, [authenticated])

  return {
    session,
  }
}

export const useAuth = () => {
  return useContext(authContext)
}

export const requireAuth = (redirectTo: string = '/') => {
  // TODO: Change this to be given by the app. Currently forcing next router
  const router = useRouter()

  session.onAuthChange((s: Session) => {
    if (!s.authenticated || s.user === null) {
      router.push(redirectTo)
    }
  })

  return useAuth()
}
