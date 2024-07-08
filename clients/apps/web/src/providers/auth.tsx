'use client'

import { UserRead } from '@polar-sh/sdk'
import React from 'react'

export type AuthContextValue = {
  user?: UserRead
  setUser: (user: UserRead) => void
}

const stub = (): never => {
  throw new Error('You forgot to wrap your component in <UserContextProvider>.')
}

export const AuthContext = React.createContext<AuthContextValue>(
  // @ts-ignore
  stub,
)

export const UserContextProvider = ({
  user: _user,
  children,
}: {
  user: UserRead | undefined
  children: React.ReactNode
}) => {
  const [user, setUser] = React.useState<UserRead | undefined>(_user)
  return (
    <AuthContext.Provider value={{ user, setUser }}>
      {children}
    </AuthContext.Provider>
  )
}
