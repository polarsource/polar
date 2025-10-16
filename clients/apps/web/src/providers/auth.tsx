'use client'

import { schemas } from '@polar-sh/client'
import React from 'react'

export type AuthContextValue = {
  user?: schemas['UserRead']
  userOrganizations: schemas['Organization'][]
  setUser: React.Dispatch<React.SetStateAction<schemas['UserRead']>>
  setUserOrganizations: React.Dispatch<
    React.SetStateAction<schemas['Organization'][]>
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
  user: schemas['UserRead'] | undefined
  userOrganizations: schemas['Organization'][]
  children: React.ReactNode
}) => {
  const [user, setUser] = React.useState<schemas['UserRead'] | undefined>(_user)
  const [userOrganizations, setUserOrganizations] =
    React.useState<schemas['Organization'][]>(_userOrganizations)

  const contextValue = React.useMemo(
    () => ({
      user,
      setUser: setUser as React.Dispatch<
        React.SetStateAction<schemas['UserRead']>
      >,
      userOrganizations,
      setUserOrganizations,
    }),
    [user, userOrganizations, setUser, setUserOrganizations],
  )

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  )
}
