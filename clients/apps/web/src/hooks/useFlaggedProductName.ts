'use client'

import { api } from '@/utils/client'
import useDebounce from '@/utils/useDebounce'
import { unwrap } from '@polar-sh/client'
import { useQuery } from '@tanstack/react-query'
import { usePostHog } from './posthog'

export interface FlaggedProductName {
  name: string
  category: string
  phrase: string | null
  flagged_at: string
}

export const getFlaggedNamesToReport = (
  submittedName: string,
  flaggedNames: FlaggedProductName[],
): FlaggedProductName[] => {
  const submitted = submittedName.toLowerCase()
  return flaggedNames.filter(({ name }) => {
    const flagged = name.toLowerCase()
    return flagged === submitted || !submitted.startsWith(flagged)
  })
}

export const useFlaggedProductName = ({
  organizationId,
  name,
}: {
  organizationId: string
  name: string
}): FlaggedProductName | null => {
  const posthog = usePostHog()
  const debouncedName = useDebounce(name.trim(), 600)
  const { data, dataUpdatedAt } = useQuery({
    queryKey: ['product-name-check', organizationId, debouncedName],
    queryFn: async () => {
      const check = await unwrap(
        api.POST('/v1/products/name-check', {
          body: { name: debouncedName },
        }),
      )
      if (check.category) {
        posthog.capture('dashboard:products:flagged_name:view', {
          organization_id: organizationId,
          product_name: debouncedName,
          category: check.category,
          phrase: check.phrase,
        })
      }
      return check
    },
    enabled: debouncedName.length >= 3 && debouncedName.length <= 64,
    staleTime: Infinity,
    retry: false,
  })

  return data?.category
    ? {
        name: debouncedName,
        category: data.category,
        phrase: data.phrase,
        flagged_at: new Date(dataUpdatedAt).toISOString(),
      }
    : null
}
