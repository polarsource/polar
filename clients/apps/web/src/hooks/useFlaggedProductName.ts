'use client'

import { api } from '@/utils/client'
import useDebounce from '@/utils/useDebounce'
import { schemas, unwrap } from '@polar-sh/client'
import { useQuery } from '@tanstack/react-query'

export const useFlaggedProductName = (
  name: string,
): schemas['ProductNameCheck'] | null => {
  const debouncedName = useDebounce(name.trim(), 600)
  const { data } = useQuery({
    queryKey: ['product-name-check', debouncedName],
    queryFn: () =>
      unwrap(
        api.POST('/v1/products/name-check', {
          body: { name: debouncedName },
        }),
      ),
    enabled: debouncedName.length >= 3 && debouncedName.length <= 64,
    staleTime: Infinity,
    retry: false,
  })

  return data?.category ? data : null
}
