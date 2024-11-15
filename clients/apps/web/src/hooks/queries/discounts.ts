import { api, queryClient } from '@/utils/api'
import {
  Discount,
  DiscountCreate,
  DiscountsApiListRequest,
  DiscountUpdate,
} from '@polar-sh/sdk'
import { useMutation, useQuery } from '@tanstack/react-query'
import { defaultRetry } from './retry'

const invalidateDiscountsQueries = ({
  id,
  organizationId,
}: {
  id?: string
  organizationId?: string
}) => {
  if (id) {
    queryClient.invalidateQueries({
      queryKey: ['discounts', 'id', id],
    })
  }

  if (organizationId) {
    queryClient.invalidateQueries({
      queryKey: ['discounts', { organizationId }],
    })
  }
}

export const useDiscounts = (
  organizationId: string,
  parameters?: Omit<DiscountsApiListRequest, 'organization_id'>,
) =>
  useQuery({
    queryKey: ['discounts', { organizationId, ...(parameters || {}) }],
    queryFn: () =>
      api.discounts.list({
        organizationId,
        ...(parameters || {}),
      }),
    retry: defaultRetry,
  })

export const useCreateDiscount = (organizationId: string) =>
  useMutation({
    mutationFn: (body: DiscountCreate) => {
      return api.discounts.create({
        body,
      })
    },
    onSuccess: (result, _variables, _ctx) => {
      invalidateDiscountsQueries({ organizationId, id: result.id })
    },
  })

export const useUpdateDiscount = (id: string) =>
  useMutation({
    mutationFn: (body: DiscountUpdate) => {
      return api.discounts.update({
        id,
        body,
      })
    },
    onSuccess: (result, _variables, _ctx) => {
      invalidateDiscountsQueries({
        id,
        organizationId: result.organization_id,
      })
    },
  })

export const useDeleteDiscount = () =>
  useMutation({
    mutationFn: (discount: Discount) => {
      return api.discounts.delete({
        id: discount.id,
      })
    },
    onSuccess: (_result, variables, _ctx) => {
      invalidateDiscountsQueries({
        organizationId: variables.organization_id,
      })
    },
  })
