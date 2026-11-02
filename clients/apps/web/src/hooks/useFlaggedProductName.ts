'use client'

import { api } from '@/utils/client'
import useDebounce from '@/utils/useDebounce'
import { schemas, unwrap } from '@polar-sh/client'
import { useQuery } from '@tanstack/react-query'
import { usePostHog } from './posthog'

export const useFlaggedProductName = ({
  organizationId,
  name,
}: {
  organizationId: string
  name: string
}): (schemas['ProductNameCheck'] & { name: string }) | null => {
  const posthog = usePostHog()
  const debouncedName = useDebounce(name.trim(), 600)
  const { data } = useQuery({
    queryKey: ['product-name-check', organizationId, debouncedName],
    queryFn: async () => {
      const check = await unwrap(
        api.POST('/v1/products/name-check', {
          body: { name: debouncedName, organization_id: organizationId },
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

  return data?.category ? { ...data, name: debouncedName } : null
}
