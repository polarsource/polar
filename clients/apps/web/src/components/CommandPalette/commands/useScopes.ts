import { Organization } from '@polar-sh/sdk'
import { useRouter } from 'next/navigation'
import { useMemo } from 'react'
import { SCOPES, ScopeContext } from './scopes'
import { CommandContextValue } from './useCommands'

export const useScopes = (
  organization: Organization,
  utils: Pick<CommandContextValue, 'setScopeKeys' | 'hideCommandPalette'>,
) => {
  const router = useRouter()

  const context: ScopeContext = useMemo(
    () => ({
      router,
      organization,
      ...utils,
    }),
    [router, organization],
  )

  const scopes = useMemo(() => SCOPES(context), [context])

  return scopes
}
