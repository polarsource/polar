import { createContext, useState, useEffect, useContext } from 'react'
import { useRouter } from 'next/router'
import { Session, session } from '../hooks/session'

const authContext = createContext()

const AuthProvider = ({ children }) => {
  const auth = useProvideAuth()
  return <authContext.Provider value={auth}>{children}</authContext.Provider>
}

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
  const router = useRouter()

  session.onAuthChange((s: Session) => {
    if (!s.authenticated || s.user === null) {
      router.push(redirectTo)
    }
  })

  return useAuth()
}

export default AuthProvider
