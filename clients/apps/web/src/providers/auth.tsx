'use client'

import { UserRead } from '@polar-sh/sdk'
import React from 'react'

export type AuthContextValue = {
  user?: UserRead
}

export const AuthContext = React.createContext<AuthContextValue | undefined>(
  undefined,
)

export const UserContextProvider = ({
  user,
  children,
}: {
  user: AuthContextValue
  children: React.ReactNode
}) => {
  return <AuthContext.Provider value={user}>{children}</AuthContext.Provider>
}
