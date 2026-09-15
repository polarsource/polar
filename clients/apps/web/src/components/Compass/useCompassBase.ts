'use client'

import { useIsVoidDestination } from '@/components/Dashboard/navigationVoid'
import { schemas } from '@polar-sh/client'

/** Compass route prefix for the destination the user is currently in. */
export const useCompassBase = (organization: schemas['Organization']) => {
  const isVoid = useIsVoidDestination()
  return `${isVoid ? '/void' : ''}/dashboard/${organization.slug}/compass`
}
