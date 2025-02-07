'use client'

import { components } from '@polar-sh/client'
import React from 'react'

export type AuthContextValue = {
  user?: components['schemas']['UserRead']
  userOrganizations: components['schemas']['Organization'][]
  setUser: React.Dispatch<
    React.SetStateAction<components['schemas']['UserRead']>
  >
  setUserOrganizations: React.Dispatch<
    React.SetStateAction<components['schemas']['Organization'][]>
  >
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
  user: components['schemas']['UserRead'] | undefined
  userOrganizations: components['schemas']['Organization'][]
  children: React.ReactNode
}) => {
  const [user, setUser] = React.useState<
    components['schemas']['UserRead'] | undefined
  >(_user)
  const [userOrganizations, setUserOrganizations] =
    React.useState<components['schemas']['Organization'][]>(_userOrganizations)

  return (
    <AuthContext.Provider
      value={{
        user,
        setUser: setUser as React.Dispatch<
          React.SetStateAction<components['schemas']['UserRead']>
        >,
        userOrganizations,
        setUserOrganizations,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
