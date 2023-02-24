import { useProvideAuth, authContext } from '../hooks/auth'

const AuthProvider = ({ children }) => {
  const auth = useProvideAuth()
  return <authContext.Provider value={auth}>{children}</authContext.Provider>
}

export default AuthProvider
