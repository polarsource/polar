'use client'

import { Organization, UserRead } from '@polar-sh/sdk'
import React from 'react'

export type AuthContextValue = {
  user?: UserRead
  userOrganizations: Organization[]
  setUser: (user: UserRead) => void
  setUserOrganizations: (organizations: Organization[]) => void
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
  userOrganizations: _userOrganizations,
  children,
}: {
  user: UserRead | undefined
  userOrganizations: Organization[]
  children: React.ReactNode
}) => {
  const [user, setUser] = React.useState<UserRead | undefined>(_user)
  const [userOrganizations, setUserOrganizations] =
    React.useState<Organization[]>(_userOrganizations)
  return (
    <AuthContext.Provider
      value={{ user, setUser, userOrganizations, setUserOrganizations }}
    >
      {children}
    </AuthContext.Provider>
  )
}
