import { AuthContext } from '@/providers/auth'
import { getAuthenticatedUser } from '@/utils/user'
import type { schemas } from '@polar-sh/client'
import { PHASE_PRODUCTION_BUILD } from 'next/constants'
import type { PropsWithChildren } from 'react'

export const AuthProvider = async ({ children }: PropsWithChildren) => {
  let authenticatedUser: schemas['UserRead'] | undefined = undefined

  try {
    authenticatedUser = await getAuthenticatedUser()
  } catch (e) {
    if (process.env.NEXT_PHASE !== PHASE_PRODUCTION_BUILD) {
      throw e
    }
  }

  return <AuthContext value={authenticatedUser}>{children}</AuthContext>
}
