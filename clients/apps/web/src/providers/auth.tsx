'use client'

import type { schemas } from '@polar-sh/client'
import { createContext, type ReactNode } from 'react'

export const AuthContext = createContext<schemas['UserRead'] | undefined>(
  undefined,
)

export const UserContextProvider = ({
  user,
  children,
}: {
  user: schemas['UserRead'] | undefined
  children: ReactNode
}) => <AuthContext value={user}>{children}</AuthContext>
