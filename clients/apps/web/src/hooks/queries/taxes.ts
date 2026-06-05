import { api } from '@/utils/client'
import { schemas, unwrap } from '@polar-sh/client'
import { UseQueryResult, useQuery } from '@tanstack/react-query'
import { defaultRetry } from './retry'

export const useTaxJurisdictions = (variables: {
  organization_id?: string
  start_date?: string
  end_date?: string
  page?: number
  limit?: number
  sorting?: schemas['TaxJurisdictionSortProperty'][]
}): UseQueryResult<schemas['ListResource_TaxJurisdiction_']> =>
  useQuery({
    queryKey: ['tax_jurisdictions', { ...variables }],
    queryFn: () =>
      unwrap(
        api.GET('/v1/taxes/jurisdictions', {
          params: { query: { ...variables } },
        }),
      ),
    retry: defaultRetry,
    enabled: !!variables.organization_id,
  })
