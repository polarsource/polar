'use client'

import type { schemas } from '@polar-sh/client'
import { createContext } from 'react'

export const AuthContext = createContext<schemas['UserRead'] | undefined>(
  undefined,
)
