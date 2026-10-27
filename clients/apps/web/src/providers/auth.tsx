'use client'

import { schemas } from '@polar-sh/client'
import React from 'react'

export type AuthContextValue = {
  user?: schemas['UserRead']
  userOrganizations: schemas['OrganizationWithRole'][]
  setUser: React.Dispatch<React.SetStateAction<schemas['UserRead']>>
  setUserOrganizations: React.Dispatch<
    React.SetStateAction<schemas['OrganizationWithRole'][]>
  >
}

const stub = (): never => {
  throw new Error('You forgot to wrap your component in <UserContextProvider>.')
}

export const AuthContext = React.createContext<AuthContextValue>(
  // oxlint-disable-next-line typescript/ban-ts-comment
  // @ts-ignore
  stub,
)

const useServerSeededState = <T,>(
  serverValue: T,
): [T, React.Dispatch<React.SetStateAction<T>>] => {
  const [override, setOverride] = React.useState<{
    serverValue: T
    value: T
  } | null>(null)

  const value =
    override !== null && override.serverValue === serverValue
      ? override.value
      : serverValue

  const setValue = React.useCallback<React.Dispatch<React.SetStateAction<T>>>(
    (action) =>
      setOverride((previous) => {
        const current =
          previous !== null && previous.serverValue === serverValue
            ? previous.value
            : serverValue
        return {
          serverValue,
          value:
            typeof action === 'function'
              ? (action as (previous: T) => T)(current)
              : action,
        }
      }),
    [serverValue],
  )

  return [value, setValue]
}

export const UserContextProvider = ({
  user: _user,
  userOrganizations: _userOrganizations,
  children,
}: {
  user: schemas['UserRead'] | undefined
  userOrganizations: schemas['OrganizationWithRole'][]
  children: React.ReactNode
}) => {
  const [user, setUser] = useServerSeededState(_user)
  const [userOrganizations, setUserOrganizations] =
    useServerSeededState(_userOrganizations)

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
