import { useQuery } from '@tanstack/react-query'
import { voidRequest } from './api'
import { VoidProduct } from './products'

export const productKeys = {
  list: (organizationId: string) => ['void_products', organizationId],
  detail: (organizationId: string, id: string) => [
    'void_product',
    organizationId,
    id,
  ],
}

export const useVoidProducts = (
  organizationId: string,
  options?: { enabled?: boolean },
) =>
  useQuery({
    queryKey: productKeys.list(organizationId),
    queryFn: () => voidRequest<VoidProduct[]>(organizationId, '/products'),
    retry: false,
    ...options,
  })

export const useVoidProduct = (organizationId: string, id: string) =>
  useQuery({
    queryKey: productKeys.detail(organizationId, id),
    queryFn: () =>
      voidRequest<VoidProduct>(
        organizationId,
        `/products/${encodeURIComponent(id)}`,
      ),
    retry: false,
    enabled: Boolean(id),
  })
